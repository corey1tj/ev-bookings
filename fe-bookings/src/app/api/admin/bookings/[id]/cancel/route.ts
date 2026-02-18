import { NextRequest, NextResponse } from "next/server";
import { createBookingRequest, AmpecoError } from "@/lib/ampeco";
import { requireAdmin } from "@/lib/admin-auth";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const bookingId = parseInt(params.id);
  if (isNaN(bookingId)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  try {
    // Cancel is a booking request with type: "cancel" + bookingId
    const res = await createBookingRequest({
      type: "cancel",
      bookingId,
    });

    return NextResponse.json({
      bookingRequestId: res.data.id,
      status: res.data.status,
    });
  } catch (err) {
    if (err instanceof AmpecoError) {
      return NextResponse.json(
        { error: "Cancel failed", details: err.body },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
