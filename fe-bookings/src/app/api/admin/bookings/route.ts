import { NextRequest, NextResponse } from "next/server";
import { getBookings, AmpecoError } from "@/lib/ampeco";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const searchParams = req.nextUrl.searchParams;
  const params: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  try {
    const res = await getBookings(Object.keys(params).length ? params : undefined);
    return NextResponse.json(res.data);
  } catch (err) {
    if (err instanceof AmpecoError) {
      return NextResponse.json({ error: "Failed to load bookings" }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
