import { NextRequest, NextResponse } from "next/server";
import { createBookingRequest } from "@/lib/ampeco";
import { handleApiError } from "@/lib/api-helpers";
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { startAt, endAt } = body;
  if (!startAt || !endAt) {
    return NextResponse.json(
      { error: "startAt and endAt are required" },
      { status: 400 }
    );
  }

  try {
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
    return handleApiError(err, "Update failed");
  }
}
