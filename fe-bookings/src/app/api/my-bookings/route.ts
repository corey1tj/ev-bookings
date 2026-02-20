import { NextRequest, NextResponse } from "next/server";
import { getBookings, findUserByEmail, AmpecoError } from "@/lib/ampeco";
import { enrichBookings } from "@/lib/enrich-bookings";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json(
      { error: "email query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "no_account" },
        { status: 404 }
      );
    }

    const bookingsRes = await getBookings({
      "filter[userId]": String(user.id),
    });
    const enriched = await enrichBookings(bookingsRes.data);
    return NextResponse.json(enriched);
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
