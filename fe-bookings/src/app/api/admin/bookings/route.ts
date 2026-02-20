import { NextRequest, NextResponse } from "next/server";
import { getBookings } from "@/lib/ampeco";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin-auth";
import { enrichBookings } from "@/lib/enrich-bookings";

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const searchParams = req.nextUrl.searchParams;
  const params: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  try {
    const bookingsRes = await getBookings(
      Object.keys(params).length ? params : undefined
    );
    const enriched = await enrichBookings(bookingsRes.data);
    return NextResponse.json(enriched);
  } catch (err) {
    return handleApiError(err, "Failed to load bookings");
  }
}
