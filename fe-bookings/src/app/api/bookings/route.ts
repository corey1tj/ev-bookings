import { NextRequest, NextResponse } from "next/server";
import {
  checkBookingAvailability,
  createBookingRequest,
  findUserByEmail,
  getBookings,
  AmpecoError,
} from "@/lib/ampeco";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const params: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  try {
    const res = await getBookings(
      Object.keys(params).length ? params : undefined
    );
    return NextResponse.json(res.data);
  } catch (err) {
    if (err instanceof AmpecoError) {
      return NextResponse.json(
        { error: "Failed to load bookings" },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { locationId, evseId, startAt, endAt, email } = body;

  if (!locationId || !startAt || !endAt || !email) {
    return NextResponse.json(
      { error: "locationId, startAt, endAt, and email are required" },
      { status: 400 }
    );
  }

  try {
    // 1. Look up the driver by email — they must already have a driver app account
    const user = await findUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        {
          error: "no_account",
          message:
            "No driver account found for this email. Please sign up in the Future Energy driver app first, then return here to book.",
        },
        { status: 404 }
      );
    }

    // 2. Check availability
    await checkBookingAvailability(locationId, {
      startAfter: startAt,
      endBefore: endAt,
    });

    // TODO: parse availability response to confirm the requested slot is open.
    // The response returns available slots per EVSE — need to verify the
    // requested evseId (or any EVSE) has an open slot in the requested window.

    // 3. Create booking request with type: "create"
    const bookingRes = await createBookingRequest({
      type: "create",
      userId: user.id,
      locationId,
      startAt,
      endAt,
      evseId: evseId || undefined,
    });

    return NextResponse.json(
      {
        bookingRequestId: bookingRes.data.id,
        status: bookingRes.data.status,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AmpecoError) {
      return NextResponse.json(
        { error: "Booking failed", details: err.body },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
