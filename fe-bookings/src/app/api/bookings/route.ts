import { NextRequest, NextResponse } from "next/server";
import {
  checkBookingAvailability,
  createBookingRequest,
  findUserByEmail,
  getBookings,
} from "@/lib/ampeco";
import { validateSlotAvailable } from "@/lib/availability";
import { handleApiError } from "@/lib/api-helpers";

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
    return handleApiError(err, "Failed to load bookings");
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
    const availability = await checkBookingAvailability(locationId, {
      startAfter: startAt,
      endBefore: endAt,
    });

    // Validate the requested slot is actually available.
    if (availability.data && Array.isArray(availability.data)) {
      const result = validateSlotAvailable(availability.data, startAt, endAt, evseId);
      if (!result.available) {
        return NextResponse.json(
          { error: "Slot unavailable", message: result.message },
          { status: 409 }
        );
      }
    }

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
    return handleApiError(err, "Booking failed");
  }
}
