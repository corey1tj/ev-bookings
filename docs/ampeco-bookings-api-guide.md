# Ampeco Bookings API — Capabilities & Project Integration Guide

> **MCP Source:** `@ampeco/public-api-mcp` (OpenAPI spec v3.143.0)
>
> This document provides a comprehensive reference for every Ampeco API capability related to the EV charging bookings domain, and maps each one to how the `ev-bookings` project uses (or does not yet use) it.

---

## Table of Contents

1. [Conceptual Overview](#1-conceptual-overview)
2. [Booking Lifecycle](#2-booking-lifecycle)
3. [Endpoint Reference](#3-endpoint-reference)
   - [3.1 Locations](#31-locations)
   - [3.2 Charge Points](#32-charge-points)
   - [3.3 EVSEs (Ports)](#33-evses-ports)
   - [3.4 Booking Availability](#34-booking-availability)
   - [3.5 Booking Requests](#35-booking-requests)
   - [3.6 Confirmed Bookings](#36-confirmed-bookings)
   - [3.7 Users](#37-users)
   - [3.8 Reservations (Related)](#38-reservations-related)
4. [Project Integration Map](#4-project-integration-map)
   - [4.1 API Client Layer](#41-api-client-layer)
   - [4.2 API Proxy Routes](#42-api-proxy-routes)
   - [4.3 Server Components](#43-server-components)
   - [4.4 Client Components](#44-client-components)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
   - [5.1 Driver Booking Flow](#51-driver-booking-flow)
   - [5.2 Admin Cancel Flow](#52-admin-cancel-flow)
   - [5.3 Site Detail Page Load](#53-site-detail-page-load)
6. [Unused API Capabilities](#6-unused-api-capabilities)
7. [Known Gaps & TODOs](#7-known-gaps--todos)

---

## 1. Conceptual Overview

Ampeco's booking system uses a **request-based architecture**. Consumers never create bookings directly — instead they submit **booking requests** that Ampeco processes asynchronously. The request/response cycle:

```
Consumer                        Ampeco
   │                               │
   │  POST booking-request         │
   │  { type: "create", ... }      │
   │──────────────────────────────>│
   │                               │  validates availability
   │  { status: "pending" }        │  checks business rules
   │<──────────────────────────────│
   │                               │
   │  GET booking-request/{id}     │  (poll or webhook)
   │──────────────────────────────>│
   │                               │
   │  { status: "approved" }       │  creates Booking record
   │<──────────────────────────────│
   │                               │
   │  GET bookings/v1.0            │
   │──────────────────────────────>│
   │  { id, status: "accepted" }   │
   │<──────────────────────────────│
```

**Key entities:**

| Entity | Purpose | Mutable via API? |
|--------|---------|------------------|
| **Location** | Physical charging site (address, coordinates, timezone) | Read-only |
| **Charge Point** | Hardware unit at a location (may have multiple ports) | Read-only |
| **EVSE** | Individual port/connector on a charge point | Read-only |
| **Booking Request** | Intent to create/update/cancel a booking | Write (POST) |
| **Booking** | Confirmed reservation of an EVSE for a time window | Read-only |
| **User** | Driver account (must exist in Ampeco) | Read-only (lookup) |

---

## 2. Booking Lifecycle

### Booking Request Statuses

| Status | Meaning | Transitions to |
|--------|---------|---------------|
| `pending` | Submitted, awaiting Ampeco processing | `approved`, `rejected` |
| `approved` | Request accepted; a Booking record was created | Terminal |
| `rejected` | Request denied (time conflict, invalid EVSE, etc.) | Terminal |

When a request is `rejected`, the `rejectionReason` field contains a human-readable explanation.

### Booking Statuses (Confirmed Bookings)

| Status | Meaning |
|--------|---------|
| `accepted` | Booking confirmed, waiting for the scheduled time window |
| `reserved` | Within the booking window — EVSE is actively reserved for the user |
| `completed` | Charging session finished successfully |
| `cancelled` | Booking was cancelled (via a `type: "cancel"` booking request) |
| `no-show` | Driver did not arrive during the booking window |
| `failed` | Booking could not be fulfilled (hardware error, etc.) |

### State Machine

```
Booking Request              Booking
─────────────────           ──────────────────

pending ──┬── approved ───> accepted
          │                    │
          └── rejected         ├── reserved ──┬── completed
                               │              └── no-show
                               │              └── failed
                               └── cancelled
```

---

## 3. Endpoint Reference

### 3.1 Locations

#### List Locations

```
GET /resources/locations/v2.0
```

Returns all charging locations. This is the entry point for the public booking UI.

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Location ID |
| `name` | `LocalizedText[]` | Multi-language name (`{locale, translation}`) |
| `description` | `LocalizedText[]` | Multi-language description |
| `shortDescription` | `LocalizedText[]` | Abbreviated description |
| `address` | `LocalizedText[]` | Street address |
| `streetAddress` | `LocalizedText[]` | Street-level address detail |
| `city` | string | City name |
| `region` | string | Region (non-US/AU/CA countries) |
| `state` | string | State/province (US, AU, CA, UM, RO only) |
| `country` | string | ISO country code |
| `postCode` | string | Postal/ZIP code |
| `geoposition` | `{latitude, longitude}` | GPS coordinates |
| `timezone` | string | IANA timezone (e.g. `America/New_York`) |
| `status` | string | Location status |
| `parkingType` | string \| null | See parking types below |
| `accessMethods` | string[] \| null | Physical access methods |
| `facilities` | string[] \| null | Nearby amenities |
| `workingHours` | object | Operating hours |
| `locationImage` | object | Primary image |
| `images` | object[] | Additional images (requires `include[]=images`) |
| `chargingZones` | object[] | Zone subdivisions (requires `include[]=chargingZones`) |
| `tags` | string[] | Location tags |
| `roamingOperatorId` | integer | Roaming operator ID |
| `externalId` | string | External system identifier |
| `lastUpdatedAt` | datetime | Last modification timestamp |

**Parking types:** `ALONG_MOTORWAY`, `PARKING_GARAGE`, `PARKING_LOT`, `ON_DRIVEWAY`, `ON_STREET`, `UNDERGROUND_GARAGE`

**Access methods:** `OPEN`, `TOKEN`, `LICENSE_PLATE`, `ACCESS_CODE`, `INTERCOM`, `PARKING_TICKET`

**Facilities:** `AIRPORT`, `BIKE_SHARING`, `BUS_STOP`, `CAFE`, `CARPOOL_PARKING`, `FUEL_STATION`, `HOTEL`, `MALL`, `METRO_STATION`, `MUSEUM`, `NATURE`, `PARKING_LOT`, `RECREATION_AREA`, `RESTAURANT`, `SPORT`, `SUPERMARKET`, `TAXI_STAND`, `TRAIN_STATION`, `TRAM_STOP`, `WIFI`

#### Read Location

```
GET /resources/locations/v2.0/{location}
```

Returns a single location by ID. Same response shape as the list endpoint, wrapped in `{ data: ... }`.

---

### 3.2 Charge Points

#### List Charge Points

```
GET /resources/charge-points/v2.0
```

**Key filter parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter[locationId]` | string | **Primary filter** — charge points at a specific location |
| `filter[type]` | string | `public`, `private`, `personal` |
| `filter[name]` | string | Exact name match |
| `filter[networkId]` | string | OCPP network identifier |
| `filter[chargingZoneId]` | string | Filter by charging zone |
| `filter[roaming]` | string | `true` for roaming-only, `false` for local-only |
| `filter[roamingOperatorIds]` | integer[] | Filter by roaming operator(s) |
| `filter[userId]` | string | Charge points owned by a user |
| `filter[partnerId]` | string | Charge points owned by a partner |
| `per_page` | integer | 1–100 (default: 100) |
| `cursor` | string | Pagination cursor |

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Charge point ID |
| `name` | string | Display name |
| `locationId` | integer | Parent location |
| `type` | string | `public`, `private`, `personal` |
| `status` | string | Operational status |
| `networkStatus` | string | Network connectivity |

---

### 3.3 EVSEs (Ports)

#### List EVSEs for a Charge Point

```
GET /resources/charge-points/v2.0/{chargePoint}/evses
```

Returns all EVSEs (individual ports) on a charge point. This is the critical endpoint for building the charger selector in the booking form.

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | EVSE ID — used as `evseId` in booking requests |
| `physicalReference` | string | User-facing label at the physical location |
| `label` | string | Display label for apps |
| `currentType` | `"ac"` \| `"dc"` | Current type |
| `networkId` | string | OCPP EVSE identifier (consecutive from 1) |
| `status` | string | `enabled`, `disabled`, `out of order` |
| `bookingEnabled` | boolean | **Whether this EVSE can be booked** |
| `allowsReservation` | boolean | Whether real-time reservations are enabled |
| `hardwareStatus` | string | Live hardware state (see below) |
| `tariffGroupId` | integer | Associated pricing tariff |
| `powerOptions` | object | Power capabilities (see below) |
| `connectors` | object[] | Physical connectors (see below) |
| `midMeterCertificationEndYear` | integer | MID meter certification expiry |
| `externalId` | string | External system identifier |
| `roamingOperatorId` | integer | Roaming operator (if applicable) |
| `createdAt` | datetime | Creation timestamp |
| `lastUpdatedAt` | datetime | Last modification timestamp |

**`powerOptions` object:**

| Field | Type | Description |
|-------|------|-------------|
| `maxPower` | integer | Maximum power in **Wh** (not kW) |
| `maxVoltage` | string | Voltage level (`230`, `380`, `400`, `480`, etc.) |
| `maxAmperage` | number | Maximum amperage |
| `phases` | string | `single_phase`, `three_phase`, `split_phase` |
| `phaseRotation` | string | Phase rotation (`RST`, `RTS`, `SRT`, `STR`, `TRS`, `TSR`) |
| `connectedPhase` | string | Active conductors (`L1`, `L2`, `L3`, `L1_L2`, `L1_L3`, `L2_L3`) |

**`connectors` array items:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Connector ID |
| `type` | string | Connector type (see supported types below) |
| `format` | string | `socket` or `cable` |
| `status` | string | `enabled`, `disabled` |

**Supported connector types:** `type1`, `type2`, `type3`, `chademo`, `ccs1`, `ccs2`, `schuko`, `nacs`, `cee16`, `cee32`, `j1772`, `inductive`, `nema-5-20`, `type-e-french`, `type-g-british`, `type-j-swiss`, `avcon`, `gb-t-ac`, `gb-t-dc`, `chaoji`, `nema-6-30`, `nema-6-50`

**Hardware status values:**

| Status | Meaning |
|--------|---------|
| `available` | Connector is free for a new user |
| `preparing` | User authenticated/cable inserted, no session yet |
| `charging` | Active charging session |
| `suspendedEV` | Charging paused by vehicle |
| `suspendedEVSE` | Charging paused by charger |
| `finishing` | Session ending, connector still occupied |
| `reserved` | EVSE reserved for a specific user |
| `unavailable` | Not available for use |
| `faulted` | Hardware error |
| `occupied` | Physically occupied |

#### Global EVSE Endpoints

```
GET /resources/evses/v2.1          # List all EVSEs across all charge points
GET /resources/evses/v2.1/{evse}   # Read a single EVSE by ID
```

These bypass the charge-point hierarchy for direct EVSE access.

---

### 3.4 Booking Availability

#### Check Booking Availability

```
POST /actions/locations/v2.0/{location}/check-booking-availability
```

Returns available time slots for **every bookable EVSE** at a location within a time window. This is the primary mechanism for showing drivers when chargers are free.

**Request body:**

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `startAfter` | datetime | Yes | Start of window |
| `endBefore` | datetime | Yes | End of window (max **7 days** from `startAfter`) |

**Response:**

```json
{
  "data": [
    {
      "evseId": 15,
      "availableSlots": [
        { "startAt": "2026-03-01T08:00:00Z", "endAt": "2026-03-01T10:00:00Z" },
        { "startAt": "2026-03-01T12:00:00Z", "endAt": "2026-03-01T18:00:00Z" }
      ]
    },
    {
      "evseId": 16,
      "availableSlots": [
        { "startAt": "2026-03-01T08:00:00Z", "endAt": "2026-03-01T18:00:00Z" }
      ]
    }
  ]
}
```

**Interpretation:**
- Each object in `data` represents one bookable EVSE at the location
- `availableSlots` contains contiguous free windows — gaps indicate existing bookings
- An EVSE with an empty `availableSlots` array is fully booked for the requested window
- An EVSE not present in `data` at all is either not bookable (`bookingEnabled: false`) or does not exist

**Validating a requested slot:** To confirm a specific time is available, check that the requested `[startAt, endAt]` range is fully contained within one of the EVSE's available slots:

```typescript
slot.startAt <= requestedStart && slot.endAt >= requestedEnd
```

---

### 3.5 Booking Requests

The booking request endpoint is **polymorphic** — a single `POST` endpoint handles three operations via the `type` discriminator field. This is the only write endpoint consumers use for bookings.

```
POST /resources/booking-requests/v1.0
```

#### Type: `"create"` — New Booking

Creates a new booking for a user at a location and time.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"create"` | Yes | Discriminator |
| `userId` | integer | Yes | Ampeco user ID (from user lookup) |
| `locationId` | integer | Yes | Target location |
| `startAt` | datetime | Yes | Booking start time |
| `endAt` | datetime | Yes | Booking end time |
| `evseId` | integer | No | Specific EVSE to book |
| `evseCriteria` | object | No | Auto-select EVSE by criteria (ignored if `evseId` set) |
| `parkingSpaceCriteria` | object | No | Parking/vehicle constraints |
| `authorizedTokenIds` | integer[] | No | OCPI tokens for roaming |
| `externalId` | string | No | External reference (e.g. OCPI `request_id`) |

**`evseCriteria` — automatic EVSE selection:**

When no `evseId` is provided, Ampeco can auto-assign an EVSE based on these criteria:

| Field | Type | Values |
|-------|------|--------|
| `currentType` | string | `"ac"`, `"dc"` |
| `minPower` | number | Minimum power in kW |
| `maxPower` | number | Maximum power in kW |
| `connectorType` | string | Any supported connector type |

**`parkingSpaceCriteria` — vehicle/parking constraints:**

| Field | Type | Description |
|-------|------|-------------|
| `vehicleWeightKg` | integer | Vehicle weight |
| `vehicleHeightCm` | integer | Vehicle height |
| `vehicleLengthCm` | integer | Vehicle length |
| `vehicleWidthCm` | integer | Vehicle width |
| `vehicleType` | string | Vehicle category (see below) |
| `driveThroughRequired` | boolean | Must support drive-through |
| `refrigerationOutletRequired` | boolean | Must have refrigeration outlet |
| `dangerousGoodsAllowed` | boolean | Must allow dangerous goods |

**Vehicle types:** `two_and_three_wheel_vehicles_and_quadricycles`, `passenger_vehicles`, `passenger_vehicles_with_trailer`, `light_duty_vans`, `heavy_duty_tractor_units_without_trailer`, `heavy_duty_trucks_without_articulation_point`, `heavy_duty_trucks_with_trailer_attached`, `buses_or_motor_coaches`

#### Type: `"update"` — Modify Existing Booking

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"update"` | Yes | Discriminator |
| `bookingId` | integer | Yes | ID of the booking to modify |
| `userId` | integer | No | Updated user |
| `startAt` | datetime | No | Updated start time |
| `endAt` | datetime | No | Updated end time |
| `authorizedTokenIds` | integer[] | No | Updated tokens |
| `externalId` | string | No | External reference |

#### Type: `"cancel"` — Cancel Existing Booking

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"cancel"` | Yes | Discriminator |
| `bookingId` | integer | Yes | ID of the booking to cancel |
| `externalId` | string | No | External reference |

#### Response (all types)

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

**Response-only fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | System-generated request ID |
| `status` | string | `pending`, `approved`, `rejected` |
| `rejectionReason` | string | Only present when `status: "rejected"` |
| `bookingId` | integer | Only present on `update`/`cancel` types |
| `createdAt` | datetime | When the request was submitted |
| `lastUpdatedAt` | datetime | When the request was last updated |

#### List Booking Requests

```
GET /resources/booking-requests/v1.0
```

**Filter parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter[status]` | string | `pending`, `approved`, `rejected` |
| `filter[userId]` | integer | Requests for a specific user |
| `filter[locationId]` | integer | Requests for a specific location |
| `filter[startAfter]` | datetime | Start time after this date |
| `filter[startBefore]` | datetime | Start time before this date |
| `filter[endAfter]` | datetime | End time after this date |
| `filter[endBefore]` | datetime | End time before this date |
| `filter[createdAfter]` | datetime | Created after this date |
| `filter[createdBefore]` | datetime | Created before this date |
| `filter[externalId]` | string | By external identifier |
| `per_page` | integer | 1–100 (default: 100) |
| `cursor` | string | Pagination cursor |

#### Read Booking Request

```
GET /resources/booking-requests/v1.0/{bookingRequest}
```

Returns a single booking request. Use this to poll for status transitions (`pending` → `approved` / `rejected`).

---

### 3.6 Confirmed Bookings

Confirmed booking records are created by Ampeco when a booking request is approved. They are **read-only** from the API consumer's perspective — modifications go through the booking request system.

#### List Bookings

```
GET /resources/bookings/v1.0
```

**Filter parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter[status]` | string | `accepted`, `reserved`, `completed`, `cancelled`, `no-show`, `failed` |
| `filter[userId]` | integer | Bookings for a specific user |
| `filter[locationId]` | integer | Bookings at a specific location |
| `filter[startAfter]` | datetime | Bookings starting after this date |
| `filter[startBefore]` | datetime | Bookings starting before this date |
| `filter[endAfter]` | datetime | Bookings ending after this date |
| `filter[endBefore]` | datetime | Bookings ending before this date |
| `per_page` | integer | 1–100 (default: 100) |
| `cursor` | string | Pagination cursor |

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Booking ID |
| `userId` | integer | Booked user ID |
| `locationId` | integer | Location ID |
| `startAt` | datetime | Confirmed start time |
| `endAt` | datetime | Confirmed end time |
| `status` | string | Current booking status |
| `sessionId` | integer \| null | Charging session ID (when a session has started) |
| `authorizedTokens` | object[] | OCPI token details (see below) |
| `accessMethods` | string[] | Access methods snapshot from the location at booking time |
| `bookedEvses` | object[] | Linked EVSEs (requires `include[]=bookedEvses`) |
| `createdAt` | datetime | Creation timestamp (read-only) |
| `lastUpdatedAt` | datetime | Last update timestamp (read-only) |

**`authorizedTokens` array items:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Internal token ID |
| `uid` | string | OCPI token UID |
| `type` | string | Token type (e.g. `RFID`, `APP_USER`) |
| `contractId` | string | Contract identifier |
| `emspCountryCode` | string | eMSP country code |
| `emspPartyId` | string | eMSP party identifier |

#### Read Booking

```
GET /resources/bookings/v1.0/{booking}
```

Same fields as above, but for a single booking. Supports `include[]=bookedEvses` to get linked EVSE IDs (up to 3 per booking).

---

### 3.7 Users

#### List Users (Email Lookup)

```
GET /resources/users/v1.0?filter[email]=driver@example.com
```

The booking flow uses this endpoint to resolve a driver's email to an Ampeco user ID. Drivers must already have an account via the mobile driver app.

**Key filter parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter[email]` | string | Exact email match |
| `filter[externalId]` | string | External system ID |
| `filter[lastUpdatedAfter]` | datetime | Updated after this date |
| `filter[lastUpdatedBefore]` | datetime | Updated before this date |
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | 1–100 (default: 100) |

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User ID |
| `email` | string | Email address |
| `emailVerified` | datetime \| null | When email was verified |
| `firstName` | string \| null | First name |
| `lastName` | string \| null | Last name |
| `phone` | string \| null | Phone number |
| `country` | string \| null | Country |
| `status` | string | `enabled`, `disabled` |
| `balance` | number | Account balance |
| `locale` | string \| null | Preferred locale |

---

### 3.8 Reservations (Related)

Ampeco has a separate **Reservations** system distinct from Bookings. Reservations are real-time, short-duration holds on an EVSE (similar to OCPP Reserve Now), while Bookings are scheduled time-window reservations.

```
GET /resources/reservations/v1.0           # List reservations
GET /resources/reservations/v1.0/{id}      # Read reservation
```

**Reservation filter parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter[evseId]` | integer | Reservations for a specific EVSE |
| `filter[userId]` | integer | Reservations for a specific user |
| `filter[status]` | string | `active`, `expired`, `canceled`, `done` |
| `filter[reservedFrom]` | datetime | Reserved after this date |
| `filter[reservedTo]` | datetime | Reserved before this date |

> **Note:** The `ev-bookings` project does **not** use the reservations API. Bookings and reservations serve different purposes — bookings are for advance scheduling, reservations are for immediate holds.

---

## 4. Project Integration Map

### 4.1 API Client Layer

**File:** `src/lib/ampeco.ts` (~340 lines)

This is the server-only module that wraps all Ampeco API calls. It is never imported in client components.

| Client Function | Ampeco Endpoint | Used In |
|----------------|-----------------|---------|
| `getLocations()` | `GET /resources/locations/v2.0` | Sites list page, sites API route |
| `getLocation(id)` | `GET /resources/locations/v2.0/{id}` | Site detail page |
| `getChargePoints(locationId)` | `GET /resources/charge-points/v2.0?filter[locationId]=` | Site detail page |
| `getChargePointEVSEs(cpId)` | `GET /resources/charge-points/v2.0/{id}/evses` | Site detail page |
| `checkBookingAvailability(locId, params)` | `POST /actions/locations/v2.0/{id}/check-booking-availability` | Availability API route, bookings POST route |
| `createBookingRequest(body)` | `POST /resources/booking-requests/v1.0` | Bookings POST route, admin cancel route |
| `getBookingRequests(params?)` | `GET /resources/booking-requests/v1.0` | Not currently called by any route |
| `getBookingRequest(id)` | `GET /resources/booking-requests/v1.0/{id}` | Booking confirmation page |
| `getBookings(params?)` | `GET /resources/bookings/v1.0` | Bookings GET route, admin bookings route |
| `getBooking(id)` | `GET /resources/bookings/v1.0/{id}` | Single booking API route |
| `findUserByEmail(email)` | `GET /resources/users/v1.0?filter[email]=` | Bookings POST route |

### 4.2 API Proxy Routes

All routes live under `src/app/api/` and exist to keep `AMPECO_API_TOKEN` server-side.

| Route | Method | Ampeco Functions Called | Purpose |
|-------|--------|----------------------|---------|
| `/api/sites` | GET | `getLocations()` | Public location listing |
| `/api/sites/[siteId]/availability` | GET | `checkBookingAvailability()` | Slot availability for a location |
| `/api/bookings` | GET | `getBookings()` | List bookings (with passthrough filters) |
| `/api/bookings` | POST | `findUserByEmail()` → `checkBookingAvailability()` → `createBookingRequest()` | Full booking creation flow |
| `/api/bookings/[id]` | GET | `getBooking()` | Single booking detail |
| `/api/admin/bookings` | GET | `getBookings()` | Admin: list all bookings (auth required) |
| `/api/admin/bookings/[id]/cancel` | POST | `createBookingRequest({type:"cancel"})` | Admin: cancel a booking (auth required) |

### 4.3 Server Components

| Page | File | Ampeco Functions | Data Transformations |
|------|------|-----------------|---------------------|
| Sites list | `app/sites/page.tsx` | `getLocations()`, `localized()` | Extracts English name/address from `LocalizedText[]` arrays |
| Site detail | `app/sites/[siteId]/page.tsx` | `getLocation()`, `getChargePoints()`, `getChargePointEVSEs()`, `localized()` | Fetches location → charge points → EVSEs hierarchy. Filters by `bookingEnabled: true`. Extracts `{evseId, networkId, connectorType, maxPowerKw}` for each port. |
| Booking confirmation | `app/bookings/[id]/page.tsx` | `getBookingRequest()` | Displays booking request `id` and `status` |

### 4.4 Client Components

| Component | File | API Calls (via fetch) | Key Behavior |
|-----------|------|-----------------------|-------------|
| `BookingForm` | `components/BookingForm.tsx` | `POST /api/bookings` | Combines date + time + duration into ISO timestamps. Handles `no_account` error with registration prompt. Redirects to confirmation page on success. |
| Admin console | `app/admin/page.tsx` | `GET /api/admin/bookings`, `POST /api/admin/bookings/{id}/cancel` | Password-based auth via `Authorization: Bearer` header. Displays booking table. Cancel button for `accepted`/`reserved` bookings. |

---

## 5. Data Flow Diagrams

### 5.1 Driver Booking Flow

```
Browser (BookingForm)              Next.js API Route              Ampeco API
─────────────────────              ──────────────────              ─────────────

POST /api/bookings
{ email, locationId,      ─────>   1. findUserByEmail(email)  ──> GET /resources/users/v1.0
  evseId, startAt, endAt }                                         ?filter[email]=...

                                   If user not found:
                                   ← 404 { error: "no_account" }

                                   2. checkBookingAvailability  ──> POST /actions/locations/v2.0
                                      (locationId,                   /{id}/check-booking-availability
                                       { startAfter: startAt,
                                         endBefore: endAt })

                                   3. Validate requested slot:
                                      For the target evseId,
                                      check if any available slot
                                      fully contains [startAt, endAt]

                                   If slot unavailable:
                                   ← 409 { error: "Slot unavailable" }

                                   4. createBookingRequest    ──> POST /resources/
                                      ({ type: "create",            booking-requests/v1.0
                                         userId, locationId,
                                         startAt, endAt, evseId })

                                   ← 201 { bookingRequestId,
                                           status }

Redirect to
/bookings/{bookingRequestId}  ──>  5. getBookingRequest(id)   ──> GET /resources/
                                                                     booking-requests/v1.0/{id}

                                   Render confirmation page
                                   with request id + status
```

### 5.2 Admin Cancel Flow

```
Browser (Admin Console)            Next.js API Route              Ampeco API
───────────────────────            ──────────────────              ─────────────

POST /api/admin/bookings
  /{bookingId}/cancel       ─────>  1. requireAdmin(req)
  Authorization: Bearer pwd            Validates password

                                   2. createBookingRequest    ──> POST /resources/
                                      ({ type: "cancel",            booking-requests/v1.0
                                         bookingId })

                                   ← { bookingRequestId, status }

GET /api/admin/bookings     ─────>  3. getBookings()           ──> GET /resources/bookings/v1.0
  Authorization: Bearer pwd
                                   ← Refreshed booking list
```

### 5.3 Site Detail Page Load

```
Browser                            Next.js Server Component       Ampeco API
───────────────────                ───────────────────────         ─────────────

GET /sites/7               ─────>  1. getLocation(7)          ──> GET /resources/
                                                                     locations/v2.0/7

                                   2. getChargePoints(7)      ──> GET /resources/
                                                                     charge-points/v2.0
                                                                     ?filter[locationId]=7

                                   3. For each charge point:
                                      getChargePointEVSEs(cpId)──> GET /resources/
                                                                      charge-points/v2.0
                                                                      /{cpId}/evses

                                   4. Filter: evse.bookingEnabled === true
                                      Extract: { evseId, networkId,
                                                 connectorType, maxPowerKw }

                                   5. Render page with:
                                      - Location name + address (localized)
                                      - BookingForm component with ports[] prop
```

---

## 6. Unused API Capabilities

The following Ampeco API capabilities are available but **not yet used** by the project:

### Booking Request Features

| Feature | API Support | Project Status |
|---------|-------------|---------------|
| `evseCriteria` (auto EVSE selection) | Full support — currentType, power range, connector type | Not used — project always sends explicit `evseId` |
| `parkingSpaceCriteria` | Full support — vehicle dimensions, type, drive-through | Not used |
| `authorizedTokenIds` (OCPI roaming) | Full support | Not used — no roaming integration |
| `externalId` on requests | Supported for all request types | Not used |
| Booking request `type: "update"` | Full support — change time, user, tokens | Not used — no "modify booking" UI exists |
| `rejectionReason` field | Returned on rejected requests | Not displayed to users |
| Booking request list with filters | Full filter support | `getBookingRequests()` function exists but is not called by any route |

### Booking Features

| Feature | API Support | Project Status |
|---------|-------------|---------------|
| `include[]=bookedEvses` | Returns linked EVSE IDs on bookings | Not used |
| `sessionId` field | Links booking to charging session | Not displayed |
| `authorizedTokens` detail | Full OCPI token info | Not displayed |
| `accessMethods` snapshot | Preserved from location at booking time | Not displayed |
| Time-range filters on bookings | `startAfter`, `startBefore`, `endAfter`, `endBefore` | Passthrough only — not used in admin UI |
| Status filter on bookings | Filter by `accepted`, `reserved`, etc. | Passthrough only — not used in admin UI |

### Location Features

| Feature | API Support | Project Status |
|---------|-------------|---------------|
| `description`, `shortDescription` | Multi-language text | Not displayed |
| `parkingType` | 6 parking type enums | Not displayed |
| `accessMethods` | 6 access method enums | Not displayed |
| `facilities` | 20 facility type enums | Not displayed |
| `workingHours` | Operating schedule | Not displayed |
| `images` (via include) | Location photos | Not displayed |
| `chargingZones` (via include) | Zone subdivisions | Not displayed |
| Geoposition | `{latitude, longitude}` | Available in data but not rendered (no map) |

### EVSE Features

| Feature | API Support | Project Status |
|---------|-------------|---------------|
| `physicalReference` | User-facing ID at the physical site | Not shown (uses `networkId` instead) |
| `label` | App display label | Not shown |
| `hardwareStatus` | Live hardware state (10 states) | Not shown |
| `powerOptions` (full detail) | Voltage, amperage, phases | Only `maxPowerKw` is extracted |
| `connectors` (full detail) | Type, format, status per connector | Only `connectorType` is used (from EVSE level) |
| `allowsReservation` | Real-time reservation flag | Not used |
| `tariffGroupId` | Pricing information link | Not used |
| Global EVSE endpoints (`/evses/v2.1`) | Direct EVSE access without charge point | Not used |

### Reservations (Separate System)

| Feature | API Support | Project Status |
|---------|-------------|---------------|
| List reservations | Full filter support | Not used — project uses bookings, not reservations |
| Read reservation | By ID | Not used |

---

## 7. Known Gaps & TODOs

### Critical (Functional)

1. **No booking request polling** — After creating a booking request, the project redirects to a confirmation page that reads the request once. If the request is still `pending`, the user sees "pending" with no automatic refresh. The API supports polling `GET /resources/booking-requests/v1.0/{id}` until `status` transitions to `approved` or `rejected`.

2. **No rejection handling** — If a booking request is `rejected`, the confirmation page just shows "rejected" as the status. The `rejectionReason` field from the API is not displayed.

3. **No booking update support** — The Ampeco API supports `type: "update"` booking requests to modify time, user, or tokens. The project has no "modify booking" UI.

### Enhancements

4. **No status filtering in admin** — The admin console fetches all bookings without any filters. The API supports filtering by `status`, `userId`, `locationId`, and time ranges which could power a richer admin experience.

5. **No pagination handling** — The API returns up to 100 items per page with cursor-based pagination. Neither the public booking list nor the admin console handles `links.next` for subsequent pages.

6. **Minimal EVSE information** — The site detail page extracts only `{evseId, networkId, connectorType, maxPowerKw}` from each EVSE. The API provides much richer data: `physicalReference`, `label`, `hardwareStatus`, full `powerOptions`, `connectors` detail, and more.

7. **No location detail display** — Location `description`, `parkingType`, `accessMethods`, `facilities`, `workingHours`, and `images` are all available from the API but not shown to drivers.

8. **No availability display before booking** — The availability check endpoint is called during booking submission for validation, but available time slots are not shown to the user proactively. The UI could display a visual timeline of open slots.

9. **No map/geo features** — Location `geoposition` data is fetched but never rendered. A map view could help drivers find nearby sites.

10. **Admin auth is MVP-only** — Uses shared `ADMIN_PASSWORD`. The Ampeco user system has roles and permissions that could back a proper auth flow.

---

## Appendix: Pagination

All Ampeco list endpoints use **cursor-based pagination**:

```
GET /resources/bookings/v1.0?per_page=25
```

Response:

```json
{
  "data": [...],
  "links": { "next": "https://instance.ampeco.tech/...?cursor=eyJ..." },
  "meta": { "cursor": "eyJ...", "per_page": 25 }
}
```

- `per_page`: 1–100 (default 100)
- `cursor`: Opaque string from `links.next` — never construct manually
- When `links.next` is absent, there are no more pages

## Appendix: Error Responses

| HTTP Status | Meaning | Body |
|-------------|---------|------|
| 400 | Bad request (invalid parameters) | `{ message: "..." }` |
| 401 | Missing or invalid API token | `{ message: "Access token is missing or invalid" }` |
| 403 | Insufficient permissions | `{ message: "This action is unauthorized." }` |
| 404 | Resource not found | `{ message: "The record is not found" }` |
| 422 | Validation error | `{ message: "...", errors: { field: ["reason"] } }` |
| 429 | Rate limited | `{ message: "Too many requests..." }` — check `X-RateLimit-*` headers |

## Appendix: Authentication

All Ampeco API calls require a Bearer token:

```
Authorization: Bearer <AMPECO_API_TOKEN>
```

The token is stored in the `AMPECO_API_TOKEN` environment variable and used exclusively in server-side code (`src/lib/ampeco.ts`). It never reaches the browser — all client-side requests go through the Next.js API proxy routes under `/api/*`.
