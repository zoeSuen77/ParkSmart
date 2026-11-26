# ParkSmart: Campus Parking Availability and Management System

Team 5 — Milestone 4 application prototype. Mobile-first web app for UAlbany
commuter students: register a license plate, compare commuter lot availability,
reserve a spot after safely parking, and release it when leaving.

**Stack:** React (Vite) · JavaScript · Node.js · Express · MongoDB (transactions)

## Prerequisites

- Node.js 20+ and npm
- No other services are required for the default setup: when `MONGODB_URI` is
  not configured, the server starts an embedded single-node MongoDB replica set
  (first run downloads a `mongod` binary, ~100 MB). To use a persistent
  database instead, point `MONGODB_URI` at any transaction-capable MongoDB
  (replica set or Atlas).

## Setup

```bash
npm install                 # server dependencies (also creates package-lock.json)
npm --prefix client install # client dependencies
cp .env.example .env        # optional; defaults work out of the box
```

## Run (single port — recommended for demo)

```bash
npm run build   # once, to produce client/dist
npm run dev     # serves API + built client on http://localhost:4000
```

`npm run dev -- --port 7100` overrides the port. The embedded database is
auto-seeded on first start.

## Run (hot-reload development)

```bash
npm run dev:hot
```

- API: http://localhost:4000
- Client: http://localhost:5173 (Vite dev server proxies `/api` to the API)

## Tests

```bash
npm test
```

Runs the integration suite (`node --test`) against a throwaway embedded
replica set with transaction support. Coverage: plate validation, lot/spot
reads, two-session race for one spot, idempotent create replay, replay after
release, cross-session release rejection, duplicate/stale release, rollback
invariants (`available_count` == number of Available spots; every Reserved
spot has exactly one Active reservation), and the NFR-01 timing check.

## Seed data (demo only — not real Parking Services records)

Three lots with 20 spots each, matching the Milestone 3 demo state:

| Lot           | Available | Status label |
| ------------- | --------- | ------------ |
| Dutch Quad    | 12 / 20   | Available    |
| State Quad    | 5 / 20    | Limited      |
| Colonial Quad | 0 / 20    | Full         |

Every Reserved spot is backed by a demo Active reservation so the data
invariant holds. `npm run seed` seeds a persistent `MONGODB_URI` database when
empty; the embedded dev database seeds itself on server start. The seed never
overwrites a non-empty database.

## API summary

| Method & path                      | Behavior |
| ---------------------------------- | -------- |
| `PUT /api/session/plate`           | Validate + save plate to the server session (400 on bad format, 409 while a reservation is active) |
| `GET /api/session`                 | Current session plate (refresh recovery) |
| `GET /api/lots`                    | All lots: name, capacity, available count, status label |
| `GET /api/lots/:lotId/spots`       | Lot metadata + every spot with text status |
| `POST /api/reservations`           | Body `{spotId, safelyParked:true}` + `Idempotency-Key` header; 201 on create, 200 on replay |
| `GET /api/reservations/current`    | This session's active reservation or `null` |
| `POST /api/reservations/:id/release` | Owner-only conditional release; idempotent |

Errors use `{ "error": { "code", "message" } }`. Ownership is enforced by the
server-side session cookie — plates and reservation IDs never grant access.

## Consistency design

- Unique indexes: Active reservation per spot, Active reservation per session,
  and `(owner_session_id, request_key)` for idempotency.
- Create and release run inside MongoDB transactions with conditional writes
  (`Available → Reserved`, `Active → Released`); any failure aborts the whole
  transaction, so partial writes are impossible.
- A retried create with the same key returns the original reservation — even
  after it was released — so late retries never create duplicates.

## Team

Team 5: Leigha Schilling, Kanza Fatima, Denise Ortiz, Nelson Hudgins, Yuhan Sun.
