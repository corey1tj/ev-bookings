import { NextRequest, NextResponse } from "next/server";
import { getLocationsWithBookableEVSEs, localized } from "@/lib/ampeco";
import { handleApiError } from "@/lib/api-helpers";
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
    return handleApiError(err, "Failed to load locations");
  }
}
