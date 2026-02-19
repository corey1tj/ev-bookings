# Ampeco Public API Reference — Booking Endpoints

> **Source:** `@ampeco/public-api-mcp` v3.108.0 (OpenAPI spec v3.108.0)
>
> This document covers the API endpoints used by the EV Bookings application. For the full 449-endpoint API, use the MCP server directly.

---

## Table of Contents

- [Booking Availability](#booking-availability)
- [Booking Requests](#booking-requests)
- [Confirmed Bookings](#confirmed-bookings)
- [Locations](#locations)
- [Charge Points & EVSEs](#charge-points--evses)
- [Users](#users)
- [Pagination](#pagination)
- [Error Responses](#error-responses)

---

## Booking Availability

### Check Booking Availability

```
POST /actions/locations/v2.0/{location}/check-booking-availability
```

Returns available time slots for each bookable EVSE at a location within a given time frame.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `location` | integer | Yes | Location ID |

**Request Body:**

```json
{
  "startAfter": "2026-03-01T08:00:00Z",
  "endBefore": "2026-03-01T18:00:00Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `startAfter` | datetime | Yes | Start of the time frame to check |
| `endBefore` | datetime | Yes | End of the time frame (max 7 days from startAfter) |

**Response (200):**

```json
{
  "data": [
    {
      "evseId": 15,
      "availableSlots": [
        {
          "startAt": "2026-03-01T08:00:00Z",
          "endAt": "2026-03-01T10:00:00Z"
        },
        {
          "startAt": "2026-03-01T12:00:00Z",
          "endAt": "2026-03-01T18:00:00Z"
        }
      ]
    },
    {
      "evseId": 16,
      "availableSlots": [
        {
          "startAt": "2026-03-01T08:00:00Z",
          "endAt": "2026-03-01T18:00:00Z"
        }
      ]
    }
  ]
}
```

Each item in `data` represents one bookable EVSE. `availableSlots` contains the open time windows — gaps indicate existing bookings.

**Error Responses:** 400, 401, 403, 404, 422, 429

---

## Booking Requests

Booking requests are the primary mechanism for creating, updating, and cancelling bookings. A single endpoint handles all three operations via a `type` discriminator.

### List Booking Requests

```
GET /resources/booking-requests/v1.0
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter[status]` | string | `pending`, `approved`, `rejected` |
| `filter[userId]` | integer | Filter by user ID |
| `filter[locationId]` | integer | Filter by location ID |
| `filter[startAfter]` | datetime | Requests with start time after this date |
| `filter[startBefore]` | datetime | Requests with start time before this date |
| `filter[endAfter]` | datetime | Requests with end time after this date |
| `filter[endBefore]` | datetime | Requests with end time before this date |
| `filter[createdAfter]` | datetime | Requests created after this date |
| `filter[createdBefore]` | datetime | Requests created before this date |
| `filter[externalId]` | string | External identifier (e.g., OCPI request_id) |
| `per_page` | integer | Items per page (1-100, default: 100) |
| `cursor` | string | Cursor for pagination (from `links.next`) |

**Response (200):**

```json
{
  "data": [
    {
      "id": 1,
      "type": "create",
      "status": "approved",
      "userId": 42,
      "locationId": 7,
      "startAt": "2026-03-01T10:00:00Z",
      "endAt": "2026-03-01T11:00:00Z",
      "evseId": 15,
      "createdAt": "2026-02-28T14:30:00Z",
      "lastUpdatedAt": "2026-02-28T14:30:01Z"
    }
  ],
  "links": {
    "next": "..."
  }
}
```

### Create Booking Request

```
POST /resources/booking-requests/v1.0
```

Polymorphic endpoint — the `type` field determines the operation.

#### Type: `"create"` — New Booking

**Request Body:**

```json
{
  "type": "create",
  "userId": 42,
  "locationId": 7,
  "startAt": "2026-03-01T10:00:00Z",
  "endAt": "2026-03-01T11:00:00Z",
  "evseId": 15
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"create"` | Yes | Discriminator |
| `userId` | integer | Yes | User to book for |
| `locationId` | integer | Yes | Target location |
| `startAt` | datetime | Yes | Booking start time |
| `endAt` | datetime | Yes | Booking end time |
| `evseId` | integer | No | Specific EVSE (port) to book |
| `evseCriteria` | object | No | Auto-assign EVSE by criteria (ignored when `evseId` is set) |
| `parkingSpaceCriteria` | object | No | Parking space requirements for EVSE selection |
| `externalId` | string | No | External identifier (max 255 chars) |
| `authorizedTokenIds` | integer[] | No | OCPI token IDs authorized for this booking |

**`evseCriteria` object:**

| Field | Type | Description |
|-------|------|-------------|
| `currentType` | `"ac"` \| `"dc"` | AC or DC charging |
| `minPower` | number | Minimum power in kW |
| `maxPower` | number | Maximum power in kW |
| `connectorType` | string | Connector type (see below) |

**Supported connector types:** `type1`, `type2`, `type3`, `chademo`, `ccs1`, `ccs2`, `schuko`, `nacs`, `cee16`, `cee32`, `j1772`, `inductive`, `nema-5-20`, `type-e-french`, `type-g-british`, `type-j-swiss`, `avcon`, `gb-t-ac`, `gb-t-dc`, `chaoji`, `nema-6-30`, `nema-6-50`

**`parkingSpaceCriteria` object:**

| Field | Type | Description |
|-------|------|-------------|
| `vehicleWeightKg` | integer | Vehicle weight in kg |
| `vehicleHeightCm` | integer | Vehicle height in cm |
| `vehicleLengthCm` | integer | Vehicle length in cm |
| `vehicleWidthCm` | integer | Vehicle width in cm |
| `vehicleType` | string | Vehicle category (see enum below) |
| `driveThroughRequired` | boolean | Must support drive-through |
| `refrigerationOutletRequired` | boolean | Must have refrigeration outlet |
| `dangerousGoodsAllowed` | boolean | Must allow dangerous goods |

**Vehicle types:** `two_and_three_wheel_vehicles_and_quadricycles`, `passenger_vehicles`, `passenger_vehicles_with_trailer`, `light_duty_vans`, `heavy_duty_tractor_units_without_trailer`, `heavy_duty_trucks_without_articulation_point`, `heavy_duty_trucks_with_trailer_attached`, `buses_or_motor_coaches`

**Response (201):**

```json
{
  "data": {
    "id": 1,
    "type": "create",
    "status": "pending",
    "userId": 42,
    "locationId": 7,
    "startAt": "2026-03-01T10:00:00Z",
    "endAt": "2026-03-01T11:00:00Z",
    "evseId": 15,
    "createdAt": "2026-02-28T14:30:00Z",
    "lastUpdatedAt": "2026-02-28T14:30:00Z"
  }
}
```

**Response fields (read-only):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | System-generated ID |
| `status` | string | `pending` → `approved` \| `rejected` |
| `rejectionReason` | string | Present only when status is `rejected` |
| `createdAt` | datetime | Creation timestamp |
| `lastUpdatedAt` | datetime | Last update timestamp |

#### Type: `"update"` — Modify Existing Booking

```json
{
  "type": "update",
  "bookingId": 100,
  "startAt": "2026-03-01T11:00:00Z",
  "endAt": "2026-03-01T12:00:00Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"update"` | Yes | Discriminator |
| `bookingId` | integer | Yes | Booking to modify |
| `userId` | integer | No | Updated user ID |
| `startAt` | datetime | No | Updated start time |
| `endAt` | datetime | No | Updated end time |
| `externalId` | string | No | External identifier |
| `authorizedTokenIds` | integer[] | No | Updated authorized tokens |

#### Type: `"cancel"` — Cancel Existing Booking

```json
{
  "type": "cancel",
  "bookingId": 100
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"cancel"` | Yes | Discriminator |
| `bookingId` | integer | Yes | Booking to cancel |
| `externalId` | string | No | External identifier |

### Read Booking Request

```
GET /resources/booking-requests/v1.0/{bookingRequest}
```

Returns the current state of a booking request. Use this to poll for status changes (`pending` → `approved`/`rejected`).

---

## Confirmed Bookings

Ampeco creates confirmed booking records when a booking request is approved. These are read-only from the API consumer's perspective.

### List Bookings

```
GET /resources/bookings/v1.0
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter[status]` | string | `accepted`, `reserved`, `completed`, `cancelled`, `no-show`, `failed` |
| `filter[userId]` | integer | Filter by user ID |
| `filter[locationId]` | integer | Filter by location ID |
| `filter[startAfter]` | datetime | Bookings starting after this date |
| `filter[startBefore]` | datetime | Bookings starting before this date |
| `filter[endAfter]` | datetime | Bookings ending after this date |
| `filter[endBefore]` | datetime | Bookings ending before this date |
| `per_page` | integer | Items per page (1-100, default: 100) |
| `cursor` | string | Cursor for pagination |

**Response (200):**

```json
{
  "data": [
    {
      "id": 100,
      "userId": 42,
      "locationId": 7,
      "startAt": "2026-03-01T10:00:00Z",
      "endAt": "2026-03-01T11:00:00Z",
      "status": "accepted",
      "evse": {
        "id": 15,
        "physicalReference": "CP-01-A",
        "label": "Charger 1 - Port A",
        "currentType": "dc",
        "networkId": "1",
        "status": "enabled",
        "bookingEnabled": true,
        "connectors": [
          {
            "id": 1,
            "type": "ccs1",
            "maxPowerWh": 150000
          }
        ]
      },
      "authorizedTokens": [],
      "createdAt": "2026-02-28T14:30:01Z",
      "lastUpdatedAt": "2026-02-28T14:30:01Z"
    }
  ],
  "links": {
    "next": "..."
  }
}
```

**Booking statuses:**

| Status | Description |
|--------|-------------|
| `accepted` | Booking confirmed, waiting for scheduled time |
| `reserved` | Within the booking window, EVSE reserved for the user |
| `completed` | Charging session completed successfully |
| `cancelled` | Booking was cancelled |
| `no-show` | User did not show up during the booking window |
| `failed` | Booking could not be fulfilled |

### Read Booking

```
GET /resources/bookings/v1.0/{booking}
```

Returns detailed booking information including nested EVSE data.

---

## Locations

### List Locations

```
GET /resources/locations/v2.0
```

Returns all locations. Supports pagination.

**Response data fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Location ID |
| `name` | object[] | Localized name (`{locale, translation}`) |
| `description` | object[] | Localized description |
| `geoposition` | object | `{latitude, longitude}` |
| `address` | object[] | Localized street address |
| `city` | object[] | Localized city name |
| `state` | object[] | Localized state/province |
| `country` | string | Country code |
| `postalCode` | string | Postal/ZIP code |
| `timezone` | string | IANA timezone |
| `roamingOperatorId` | integer | Operator ID |
| `chargingZones` | object[] | Charging zones at this location |

### Read Location

```
GET /resources/locations/v2.0/{location}
```

### Charging Zones

```
GET /resources/locations/v2.0/{location}/charging-zones
```

Lists charging zones within a location.

---

## Charge Points & EVSEs

### List Charge Points

```
GET /resources/charge-points/v2.0
```

Returns all charge points. Filter by `locationId` to get charge points at a specific location.

**Key response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Charge point ID |
| `name` | string | Charge point name |
| `type` | string | `public`, `private`, `personal` |
| `status` | string | Operational status |
| `locationId` | integer | Parent location ID |
| `networkStatus` | string | Network connectivity status |

### List EVSEs for a Charge Point

```
GET /resources/charge-points/v2.0/{chargePoint}/evses
```

Returns all EVSEs (ports) belonging to a charge point. This is the key endpoint for building the port selector in the booking form.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string[] | `chargingProfile`, `connectors` — include related data |
| `per_page` | integer | Items per page (1-100, default: 100) |
| `cursor` | string | Cursor for pagination |

**Response data fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | EVSE ID (used as `evseId` in booking requests) |
| `physicalReference` | string | User-facing identifier at the location |
| `label` | string | Display label for mobile app |
| `currentType` | `"ac"` \| `"dc"` | Current type |
| `networkId` | string | OCPP EVSE identifier |
| `status` | string | `enabled`, `disabled`, `out of order` |
| `bookingEnabled` | boolean | Whether this EVSE accepts bookings |
| `allowsReservation` | boolean | Whether this EVSE accepts reservations |
| `tariffGroupId` | integer | Associated tariff group |
| `powerOptions` | object | Power capabilities (maxPower, maxVoltage, maxAmperage) |
| `connectors` | object[] | Connector details (when `include=connectors`) |

**Connector fields (nested):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Connector ID |
| `type` | string | Connector type (ccs1, ccs2, type2, nacs, etc.) |
| `maxPowerWh` | integer | Maximum power in Wh |

### List All EVSEs

```
GET /resources/evses/v2.1
```

Lists all EVSEs across all charge points. Useful for global views.

### Read Single EVSE

```
GET /resources/evses/v2.1/{evse}
```

---

## Users

### List Users (with email filter)

```
GET /resources/users/v1.0?filter[email]=driver@example.com
```

This is how the booking flow looks up a driver by their email address. Returns an empty `data` array if no user is found.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter[email]` | string | Exact email match |
| `filter[userId]` | integer | Filter by user group |
| `filter[partnerId]` | integer | Filter by partner |
| `filter[externalId]` | string | Filter by external ID |
| `filter[lastUpdatedAfter]` | datetime | Updated after this date |
| `filter[lastUpdatedBefore]` | datetime | Updated before this date |
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (1-100, default: 100) |

**Response data fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User ID |
| `email` | string | Email address |
| `emailVerified` | datetime \| null | Verification timestamp |
| `firstName` | string \| null | First name |
| `lastName` | string \| null | Last name |
| `phone` | string \| null | Phone number |
| `country` | string \| null | Country |
| `status` | string | `enabled`, `disabled` |
| `balance` | number | Account balance |
| `locale` | string \| null | Preferred locale |

---

## Pagination

All list endpoints support cursor-based pagination:

```
GET /resources/bookings/v1.0?per_page=25
```

Response includes pagination links:

```json
{
  "data": [...],
  "links": {
    "next": "https://instance.ampeco.tech/public-api/resources/bookings/v1.0?cursor=eyJ..."
  }
}
```

Use the `links.next` URL directly for the next page. Do not construct cursor values manually.

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `per_page` | 100 | 100 | Items per page |
| `cursor` | — | — | Opaque cursor from `links.next` |

---

## Error Responses

All endpoints return standard error structures:

### 401 — Unauthorized

```json
{
  "message": "Access token is missing or invalid"
}
```

### 403 — Forbidden

```json
{
  "message": "This action is unauthorized."
}
```

### 404 — Not Found

```json
{
  "message": "The record is not found"
}
```

### 422 — Validation Error

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "startAt": ["The start at field is required."],
    "endAt": ["The end at must be after start at."]
  }
}
```

### 429 — Rate Limited

```json
{
  "message": "Too many requests. Please try again later."
}
```

Check `X-RateLimit-*` headers for rate limit information.

---

## Booking Flow Summary

```
1. GET  /resources/locations/v2.0                        → List available sites
2. GET  /resources/charge-points/v2.0?filter[locationId]= → Get charge points at site
3. GET  /resources/charge-points/v2.0/{id}/evses          → Get EVSEs per charge point
   Filter client-side: evse.bookingEnabled === true
4. POST /actions/locations/v2.0/{id}/check-booking-availability
   Body: { startAfter, endBefore }                       → Get available time slots
5. GET  /resources/users/v1.0?filter[email]=              → Look up driver by email
   If empty: show "sign up in driver app" message
6. POST /resources/booking-requests/v1.0
   Body: { type: "create", userId, locationId, startAt, endAt, evseId }
                                                          → Create booking request
7. GET  /resources/booking-requests/v1.0/{id}             → Poll for approval
   status: pending → approved | rejected
8. GET  /resources/bookings/v1.0?filter[userId]=          → Read confirmed booking
```

---

## API Tags — Full Index

The Ampeco Public API (v3.108.0) contains 449 endpoints organized into 82 tags. The booking-relevant tags are highlighted.

| Tag | Endpoints | Used by EV Bookings |
|-----|-----------|---------------------|
| **action / location** | 1 | Yes — availability check |
| **resource / booking requests** | 3 | Yes — create/list/read |
| **resource / bookings** | 2 | Yes — list/read confirmed |
| **resource / charge points** | 41 | Yes — list CPs, list EVSEs |
| **resource / evses** | 10 | Yes — EVSE details |
| **resource / locations** | 15 | Yes — site list/detail |
| **resource / users** | 12 | Yes — email lookup |
| action / charge point | 24 | No |
| action / circuit | 6 | No |
| action / evse | 3 | No |
| action / session | 2 | No |
| action / user | 8 | No |
| notifications | 10 | No |
| resource / authorizations | 3 | No |
| resource / cdrs | 2 | No |
| resource / circuits | 21 | No |
| resource / currencies | 5 | No |
| resource / id tags | 5 | No |
| resource / invoices | 2 | No |
| resource / parking spaces | 5 | No |
| resource / partners | 10 | No |
| resource / reservations | 2 | No |
| resource / sessions | 3 | No |
| resource / subscriptions | 2 | No |
| resource / tariffs | 11 | No |
| resource / transactions | 4 | No |
| resource / vouchers | 10 | No |
| *(and 55 more)* | | |
