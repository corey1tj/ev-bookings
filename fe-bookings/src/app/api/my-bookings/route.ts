import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  getBookings,
  AmpecoError,
} from "@/lib/ampeco";

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
        {
          error: "no_account",
          message:
            "No driver account found for this email. Please sign up in the Future Energy driver app first.",
        },
        { status: 404 }
      );
    }

    const res = await getBookings({
      "filter[userId]": String(user.id),
    });

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
