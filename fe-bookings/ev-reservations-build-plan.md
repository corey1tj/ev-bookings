# EV Charging Bookings — MVP Build Plan

**Future Energy | Product Operations**
**Date:** February 18, 2026
**Author:** Travis (Product Ops) + Claude (Technical Planning)
**Status:** Draft — MVP Scope
**Last Updated:** February 18, 2026 — API spec corrections from Ampeco OpenAPI v3.143.0

---

## MVP Scope

**Build:** Public booking UI + basic admin console. Both are thin layers on top of Ampeco's Bookings API.

**Ampeco owns:** Booking records, availability validation, conflict prevention, EVSE access control, policy enforcement, payment/billing via session flow.

**We own:** The consumer-facing booking experience and a simple admin view. No database — Ampeco is the database.

**Not in MVP:** Payment handling, custom policy engine, notifications, QR codes, session interruption logic.

---

## 1. Ampeco API Endpoints

> **Source:** Ampeco OpenAPI spec v3.143.0 via `@ampeco/public-api-mcp` npm package. All endpoint paths, field names, and types validated against generated `endpoints.json`.

### Booking Availability

| Endpoint | Method | Purpose |
|---|---|---|
| `/actions/locations/v2.0/{location}/check-booking-availability` | POST | Get available time slots per bookable EVSE at a location |

**Request body:**
```json
{
  "startAfter": "2026-03-01T08:00:00Z",
  "endBefore": "2026-03-01T18:00:00Z"
}
```
- Both fields required. Max 7-day window.
- Returns available slots per EVSE — not a simple boolean.

### Booking Requests (Polymorphic)

Single endpoint, three operations via `type` discriminator:

| Endpoint | Method | Purpose |
|---|---|---|
| `/resources/booking-requests/v1.0` | POST | Create, update, or cancel a booking |
| `/resources/booking-requests/v1.0` | GET | List booking requests (filterable) |
| `/resources/booking-requests/v1.0/{bookingRequest}` | GET | Read booking request status |

**Type: `"create"`** — New booking (required: `type`, `userId`, `locationId`, `startAt`, `endAt`)
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

**Type: `"update"`** — Modify existing booking (required: `type`, `bookingId`)
```json
{
  "type": "update",
  "bookingId": 100,
  "startAt": "2026-03-01T11:00:00Z",
  "endAt": "2026-03-01T12:00:00Z"
}
```

**Type: `"cancel"`** — Cancel existing booking (required: `type`, `bookingId`)
```json
{
  "type": "cancel",
  "bookingId": 100
}
```

**Booking request statuses:** `pending` → `approved` | `rejected`

### Confirmed Bookings (Read-Only)

| Endpoint | Method | Purpose |
|---|---|---|
| `/resources/bookings/v1.0` | GET | List confirmed bookings (filterable) |
| `/resources/bookings/v1.0/{booking}` | GET | Read confirmed booking |

Ampeco creates booking records when a booking request is approved. We read them — we don't create them directly.

**Booking statuses:** `accepted` | `reserved` | `completed` | `cancelled` | `no-show` | `failed`

### EVSE Selection Options

When creating a booking, the driver can either specify a port or let Ampeco auto-assign:

**Option A: Explicit EVSE** — `evseId: 15`

**Option B: Criteria-based selection** — `evseCriteria` object (ignored when `evseId` is provided)
```json
{
  "evseCriteria": {
    "currentType": "dc",
    "connectorType": "ccs1",
    "minPower": 50,
    "maxPower": 150
  }
}
```

Supported connector types: `type1`, `type2`, `chademo`, `ccs1`, `ccs2`, `nacs`, `j1772`, and others.

Optional `parkingSpaceCriteria` also available for vehicle-dimension-aware EVSE assignment.

### Supporting Endpoints

| Need | Endpoint |
|---|---|
| Locations | `GET /resources/locations/v1.1` |
| EVSEs per charge point | `GET /resources/charge-points/v2.0/{id}/evses` |
| User lookup by email | `GET /resources/users/v1.0?filter[email]=` |

