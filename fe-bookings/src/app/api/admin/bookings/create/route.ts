import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  checkBookingAvailability,
  createBookingRequest,
} from "@/lib/ampeco";
import { handleApiError } from "@/lib/api-helpers";
import { validateSlotAvailable } from "@/lib/availability";
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
      const result = validateSlotAvailable(availability.data, startAt, endAt, evseId);
      if (!result.available) {
        return NextResponse.json(
          { error: "Slot unavailable", message: result.message },
          { status: 409 }
        );
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
    return handleApiError(err, "Booking failed");
  }
}
