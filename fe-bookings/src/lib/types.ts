/** Enriched booking types returned by the /api/my-bookings and /api/admin/bookings endpoints. */

export interface BookingLocation {
  name: string;
  city: string;
  state: string;
  timezone: string;
}

export interface BookingEvse {
  chargePointName: string;
  label?: string;
  physicalReference?: string;
  connectorType: string;
  maxPowerKw: number;
  currentType: string;
}

export interface EnrichedBooking {
  id: number;
  locationId: number;
  evseId: number | null;
  userId: number;
  startAt: string;
  endAt: string;
  status: string;
  location: BookingLocation | null;
  evse: BookingEvse | null;
  [key: string]: unknown;
}
