import { NextRequest, NextResponse } from "next/server";
import { getBooking, AmpecoError } from "@/lib/ampeco";

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  try {
    const res = await getBooking(id);
    return NextResponse.json(res.data);
  } catch (err) {
    if (err instanceof AmpecoError) {
      if (err.status === 404) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to load booking" }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