`bookingEnabled` on EVSEs controls which ports accept bookings.

### Filter Parameters

Both booking requests and bookings support cursor-based pagination and these query filters:

| Filter | Booking Requests | Bookings |
|---|---|---|
| `filter[status]` | pending, approved, rejected | accepted, reserved, completed, cancelled, no-show, failed |
| `filter[userId]` | ✓ | ✓ |
| `filter[locationId]` | ✓ | ✓ |
| `filter[startAfter]` | ✓ | ✓ |
| `filter[startBefore]` | ✓ | ✓ |
| `filter[endAfter]` | ✓ | ✓ |
| `filter[endBefore]` | ✓ | ✓ |
| `filter[createdAfter]` | ✓ | — |
| `filter[createdBefore]` | ✓ | — |
| `filter[externalId]` | ✓ | — |
| `per_page` (1–100, default 100) | ✓ | ✓ |
| `cursor` | ✓ | ✓ |

---

## 2. Architecture

```
┌──────────────────────────────────────────┐
│           PUBLIC BOOKING UI               │
│      (Next.js — mobile-first)            │
└──────────────┬───────────┬───────────────┘
               │           │
               ▼           ▼
┌────────────────┐  ┌────────────────────┐
│  API Routes    │  │  ADMIN CONSOLE     │
│  (proxy to     │  │  (authenticated)   │
│   Ampeco,      │  │                    │
│   keeps token  │  │ • View bookings    │
│   server-side) │  │ • Cancel / update  │
└───────┬────────┘  └───────┬────────────┘
        │                   │
        ▼                   ▼
┌──────────────────────────────────────────┐
│            AMPECO PUBLIC API              │
│  Bookings • Locations • EVSEs            │
└──────────────────────────────────────────┘
```

No database. No external services. Next.js API routes exist solely to keep the Ampeco bearer token server-side.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API proxy | Next.js 14+ (App Router + API routes) |
| Styling | Tailwind CSS |
| Hosting | Netlify |

One codebase. One deploy target.

---

## 4. API Routes

### Public

```
GET  /api/sites
  → Proxy to Ampeco GET /resources/locations/v1.1

GET  /api/sites/{siteId}/availability?startAfter=&endBefore=
  → Proxy to Ampeco POST /actions/locations/v2.0/{location}/check-booking-availability

POST /api/bookings
  Body: { locationId, evseId?, startAt, endAt, email }
  → GET /resources/users/v1.0?filter[email]= to find driver
  → If not found: return 404 with "sign up in driver app" message
  → If found: POST /resources/booking-requests/v1.0 with type: "create"
  → Returns { bookingRequestId, status }

GET  /api/bookings/{id}
  → Proxy to Ampeco GET /resources/bookings/v1.0/{booking}
```

### Admin (Authenticated)

```
GET  /api/admin/bookings?filter[locationId]=&filter[status]=&filter[startAfter]=
  → Proxy to Ampeco GET /resources/bookings/v1.0 with filters

POST /api/admin/bookings/{id}/cancel
  → POST /resources/booking-requests/v1.0 with type: "cancel", bookingId: {id}

POST /api/admin/bookings/{id}/update
  → POST /resources/booking-requests/v1.0 with type: "update", bookingId: {id}
```

All routes are thin proxies. The only logic is formatting Ampeco responses for the UI and handling the user creation step on first booking.

---

## 5. Booking Flow

