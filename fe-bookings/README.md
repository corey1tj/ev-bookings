# Future Energy — EV Charging Bookings

Public booking UI and admin console for Future Energy's EV charging network. Thin layer on top of [Ampeco's Bookings API](https://developers.ampeco.com).

## Architecture

```
Next.js (App Router)
  ├── /sites          → Browse bookable locations
  ├── /sites/:id      → Pick time + charger → confirm booking
  ├── /bookings/:id   → Booking confirmation
  ├── /my-bookings    → Driver self-service (view, edit, cancel bookings)
  ├── /admin          → Admin console (list, cancel, update)
  └── /api/*          → Proxy routes to Ampeco (keeps token server-side)
```

No database. Ampeco is the source of truth for all booking data.

## Setup

```bash
npm install
cp .env.example .env
# Fill in AMPECO_API_URL, AMPECO_API_TOKEN, and ADMIN_PASSWORD
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `AMPECO_API_URL` | Ampeco API base URL (e.g., `https://your-instance.ampeco.tech/public-api`) |
| `AMPECO_API_TOKEN` | Ampeco bearer token with booking permissions |
| `ADMIN_PASSWORD` | Shared secret for admin console access |

## Deploy to Vercel

1. Connect this repo to Vercel
2. Set the **Root Directory** to `fe-bookings`
3. Set environment variables in Vercel dashboard
4. Vercel auto-detects Next.js — no additional config needed

## Project Structure

```
src/
  app/
    api/
      sites/              → GET /api/sites
      sites/[siteId]/
        availability/     → GET /api/sites/:id/availability
      bookings/           → GET, POST /api/bookings
      bookings/[id]/      → GET /api/bookings/:id
      my-bookings/        → GET /api/my-bookings?email= (driver lookup)
      my-bookings/[id]/
        update/           → POST /api/my-bookings/:id/update
        cancel/           → POST /api/my-bookings/:id/cancel
      admin/bookings/     → GET /api/admin/bookings (auth required)
      admin/bookings/create/ → POST /api/admin/bookings/create
      admin/bookings/[id]/
        cancel/           → POST /api/admin/bookings/:id/cancel
        update/           → POST /api/admin/bookings/:id/update
      admin/locations/    → GET /api/admin/locations
      admin/locations/[locationId]/evses/ → GET /api/admin/locations/:id/evses
    sites/                → Public site list page
    sites/[siteId]/       → Site detail + booking form
    bookings/[id]/        → Booking confirmation page
    my-bookings/          → Driver booking management page
    admin/                → Admin console
  lib/
    ampeco.ts             → Typed Ampeco API client
    admin-auth.ts         → Simple admin auth helper
    api-helpers.ts        → Shared API route error handler
    availability.ts       → Booking slot availability validation
    date-utils.ts         → Timezone, duration, and date/time helpers
    enrich-bookings.ts    → Shared booking enrichment (location/EVSE details)
    types.ts              → Shared TypeScript types (EnrichedBooking)
  components/
    BookingForm.tsx        → Client-side booking form
    BookingCard.tsx        → Shared booking card (driver view)
    DriverEditBookingModal.tsx → Driver booking edit modal
    AdminBookingModal.tsx  → Admin create/edit booking modal
```

## API Call Patterns

### `/sites` — Location listing page

The sites page filters locations to only show those with bookable chargers. Because Ampeco has no single endpoint for this, the page resolves a chain of calls:

1. `getLocations()` — 1 call to fetch all locations
2. `getChargePoints(locationId)` — 1 call **per location** (N calls)
3. `getChargePointEVSEs(chargePointId)` — 1 call **per charge point** (N x M calls)

**Total: `1 + N + (N x M)`** where N = number of locations, M = average charge points per location.

Example: 10 locations with 3 charge points each = **41 API calls** per page load.

All location-level calls run in parallel via `Promise.allSettled`. A `loading.tsx` skeleton is shown while data loads.

## TODOs (Sprint 0)

- [ ] Confirm Ampeco booking API permissions with CSM
- [ ] Confirm `bookingEnabled` flag is set on target EVSEs
- [ ] Confirm EVSE access restriction behavior during active bookings
- [ ] Wire up charge point → EVSE fetch chain in site detail page
- [ ] Confirm Ampeco cancel booking endpoint and wire into admin
