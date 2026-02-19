import { NextRequest, NextResponse } from "next/server";
import {
  getBookings,
  getBookingRequests,
  getLocation,
  getChargePoints,
  getChargePointEVSEs,
  localized,
  AmpecoError,
} from "@/lib/ampeco";
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
    // Fetch bookings and booking requests in parallel
    const [bookingsRes, requestsRes] = await Promise.all([
      getBookings(Object.keys(params).length ? params : undefined),
      getBookingRequests(),
    ]);
    const bookings = bookingsRes.data;

    // Build a map from bookingId → evseId using approved "create" requests
    const bookingEvseMap = new Map<number, number>();
    for (const req of requestsRes.data) {
      if (req.type === "create" && req.status === "approved" && req.bookingId && req.evseId) {
        bookingEvseMap.set(req.bookingId, req.evseId);
      }
    }

    // Collect unique location IDs
    const locationIds = [...new Set(bookings.map((b) => b.locationId))];

    // Fetch location details and EVSEs for each unique location in parallel
    const locationDataMap = new Map<
      number,
      { name: string; city: string; state: string; timezone: string }
    >();
    const evseDataMap = new Map<
      number,
      {
        chargePointName: string;
        label?: string;
        physicalReference?: string;
        connectorType: string;
        maxPowerKw: number;
        currentType: string;
      }
    >();

    await Promise.all(
      locationIds.map(async (locId) => {
        try {
          const [locRes, chargePointsRes] = await Promise.all([
            getLocation(locId),
            getChargePoints(locId),
          ]);
          locationDataMap.set(locId, {
            name: localized(locRes.data.name),
            city: locRes.data.city,
            state: locRes.data.state,
            timezone: locRes.data.timezone,
          });
          // Fetch ALL EVSEs (not just bookable) so we can match any booking
          const evseResults = await Promise.all(
            chargePointsRes.data.map((cp) => getChargePointEVSEs(cp.id))
          );
          for (let i = 0; i < evseResults.length; i++) {
            const cp = chargePointsRes.data[i];
            for (const evse of evseResults[i].data) {
              evseDataMap.set(evse.id, {
                chargePointName: cp.name ?? "",
                label: evse.label,
                physicalReference: evse.physicalReference,
                connectorType: evse.connectorType,
                maxPowerKw: evse.powerOptions?.maxPower
                  ? evse.powerOptions.maxPower / 1000
                  : evse.maxPowerKw,
                currentType: evse.currentType,
              });
            }
          }
        } catch {
          // If enrichment fails for a location, leave it out — IDs still shown
        }
      })
    );

    // Enrich bookings with location and EVSE details
    const enriched = bookings.map((b) => {
      const evseId = bookingEvseMap.get(b.id);
      return {
        ...b,
        evseId: evseId ?? null,
        location: locationDataMap.get(b.locationId) ?? null,
        evse: evseId ? evseDataMap.get(evseId) ?? null : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    if (err instanceof AmpecoError) {
      return NextResponse.json({ error: "Failed to load bookings" }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