```
Driver                 Next.js API Routes       Ampeco API
  │                        │                        │
  │ Browse sites           │                        │
  │───────────────────────>│ GET locations/v1.1     │
  │                        │───────────────────────>│
  │                        │<───────────────────────│
  │ <site list>            │                        │
  │<───────────────────────│                        │
  │                        │                        │
  │ Pick date/time         │                        │
  │───────────────────────>│ POST check-booking-    │
  │                        │   availability         │
  │                        │  {startAfter, endBefore}│
  │                        │───────────────────────>│
  │                        │<── {slots per EVSE}    │
  │ <available slots>      │                        │
  │<───────────────────────│                        │
  │                        │                        │
  │ Enter driver app email │                        │
  │ + confirm booking      │                        │
  │───────────────────────>│ GET users?filter[email] │
  │                        │───────────────────────>│
  │                        │<── {userId} or empty   │
  │                        │                        │
  │  ┌─ IF NO ACCOUNT ────────────────────────────┐ │
  │  │ <"Sign up in the driver app first" prompt>  │ │
  │  │  Driver signs up → returns to booking page  │ │
  │  └────────────────────────────────────────────┘ │
  │                        │                        │
  │  ┌─ IF ACCOUNT FOUND ─┐                        │
  │  │                     │ POST booking-requests  │
  │  │                     │  {type:"create",       │
  │  │                     │   userId, locationId,  │
  │  │                     │   startAt, endAt,      │
  │  │                     │   evseId}              │
  │  │                     │───────────────────────>│
  │  │                     │<── {id, status}        │
  │  └─────────────────────┘                        │
  │                        │                        │
  │ <confirmation>         │                        │
  │<───────────────────────│                        │
```

**Driver account requirement:** Drivers must have an existing account in the Future Energy driver app. The booking form collects the driver's app email and looks them up via `GET /resources/users/v1.0?filter[email]=`. If no account is found, the UI displays a prompt directing them to sign up in the driver app first, then return to complete the booking. We do NOT create Ampeco user accounts from the booking UI.

Booking request status will be `pending` initially. Ampeco processes it (typically instant) and moves to `approved` or `rejected`. Once approved, a booking record appears in `/resources/bookings/v1.0` with status `accepted`.

Driver arrives → authenticates via Ampeco driver app or RFID → Ampeco enforces the booking window → session starts → normal Ampeco billing.

---

## 6. Admin Console

Three views:

1. **Bookings list** — table with filters (location, date range, status). Pulls from Ampeco `GET /resources/bookings/v1.0` with `filter[]` query params.
2. **Booking detail** — full info + cancel button + modify time. Cancel and modify both POST to `/resources/booking-requests/v1.0` with the appropriate `type`.
3. **Calendar view** — day/week grid showing bookings per port. Built from Ampeco booking data.

Single admin role. No policy config, no reporting.

---

## 7. Sprint Plan (3 Sprints — 6 Weeks to Pilot)

### Sprint 0: Foundation (Weeks 1–2)
- Next.js project scaffolding + Netlify deploy ✅ (initial repo created)
- Ampeco API client (typed against OpenAPI spec, server-side only) ✅ (corrected to spec)
- API routes: sites list, site detail with EVSEs, availability check
- Parse availability response — it returns slots per EVSE, not a boolean. Need to transform this into the UI's slot picker format.
- **Confirm with Ampeco CSM:**
  - Booking API permissions on our bearer token
  - `bookingEnabled` flag setup on target EVSEs at pilot sites
  - How to get charge point IDs for a given location (needed to fetch EVSEs)
  - EVSE access restriction behavior during active bookings
  - Whether booking request approval is instant or requires manual review

**Deliverable:** API routes return live Ampeco location and availability data.

### Sprint 1: Booking Flow + Public UI (Weeks 3–4)
- Booking API route: email lookup → booking request (type: "create") → confirmation
- "No account found" UX: prompt driver to sign up in the FE driver app, then return to booking page
- Public UI: site browser → date/time picker → port selection (or criteria-based) → driver app email → confirm → confirmation page
- Booking detail/status page (poll for approved/rejected status)
- Mobile-responsive
- Error handling: no account found, slot taken, API errors, rejected booking requests

**Deliverable:** A driver can browse sites, pick a time, and create a confirmed booking.

