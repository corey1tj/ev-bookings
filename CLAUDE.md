# CLAUDE.md — EV Bookings

## Project Overview

Public booking UI and admin console for Future Energy's EV charging network. A thin Next.js layer on top of [Ampeco's Bookings API](https://ampeco.com/) — Ampeco is the sole source of truth (no local database).

Drivers browse charging locations, pick a time slot and charger, then confirm a booking. Drivers can also view, reschedule, and cancel their own bookings via email lookup. An admin console lets staff view, create, edit, and cancel bookings.

## Repository Structure

```
ev-bookings/
├── README.md                       # High-level project description
└── fe-bookings/                    # Next.js application (all app code lives here)
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.js
    ├── postcss.config.js
    ├── README.md                   # Detailed project docs, API notes, sprint TODOs
    └── src/
        ├── app/                    # Next.js App Router
        │   ├── layout.tsx          # Root layout (header, nav, container)
        │   ├── page.tsx            # Home — redirects to /sites
        │   ├── globals.css         # Tailwind directives only
        │   ├── sites/
        │   │   ├── page.tsx        # Location list (server component)
        │   │   ├── loading.tsx     # Loading skeleton for sites list
        │   │   └── [siteId]/
        │   │       └── page.tsx    # Site detail + booking form
        │   ├── bookings/
        │   │   └── [id]/
        │   │       └── page.tsx    # Booking confirmation
        │   ├── my-bookings/
        │   │   └── page.tsx        # Driver booking management (client component)
        │   ├── admin/
        │   │   └── page.tsx        # Admin console (client component)
        │   └── api/                # Server-side API proxy routes
        │       ├── sites/
        │       │   ├── route.ts              # GET /api/sites
        │       │   └── [siteId]/availability/
        │       │       └── route.ts          # GET /api/sites/:id/availability
        │       ├── bookings/
        │       │   ├── route.ts              # GET, POST /api/bookings
        │       │   └── [id]/
        │       │       └── route.ts          # GET /api/bookings/:id
        │       ├── my-bookings/
        │       │   ├── route.ts              # GET /api/my-bookings?email=
        │       │   └── [id]/
        │       │       ├── update/
        │       │       │   └── route.ts      # POST /api/my-bookings/:id/update
        │       │       └── cancel/
        │       │           └── route.ts      # POST /api/my-bookings/:id/cancel
        │       └── admin/
        │           ├── bookings/
        │           │   ├── route.ts              # GET /api/admin/bookings (auth)
        │           │   ├── create/
        │           │   │   └── route.ts          # POST /api/admin/bookings/create
        │           │   └── [id]/
        │           │       ├── cancel/
        │           │       │   └── route.ts      # POST /api/admin/bookings/:id/cancel
        │           │       └── update/
        │           │           └── route.ts      # POST /api/admin/bookings/:id/update
        │           └── locations/
        │               ├── route.ts              # GET /api/admin/locations
        │               └── [locationId]/evses/
        │                   └── route.ts          # GET /api/admin/locations/:id/evses
        ├── components/
        │   ├── BookingForm.tsx              # Client-side booking form
        │   ├── BookingCard.tsx              # Shared booking card (driver view)
        │   ├── DriverEditBookingModal.tsx   # Driver booking edit modal
        │   └── AdminBookingModal.tsx        # Admin create/edit booking modal
        └── lib/
            ├── ampeco.ts           # Ampeco API client, types, all API methods
            ├── admin-auth.ts       # Simple Bearer-token admin auth helper
            ├── api-helpers.ts      # Shared API route error handler
            ├── availability.ts     # Booking slot availability validation
            ├── date-utils.ts       # Timezone, duration, and date/time helpers
            ├── enrich-bookings.ts  # Booking enrichment (location/EVSE names)
            └── types.ts            # Shared TypeScript types (EnrichedBooking)
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 3.4
- **Deployment:** Vercel
- **External API:** Ampeco public API (bookings, locations, users)
- **Tests:** None yet
- **Database:** None — Ampeco is the source of truth

## Common Commands

All commands must be run from the `fe-bookings/` directory:

```bash
cd fe-bookings

npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint (next lint)
```

There are no test commands — no tests exist yet.

## Environment Variables

Three required variables (no `.env` file is committed):

| Variable           | Purpose                                              |
|--------------------|------------------------------------------------------|
| `AMPECO_API_URL`   | Ampeco API base URL (e.g. `https://instance.ampeco.tech/public-api`) |
| `AMPECO_API_TOKEN` | Bearer token with booking permissions                |
| `ADMIN_PASSWORD`   | Shared secret for admin console authentication       |

Referenced in `src/lib/ampeco.ts` and `src/lib/admin-auth.ts`.

## Architecture & Key Patterns

### Server-side API Proxy

All Ampeco calls go through Next.js API routes (`/api/*`) so the `AMPECO_API_TOKEN` never reaches the browser. The `src/lib/ampeco.ts` module is server-only.

### Rendering Strategy

- **Server components** (default): Sites list, site detail, booking confirmation — data is fetched at request time (`export const dynamic = "force-dynamic"`).
- **Client components** (`"use client"`): `BookingForm.tsx`, `admin/page.tsx`, and `my-bookings/page.tsx` — these need interactivity (form state, auth flow).

### Ampeco API Client (`src/lib/ampeco.ts`)

Central module (~400 lines) containing all types and API methods:

- **Locations:** `getLocations()`, `getLocation(id)`, `getLocationsWithBookableEVSEs()`
- **Charge Points:** `getChargePoints(locationId)`
- **EVSEs:** `getChargePointEVSEs(chargePointId)`, `getBookableEVSEs(locationId)`
- **Availability:** `checkBookingAvailability(locationId, params)`
- **Booking Requests:** `createBookingRequest(body)`, `getBookingRequests()`, `getBookingRequest(id)` — uses a polymorphic `type` discriminator (`"create"` | `"update"` | `"cancel"`)
- **Bookings:** `getBookings()`, `getBooking(id)`
- **Users:** `findUserByEmail(email)` — returns `null` if not found

Custom `AmpecoError` class carries HTTP status and response body.

### Booking Flow

```
Driver enters email + picks charger/time
  → POST /api/bookings
    → findUserByEmail(email) — 404 "no_account" if not found
    → checkBookingAvailability(locationId, timeRange)
    → createBookingRequest({ type: "create", ... })
  → Redirect to /bookings/:bookingRequestId (confirmation page)
```

### Driver Self-Service Flow

```
Driver enters email on /my-bookings
  → GET /api/my-bookings?email=<email>
    → findUserByEmail(email) — 404 "no_account" if not found
    → getBookings({ filter[userId]: userId })
    → enrichBookings() — resolves location names + EVSE details
  → Shows booking cards (upcoming / past)
  → Edit: opens DriverEditBookingModal → POST /api/my-bookings/:id/update
  → Cancel: confirm dialog → POST /api/my-bookings/:id/cancel
```

All driver API routes verify email→userId ownership before allowing modifications. Email is persisted in localStorage for convenience.

### Admin Auth

Simple shared-password scheme via `Authorization: Bearer <ADMIN_PASSWORD>` header. The helper `requireAdmin(req)` in `src/lib/admin-auth.ts` returns a 401 response or `null` (success).

### Path Aliases

TypeScript path alias `@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Key Types (from `src/lib/ampeco.ts`)

- `AmpecoLocation` — id, name, address, city, state, country, postCode, timezone, geoposition (latitude/longitude)
- `AmpecoEVSE` — id, networkId, status, connectorType, maxPowerKw, bookingEnabled
- `AmpecoBookingRequest` — id, type, status (`pending` | `approved` | `rejected`), timestamps
- `AmpecoBooking` — id, status (`accepted` | `reserved` | `completed` | `cancelled` | `no-show` | `failed`), userId, locationId, evseId, startAt, endAt
- `AmpecoUser` — id, email

## Known TODOs / Incomplete Work

1. **Admin auth upgrade**: Current MVP uses a shared password; Phase 2 should use proper OAuth or Supabase Auth.
2. **Tests**: No test files exist.

## Conventions & Guidelines

### Code Style
- TypeScript strict mode — do not weaken compiler settings.
- Tailwind utility classes for all styling (no CSS modules, no styled-components).
- Use `@/*` import alias for all project imports.
- Server components by default; add `"use client"` only when interactivity is required.
- API routes use Next.js `NextRequest`/`NextResponse` from `next/server`.

### File Organization
- Pages go in `src/app/` following Next.js App Router conventions.
- Shared UI components go in `src/components/`.
- API client code and utilities go in `src/lib/`.
- API proxy routes go in `src/app/api/`.

### Error Handling
- API routes use `handleApiError()` from `src/lib/api-helpers.ts` for consistent error responses.
- The Ampeco client throws `AmpecoError` with status and body for non-2xx responses.
- Availability validation uses `validateSlotAvailable()` from `src/lib/availability.ts`.
- Client components display user-friendly error messages and handle the `"no_account"` error case specifically.

### Naming
- Files: kebab-case for lib modules (`admin-auth.ts`), PascalCase for components (`BookingForm.tsx`).
- Route files follow Next.js conventions: `page.tsx`, `route.ts`, `layout.tsx`.
- Types: PascalCase prefixed with `Ampeco` for API types (e.g. `AmpecoLocation`).

### Deployment
- Vercel (zero-config for Next.js).
- Root directory set to `fe-bookings/` in Vercel project settings.
- Build command: `npm run build` (auto-detected).
