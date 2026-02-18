# CLAUDE.md — EV Bookings

## Project Overview

Public booking UI and admin console for Future Energy's EV charging network. A thin Next.js layer on top of [Ampeco's Bookings API](https://ampeco.com/) — Ampeco is the sole source of truth (no local database).

Drivers browse charging locations, pick a time slot and charger, then confirm a booking. An admin console lets staff view and cancel bookings.

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
    ├── netlify.toml                # Netlify deployment config
    ├── README.md                   # Detailed project docs, API notes, sprint TODOs
    └── src/
        ├── app/                    # Next.js App Router
        │   ├── layout.tsx          # Root layout (header, nav, container)
        │   ├── page.tsx            # Home — redirects to /sites
        │   ├── globals.css         # Tailwind directives only
        │   ├── sites/
        │   │   ├── page.tsx        # Location list (server component)
        │   │   └── [siteId]/
        │   │       └── page.tsx    # Site detail + booking form
        │   ├── bookings/
        │   │   └── [id]/
        │   │       └── page.tsx    # Booking confirmation
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
        │       └── admin/bookings/
        │           ├── route.ts              # GET /api/admin/bookings (auth)
        │           └── [id]/cancel/
        │               └── route.ts          # POST /api/admin/bookings/:id/cancel
        ├── components/
        │   └── BookingForm.tsx     # Client-side booking form
        └── lib/
            ├── ampeco.ts           # Ampeco API client, types, all API methods
            └── admin-auth.ts       # Simple Bearer-token admin auth helper
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 3.4
- **Deployment:** Netlify (with `@netlify/plugin-nextjs`)
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
- **Client components** (`"use client"`): `BookingForm.tsx` and `admin/page.tsx` — these need interactivity (form state, auth flow).

### Ampeco API Client (`src/lib/ampeco.ts`)

Central module (~286 lines) containing all types and API methods:

- **Locations:** `getLocations()`, `getLocation(id)`
- **EVSEs:** `getChargePointEVSEs(chargePointId)`
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

### Admin Auth

Simple shared-password scheme via `Authorization: Bearer <ADMIN_PASSWORD>` header. The helper `requireAdmin(req)` in `src/lib/admin-auth.ts` returns a 401 response or `null` (success).

### Path Aliases

TypeScript path alias `@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Key Types (from `src/lib/ampeco.ts`)

- `AmpecoLocation` — id, name, address, city, state, country, postalCode, timezone, coordinates
- `AmpecoEVSE` — id, networkId, status, connectorType, maxPowerKw, bookingEnabled
- `AmpecoBookingRequest` — id, type, status (`pending` | `approved` | `rejected`), timestamps
- `AmpecoBooking` — id, status (`accepted` | `reserved` | `completed` | `cancelled` | `no-show` | `failed`), userId, locationId, evseId, startAt, endAt
- `AmpecoUser` — id, email

## Known TODOs / Incomplete Work

These are documented in `fe-bookings/README.md` under Sprint 0:

1. **Charge Point → EVSE fetch chain**: The site detail page (`sites/[siteId]/page.tsx`) currently passes an empty `ports` array to `BookingForm`. Needs to fetch charge points for the location, then fetch EVSEs per charge point, filtering by `bookingEnabled: true`.
2. **Availability parsing**: `POST /api/bookings` calls `checkBookingAvailability` but does not yet parse the response to confirm the requested slot is actually open.
3. **Admin auth upgrade**: Current MVP uses a shared password; Phase 2 should use proper OAuth or Supabase Auth.
4. **Tests**: No test files exist.

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
- API routes return structured JSON errors with appropriate HTTP status codes.
- The Ampeco client throws `AmpecoError` with status and body for non-2xx responses.
- Client components display user-friendly error messages and handle the `"no_account"` error case specifically.

### Naming
- Files: kebab-case for lib modules (`admin-auth.ts`), PascalCase for components (`BookingForm.tsx`).
- Route files follow Next.js conventions: `page.tsx`, `route.ts`, `layout.tsx`.
- Types: PascalCase prefixed with `Ampeco` for API types (e.g. `AmpecoLocation`).

### Deployment
- Netlify with the `@netlify/plugin-nextjs` plugin.
- Build command: `npm run build` from the `fe-bookings/` directory.
- Publish directory: `.next`.
