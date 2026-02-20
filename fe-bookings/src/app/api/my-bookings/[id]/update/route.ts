import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  getBooking,
  createBookingRequest,
  AmpecoError,
} from "@/lib/ampeco";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const bookingId = parseInt(params.id);
  if (isNaN(bookingId)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, startAt, endAt } = body;
  if (!email || !startAt || !endAt) {
    return NextResponse.json(
      { error: "email, startAt, and endAt are required" },
      { status: 400 }
    );
  }

  try {
    // Verify ownership
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "no_account" }, { status: 404 });
    }

    const bookingRes = await getBooking(bookingId);
    if (bookingRes.data.userId !== user.id) {
      return NextResponse.json(
        { error: "forbidden", message: "This booking does not belong to the provided email." },
        { status: 403 }
      );
    }

    const res = await createBookingRequest({
      type: "update",
      bookingId,
      startAt,
      endAt,
    });

    return NextResponse.json({
      bookingRequestId: res.data.id,
      status: res.data.status,
    });
  } catch (err) {
    if (err instanceof AmpecoError) {
      return NextResponse.json(
        { error: "Update failed", details: err.body },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
