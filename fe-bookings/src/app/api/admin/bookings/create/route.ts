import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  checkBookingAvailability,
  createBookingRequest,
  AmpecoError,
  EvseAvailability,
} from "@/lib/ampeco";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

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
    // 1. Look up user by email
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "no_account", message: "No driver account found for this email." },
        { status: 404 }
      );
    }

    // 2. Check availability
    const availability = await checkBookingAvailability(locationId, {
      startAfter: startAt,
      endBefore: endAt,
    });

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
        const evseData = availability.data.find(
          (e: EvseAvailability) => e.evseId === evseId
        );
        if (!evseData || !evseHasSlot(evseData)) {
          return NextResponse.json(
            { error: "Slot unavailable", message: "The selected charger is not available for the requested time." },
            { status: 409 }
          );
        }
      } else {
        const anyAvailable = availability.data.some(evseHasSlot);
        if (!anyAvailable) {
          return NextResponse.json(
            { error: "Slot unavailable", message: "No chargers are available for the requested time." },
            { status: 409 }
          );
        }
      }
    }

    // 3. Create booking
    const bookingRes = await createBookingRequest({
      type: "create",
      userId: user.id,
      locationId,
      startAt,
      endAt,
      evseId: evseId || undefined,
    });

    return NextResponse.json(
      { bookingRequestId: bookingRes.data.id, status: bookingRes.data.status },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AmpecoError) {
      return NextResponse.json(
        { error: "Booking failed", details: err.body },
        { status: err.status }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
