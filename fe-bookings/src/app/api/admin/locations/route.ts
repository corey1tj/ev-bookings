import { NextRequest, NextResponse } from "next/server";
import { getLocationsWithBookableEVSEs, localized, AmpecoError } from "@/lib/ampeco";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const locations = await getLocationsWithBookableEVSEs();
    const data = locations.map((loc) => ({
      id: loc.id,
      name: localized(loc.name),
      address: localized(loc.address),
      city: loc.city,
      state: loc.state,
      timezone: loc.timezone,
    }));
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AmpecoError) {
      return NextResponse.json({ error: "Failed to load locations" }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