### Sprint 2: Admin Console + Pilot (Weeks 5–6)
- Admin auth (simple, single-role)
- Bookings list with Ampeco filters (location, status, date range) + cursor pagination
- Booking detail + cancel (type: "cancel") + update (type: "update")
- Calendar view
- End-to-end testing across hardware vendors
- Verify Ampeco booking enforcement on EVSE access
- Pilot launch at 1–2 properties

**Deliverable:** Admin console live. Pilot running.

---

## 8. Pilot Success Criteria

- 25+ successful book-to-charge completions
- Zero double-bookings
- Booking creation <5s
- <2 front-desk escalations per property per week

---

## 9. Team & Timeline

| Role | FTE | Duration |
|---|---|---|
| Full-stack engineer (Next.js) | 1 | 6 weeks |
| Product (Travis) | 0.25 | Ongoing |

**Total:** ~6 engineer-weeks to pilot.

**Key dependency:** Ampeco CSM confirmation on booking API permissions and EVSE enforcement behavior — this gates Sprint 1.

---

## 10. Open Questions for Ampeco CSM

1. **Charge point → location mapping:** How do we get the list of charge point IDs for a given location? The locations endpoint doesn't seem to include them directly. Do we need to list all charge points and filter by location, or is there a nested endpoint?

2. **Booking request approval flow:** Is approval instant (auto-approved) or does it require manual review? If async, we need to poll or use webhooks.

3. **Availability response shape:** The check-booking-availability endpoint returns "available time slots for each bookable EVSE" — what does this response structure look like? Is it an array of EVSEs with their open slots, or a flat list of available windows?

4. **User email lookup:** Does `filter[email]` on `/resources/users/v1.0` do an exact match? Are there edge cases (case sensitivity, multiple accounts per email) we should handle?

5. **EVSE enforcement during booking window:** Does Ampeco automatically reject ad-hoc (walk-up) authorization attempts on an EVSE during a confirmed booking window, or does it require additional configuration?

6. **evseCriteria behavior:** When using criteria-based EVSE selection instead of explicit evseId, does Ampeco assign the specific EVSE at booking time (locked in) or at session-start time (flexible)?

---

## 11. Post-MVP (Phase 2 Candidates)

- Payment at booking time (Stripe pre-auth)
- Notification system (email confirmations, reminders)
- Custom policy engine (per-property rules beyond Ampeco defaults)
- QR code deep links for session start
- Reporting dashboards
- Role-based admin access
- evseCriteria-based booking (let driver specify connector type / power range instead of picking a port)
- Ampeco MCP server integration for Claude Code development workflow

---

## Appendix: Field Name Reference

> These are the actual Ampeco API field names — verified against OpenAPI spec v3.143.0.

| Context | Field | Type | Notes |
|---|---|---|---|
| Availability check | `startAfter` | datetime | Start of availability window |
| Availability check | `endBefore` | datetime | End of window (max 7 days) |
| Booking request (create) | `type` | `"create"` | **Required** discriminator |
| Booking request (create) | `userId` | integer | **Required** |
| Booking request (create) | `locationId` | integer | **Required** |
| Booking request (create) | `startAt` | datetime | **Required** — NOT `startsAt` |
| Booking request (create) | `endAt` | datetime | **Required** — NOT `endsAt` |
| Booking request (create) | `evseId` | integer | Optional — specific port |
| Booking request (create) | `evseCriteria` | object | Optional — auto-assign by criteria |
| Booking request (update) | `type` | `"update"` | **Required** discriminator |
| Booking request (update) | `bookingId` | integer | **Required** |
| Booking request (cancel) | `type` | `"cancel"` | **Required** discriminator |
| Booking request (cancel) | `bookingId` | integer | **Required** |
| Booking request status | `status` | enum | `pending`, `approved`, `rejected` |
| Booking status | `status` | enum | `accepted`, `reserved`, `completed`, `cancelled`, `no-show`, `failed` |
