/**
 * Shared booking enrichment logic.
 * Resolves location names, EVSE details, and evseId (via booking requests)
 * for an array of bookings from the Ampeco API.
 */

import {
  getBookingRequests,
  getLocation,
  getChargePoints,
  getChargePointEVSEs,
  localized,
  type AmpecoBooking,
} from "@/lib/ampeco";
import type { BookingLocation, BookingEvse, EnrichedBooking } from "@/lib/types";

export async function enrichBookings(
  bookings: AmpecoBooking[]
): Promise<EnrichedBooking[]> {
  if (bookings.length === 0) return [];

  // Fetch booking requests to build bookingId → evseId map
  const requestsRes = await getBookingRequests();
  const bookingEvseMap = new Map<number, number>();
  for (const req of requestsRes.data) {
    if (
      req.type === "create" &&
      req.status === "approved" &&
      req.bookingId &&
      req.evseId
    ) {
      bookingEvseMap.set(req.bookingId, req.evseId);
    }
  }

  // Collect unique location IDs
  const locationIds = [...new Set(bookings.map((b) => b.locationId))];

  // Fetch location details and EVSEs for each unique location in parallel
  const locationDataMap = new Map<number, BookingLocation>();
  const evseDataMap = new Map<number, BookingEvse>();

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
  return bookings.map((b) => {
    const evseId = bookingEvseMap.get(b.id);
    return {
      ...b,
      evseId: evseId ?? null,
      location: locationDataMap.get(b.locationId) ?? null,
      evse: evseId ? evseDataMap.get(evseId) ?? null : null,
    };
  });
}
