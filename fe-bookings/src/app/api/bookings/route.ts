import { NextRequest, NextResponse } from "next/server";
import {
  checkBookingAvailability,
  createBookingRequest,
  findUserByEmail,
  getBookings,
  AmpecoError,
  EvseAvailability,
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
    const availability = await checkBookingAvailability(locationId, {
      startAfter: startAt,
      endBefore: endAt,
    });

    // Validate the requested slot is actually available.
    // The response contains available slots per EVSE.
    if (availability.data && Array.isArray(availability.data)) {
      const requestedStart = new Date(startAt).getTime();
      const requestedEnd = new Date(endAt).getTime();

      function evseHasSlot(evse: EvseAvailability): boolean {
        if (!evse.availableSlots || !Array.isArray(evse.availableSlots)) {
          return false;
        }
        return evse.availableSlots.some((slot) => {
          const slotStart = new Date(slot.startAt).getTime();
          const slotEnd = new Date(slot.endAt).getTime();
          return slotStart <= requestedStart && slotEnd >= requestedEnd;
        });
      }

      if (evseId) {
        // Specific EVSE requested — check that one
        const evseData = availability.data.find(
          (e: EvseAvailability) => e.evseId === evseId
        );
        if (!evseData || !evseHasSlot(evseData)) {
          return NextResponse.json(
            {
              error: "Slot unavailable",
              message:
                "The selected charger is not available for the requested time. Please choose a different time or charger.",
            },
            { status: 409 }
          );
        }
      } else {
        // No specific EVSE — check if any EVSE has the slot
        const anyAvailable = availability.data.some(evseHasSlot);
        if (!anyAvailable) {
          return NextResponse.json(
            {
              error: "Slot unavailable",
              message:
                "No chargers are available for the requested time. Please choose a different time.",
            },
            { status: 409 }
          );
        }
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
