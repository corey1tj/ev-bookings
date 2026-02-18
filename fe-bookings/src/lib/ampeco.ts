/**
 * Ampeco Public API client.
 * Server-side only — keeps bearer token out of the browser.
 *
 * Endpoint paths and types derived from Ampeco OpenAPI spec (v3.143.0).
 */

const API_URL = process.env.AMPECO_API_URL!;
const API_TOKEN = process.env.AMPECO_API_TOKEN!;

// ─── Error class ─────────────────────────────────────────

class AmpecoError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "AmpecoError";
    this.status = status;
    this.body = body;
  }
}

// ─── Base request helper ─────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new AmpecoError(`Ampeco API ${res.status}: ${path}`, res.status, body);
  }

  return res.json();
}

// ─── Types ───────────────────────────────────────────────

// Locations (v1.1)
export interface AmpecoLocation {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  [key: string]: unknown;
}

// Charge Points (v2.0)
export interface AmpecoChargePoint {
  id: number;
  locationId: number;
  name?: string;
  [key: string]: unknown;
}

// EVSEs (v2.0 via charge point)
export interface AmpecoEVSE {
  id: number;
  networkId: string;
  status: string;
  connectorType: string;
  maxPowerKw: number;
  bookingEnabled: boolean;
  [key: string]: unknown;
}

// Booking availability (v2.0)
export interface AvailabilityRequest {
  startAfter: string; // ISO datetime
  endBefore: string; // ISO datetime, max 7-day window
}

// Booking Requests — polymorphic via `type` discriminator
export interface BookingRequestCreate {
  type: "create";
  userId: number;
  locationId: number;
  startAt: string; // ISO datetime
  endAt: string; // ISO datetime
  evseId?: number;
  evseCriteria?: {
    currentType?: "ac" | "dc" | null;
    minPower?: number;
    maxPower?: number;
    connectorType?: string | null;
  };
  parkingSpaceCriteria?: {
    vehicleWeightKg?: number;
    vehicleHeightCm?: number;
    vehicleLengthCm?: number;
    vehicleWidthCm?: number;
    vehicleType?: string | null;
    driveThroughRequired?: boolean;
  };
  authorizedTokenIds?: number[];
  externalId?: string;
}

export interface BookingRequestUpdate {
  type: "update";
  bookingId: number;
  userId?: number;
  startAt?: string;
  endAt?: string;
  authorizedTokenIds?: number[];
  externalId?: string;
}

export interface BookingRequestCancel {
  type: "cancel";
  bookingId: number;
  externalId?: string;
}

export type BookingRequestBody =
  | BookingRequestCreate
  | BookingRequestUpdate
  | BookingRequestCancel;

// Booking request statuses
export type BookingRequestStatus = "pending" | "approved" | "rejected";

export interface AmpecoBookingRequest {
  id: number;
  type: "create" | "update" | "cancel";
  status: BookingRequestStatus;
  rejectionReason?: string;
  createdAt: string;
  lastUpdatedAt: string;
  userId?: number;
  locationId?: number;
  bookingId?: number;
  startAt?: string;
  endAt?: string;
  evseId?: number;
  [key: string]: unknown;
}

// Confirmed bookings
export type BookingStatus =
  | "accepted"
  | "reserved"
  | "completed"
  | "cancelled"
  | "no-show"
  | "failed";

export interface AmpecoBooking {
  id: number;
  status: BookingStatus;
  userId: number;
  locationId: number;
  evseId: number;
  startAt: string;
  endAt: string;
  [key: string]: unknown;
}

// Users
export interface AmpecoUser {
  id: number;
  email: string;
  [key: string]: unknown;
}

// Paginated response envelope
interface PaginatedResponse<T> {
  data: T[];
  links?: { next?: string };
  meta?: { cursor?: string; per_page?: number };
}

// ─── Locations (v1.1) ────────────────────────────────────

export async function getLocations(): Promise<PaginatedResponse<AmpecoLocation>> {
  return request("/resources/locations/v1.1");
}

export async function getLocation(
  id: number
): Promise<{ data: AmpecoLocation }> {
  return request(`/resources/locations/v1.1/${id}`);
}

// ─── Charge Points & EVSEs ───────────────────────────────

export async function getChargePoints(
  locationId: number
): Promise<PaginatedResponse<AmpecoChargePoint>> {
  return request(
    `/resources/charge-points/v2.0?filter[locationId]=${locationId}`
  );
}

export async function getChargePointEVSEs(
  chargePointId: number
): Promise<PaginatedResponse<AmpecoEVSE>> {
  return request(`/resources/charge-points/v2.0/${chargePointId}/evses`);
}

// ─── Booking Availability (v2.0) ─────────────────────────
// Returns available time slots for each bookable EVSE at the location.
// Time frame limited to 7 days max.

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
}

export interface EvseAvailability {
  evseId: number;
  availableSlots: AvailabilitySlot[];
  [key: string]: unknown;
}

export interface AvailabilityResponse {
  data: EvseAvailability[];
}

export async function checkBookingAvailability(
  locationId: number,
  params: AvailabilityRequest
): Promise<AvailabilityResponse> {
  return request(
    `/actions/locations/v2.0/${locationId}/check-booking-availability`,
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
}

// ─── Booking Requests (v1.0) ─────────────────────────────
// Single endpoint handles create, update, and cancel via `type` discriminator.
//
//   type: "create"  → new booking (requires userId, locationId, startAt, endAt)
//   type: "update"  → modify booking (requires bookingId)
//   type: "cancel"  → cancel booking (requires bookingId)

export async function createBookingRequest(
  body: BookingRequestBody
): Promise<{ data: AmpecoBookingRequest }> {
  return request("/resources/booking-requests/v1.0", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getBookingRequests(
  params?: Record<string, string>
): Promise<PaginatedResponse<AmpecoBookingRequest>> {
  const query = params
    ? "?" + new URLSearchParams(params).toString()
    : "";
  return request(`/resources/booking-requests/v1.0${query}`);
}

export async function getBookingRequest(
  id: number
): Promise<{ data: AmpecoBookingRequest }> {
  return request(`/resources/booking-requests/v1.0/${id}`);
}

// ─── Bookings (v1.0) — read-only ────────────────────────
// Bookings are created by Ampeco when a booking request is approved.
// Statuses: accepted, reserved, completed, cancelled, no-show, failed

export async function getBookings(
  params?: Record<string, string>
): Promise<PaginatedResponse<AmpecoBooking>> {
  const query = params
    ? "?" + new URLSearchParams(params).toString()
    : "";
  return request(`/resources/bookings/v1.0${query}`);
}

export async function getBooking(
  id: number
): Promise<{ data: AmpecoBooking }> {
  return request(`/resources/bookings/v1.0/${id}`);
}

// ─── Users (v1.0) ────────────────────────────────────────

/**
 * Look up a user by email. Returns null if not found.
 * Drivers must already have an account in the Ampeco driver app —
 * we do NOT create users on the fly.
 */
export async function findUserByEmail(
  email: string
): Promise<AmpecoUser | null> {
  const res: PaginatedResponse<AmpecoUser> = await request(
    `/resources/users/v1.0?filter[email]=${encodeURIComponent(email)}`
  );
  return res.data.length > 0 ? res.data[0] : null;
}

export { AmpecoError };
