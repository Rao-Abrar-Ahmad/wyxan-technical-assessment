# Equipment Ledger — Technical Specification

This document is the complete build spec for the Equipment Ledger technical test. It is
written to be handed directly to a coding agent (or a human) to implement the full
application. It assumes no prior context beyond what's written here.

---

## 1. The problem, in one paragraph

A site store issues and receives back ~60 physical assets (tools/equipment) to/from ~12
workers. The system of record is a **ledger** — an append-only log of what happened and
when — not a set of "current status" rows that get overwritten. The hard requirements are
not the CRUD forms; they are four invariants that must hold under real concurrency and
real-world messiness: exactly one holder per asset at any instant, no double-booked
reservations, corrections that don't erase history, and the ability to answer "what did the
whole store look like at any past instant" from the ledger alone.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, TypeScript, Swagger (OpenAPI, auto-generated) |
| Database | MongoDB, deployed as a **replica set** (required for multi-document transactions) |
| Local DB | docker-compose, single-node Mongo replica set, zero external accounts needed |
| Alternative DB | MongoDB Atlas (M0 free tier — already a replica set by default) |
| Dev orchestration | npm workspaces + `concurrently` (colored log prefixes per app) |
| Deployment (primary) | Vercel (web) + Render (api) + Atlas (db) |
| Deployment (alternative) | Single combined Dockerfile, deployable to any VPS |

No authentication, no roles/permissions, no email, no file uploads, no barcode scanning, no
mobile app, no multi-site support — all explicitly out of scope per the brief.

---

## 3. Repository structure (monorepo)

```
/
├── apps/
│   ├── web/                  # Next.js app
│   └── api/                  # NestJS app
├── docker-compose.yml        # Mongo replica set for local dev
├── Dockerfile                # Combined image: builds + runs both apps for VPS deployment
├── package.json              # root workspace, "dev" script runs both apps via concurrently
├── .env.example
├── README.md
├── CONTEXT.md                # domain glossary (already drafted — see below)
└── docs/
    └── adr/
        ├── 0001-mutual-exclusion-via-guard-field.md
        └── 0002-out-of-service-resolution.md
```

Root `package.json` scripts:
- `npm run dev` — `concurrently -n WEB,API -c cyan,magenta "npm run dev -w apps/web" "npm run dev -w apps/api"`
- `npm run seed` — runs the seed script against `MONGODB_URI`
- `npm run test:invariants` — runs the invariant/concurrency/idempotency test suite only
- `npm run test` — full test suite (invariants + any unit tests)

---

## 4. Domain glossary

(Reproduced from `CONTEXT.md` — this is the vocabulary, not the schema.)

- **Asset** — a single physical item with an identity (`HARN-014`, not "a harness"). Has a
  kind, may require a certification, can be taken out of service and later brought back.
- **Worker** — a person who can hold assets. Holds zero or more certifications, each with
  an expiry date.
- **Reservation** — a claim on one asset for a future window of time, made by a worker.
- **Movement** — a single immutable fact recorded in the ledger. **Append-only** — the
  ledger is an event log, never a set of mutable rows. Current state (who holds what,
  what's reserved) is derived by folding Movements, never stored as the primary record.
- **Correction** — a new Movement that amends the `occurredAt` timestamp of an earlier
  Movement (timestamp only — not who/what). The corrected timestamp is authoritative for
  state-folding and "as of" reconstruction. The history view for that Movement always shows
  both the original entry and the correction, visibly marked.
- **Certification expiry** — everything is UTC. A certification is expired for gating an
  issue if `expiryDate <= today (UTC)` — expiring on the same calendar day as the issue
  already counts as expired. Valid only while `expiryDate > today (UTC)`.
- **Overdue** — only applies to an asset issued against a reservation, once held past that
  reservation's window end. Walk-in issues (no reservation) are never overdue.

---

## 5. Data model (MongoDB collections)

Normalized, referenced by `ObjectId` — not deeply embedded. Four collections:

### 5.1 `assets`

```ts
{
  _id: ObjectId,
  code: string,               // "HARN-014" — unique, human-facing identity
  kind: string,                // e.g. "harness", "gas-detector", "drill"
  requiresCertification: string | null,  // certification type required to issue, or null
  currentHolder: ObjectId | null,   // GUARD FIELD ONLY — see ADR-0001. Never read for history.
  isOutOfService: boolean,          // GUARD FIELD ONLY — mirrors latest OUT_OF_SERVICE/BACK_IN_SERVICE Movement
  createdAt: Date,
}
```

`currentHolder` and `isOutOfService` are **denormalised concurrency guards only** — per
ADR-0001, they exist purely so an atomic `findOneAndUpdate` can enforce mutual exclusion
without folding the event log on every request. They are never treated as the source of
truth for history or reconstruction; the Movement log is. They must be written to inside
the same transaction as the Movement that changes them, or they will drift.

Indexes: unique on `code`; index on `currentHolder`; index on `isOutOfService`.

### 5.2 `workers`

```ts
{
  _id: ObjectId,
  name: string,
  certifications: [
    { type: string, expiryDate: Date }   // date-only semantics; store as UTC midnight
  ],
  createdAt: Date,
}
```

### 5.3 `reservations`

```ts
{
  _id: ObjectId,
  assetId: ObjectId,
  workerId: ObjectId,
  windowStart: Date,
  windowEnd: Date,
  status: "PENDING" | "FULFILLED" | "CANCELLED",  // guard/query-convenience field, not history
  createdAt: Date,
}
```

`status` is denormalised for query convenience (e.g. "list active reservations") but the
Movement log (`RESERVE`, `CANCEL_RESERVATION`) remains the audit trail of what actually
happened and when.

Indexes: compound on `(assetId, windowStart, windowEnd)` for overlap queries; index on
`status`.

### 5.4 `movements` — the ledger, append-only, never updated or deleted

```ts
{
  _id: ObjectId,
  type: "ISSUE" | "RETURN" | "RESERVE" | "CANCEL_RESERVATION"
      | "OUT_OF_SERVICE" | "BACK_IN_SERVICE" | "CORRECTION",

  assetId: ObjectId,
  workerId: ObjectId | null,        // null for pure OUT_OF_SERVICE/BACK_IN_SERVICE on an asset with no holder context
  reservationId: ObjectId | null,   // set for RESERVE / CANCEL_RESERVATION, and ISSUE-against-a-reservation

  occurredAt: Date,      // when the event actually happened (keeper-entered, can be backdated)
  recordedAt: Date,      // when the server actually wrote this document (system clock, never backdated)

  keeperName: string,    // who was at the hatch, selected once at session start
  actor: "KEEPER" | "SYSTEM",   // SYSTEM for auto-cancellations per ADR-0002

  idempotencyKey: string,   // client-generated UUID, one per user action-instance

  // Only present on type === "CORRECTION":
  correctsMovementId: ObjectId | null,
  correctedOccurredAt: Date | null,
  correctionReason: string | null,

  // Only present on type === "RETURN":
  condition: "OK" | "DAMAGED" | null,   // DAMAGED triggers an implicit OUT_OF_SERVICE effect — see 6.4

  meta: Record<string, unknown> | null,  // free-form, e.g. cancellation reason for CANCEL_RESERVATION
}
```

Indexes: unique on `idempotencyKey`; compound on `(assetId, occurredAt)` for folding;
compound on `(occurredAt)` for whole-store "as of" queries.

**Nothing in this collection is ever updated or deleted, at the application layer, under
any circumstance.** A correction is a new document. A cancelled reservation is a new
document. This is what makes "the history must show a correction was made" and "any
instant, answerable" true by construction rather than by discipline.

---

## 6. Invariant enforcement — the mechanisms

### 6.1 Mutual exclusion (ADR-0001)

Issue request flow:
1. Client generates an `idempotencyKey` (UUID) once, when the confirm action is first
   invoked (not regenerated on retry).
2. Server starts a MongoDB session/transaction.
3. Inside the transaction: `findOneAndUpdate({ _id: assetId, currentHolder: null,
   isOutOfService: false }, { $set: { currentHolder: workerId } })`.
   - If this matches **zero** documents: someone else holds it, or it's out of service.
     Abort the transaction, return `409 Conflict` with a human-readable reason
     ("already held by <worker>" vs "asset is out of service").
   - If it matches: proceed.
4. Certification check (if `asset.requiresCertification` is set): look up the worker's
   certification of that type, apply the expiry rule from §4. If invalid, abort the
   transaction and return `422 Unprocessable Entity` with the specific reason (no
   certification of that type / expired on `<date>`).
5. Insert the `ISSUE` Movement document (with the idempotency key) inside the same
   transaction.
6. Commit. On commit success, return `201 Created` with the Movement.
7. Any transaction abort due to a write conflict (a genuine race at the transaction level,
   distinct from the guard-field mismatch in step 3) → catch, return `409 Conflict`, and the
   client is expected to not auto-retry with a new idempotency key (it should surface the
   conflict to the keeper).

Return flow is symmetric: `findOneAndUpdate({ _id: assetId, currentHolder: { $ne: null
} }, { $set: { currentHolder: null } })`, with the Movement's `workerId` recording who
physically returned it (which per the brief may differ from `currentHolder` at time of
return — that's fine, it's just who's named as returning it, the guard field only cares that
*someone* held it).

### 6.2 Idempotency

- On any mutating endpoint, before doing anything else: check for an existing Movement (or
  correction/reservation write) with the given `idempotencyKey`.
  - If found and the request payload matches (deep-equal on the semantically relevant
    fields) → return the original response again, same status code, same body. True no-op
    replay.
  - If found and the payload differs → `409 Conflict`, "this action was already submitted
    with different details."
  - If not found → proceed with the normal flow, which ends in inserting a document
    carrying this key. The unique index on `idempotencyKey` is the actual safety net — even
    if the "check first" step has its own race, the unique index will reject a genuine
    double-insert at the database level, which the API layer catches and treats as case (a)
    above (re-fetch by key, return that result).

### 6.3 Reservation overlap

1. Client submits `{ assetId, workerId, windowStart, windowEnd }` with an idempotency key.
2. Server starts a transaction.
3. Inside it: query `reservations` for `assetId` where `status != "CANCELLED"` and the
   window overlaps (`windowStart < existing.windowEnd AND windowEnd > existing.windowStart`
   — strict inequality, so adjacent windows are allowed, matching "adjacent is fine,
   overlapping is not").
4. If any match found → abort, `409 Conflict`.
5. Otherwise, also check the asset isn't out of service (`isOutOfService: false`) → if it
   is, abort, `422`.
6. Insert the `reservations` document and the `RESERVE` Movement, both inside the
   transaction. Commit.

No artificial cap on reservation duration or how far in the future it can start — "reserve
for a whole year" is allowed unless it overlaps something, per the brief's own scenario
list testing exactly this.

### 6.4 Out-of-service resolution (ADR-0002)

- There is **no standalone "mark out of service" action while an asset is issued.** The
  only way an issued asset becomes out of service is through the Return flow, where
  `condition: "DAMAGED"` is selected. That single action produces **two** effects
  atomically in one transaction: a `RETURN` Movement (with `condition: "DAMAGED"`) and an
  `OUT_OF_SERVICE` Movement, plus flipping both `currentHolder: null` and
  `isOutOfService: true` on the Asset guard fields.
- Marking an **in-store** asset out of service (a separate, simpler action — asset must
  have `currentHolder: null` already) is a direct `OUT_OF_SERVICE` Movement. In the same
  transaction: query all `reservations` for that asset with `status: "PENDING"` and
  `windowEnd > now`, and for each one, insert a `CANCEL_RESERVATION` Movement with
  `actor: "SYSTEM"` and set the reservation's `status: "CANCELLED"`.
- `BACK_IN_SERVICE` is the inverse direct action: only valid when `isOutOfService: true`
  and `currentHolder: null`; flips the guard field and inserts the Movement.

### 6.5 Corrections

- A `CORRECTION` Movement is created via a dedicated endpoint, referencing an existing
  Movement by `correctsMovementId`, carrying `correctedOccurredAt` and a required
  `correctionReason` (free text, keeper explains why).
- No other field of the original Movement can be corrected — only `occurredAt`. Attempting
  to correct anything else is not supported by the API surface at all (not merely
  validated away) — this is a deliberate, documented scope limitation, not an oversight.
- **Reconstruction reads corrections as authoritative**: when folding Movements up to
  instant T, for any Movement that has one or more corrections, use the **latest
  correction's** `correctedOccurredAt` as its effective timestamp for ordering and
  inclusion, not its original `occurredAt`.
- **History/audit views never hide the original**: `GET /assets/:id/history` returns every
  Movement including corrected ones with their original `occurredAt` intact, plus the
  correction Movements themselves, so a viewer can see both the mistake and the fix.

### 6.6 "As of" reconstruction

- No snapshotting (per discussion — data volume doesn't justify it).
- `GET /reconstruct?asOf=<ISO instant>` — for every asset, fold all Movements with
  effective timestamp `<= asOf` (effective timestamp = latest correction's
  `correctedOccurredAt` if corrected, else `occurredAt`), ordered by effective timestamp
  ascending, reducing type-by-type to: current holder (if any), out-of-service flag,
  active reservations as of that instant. This is computed live, per request — never read
  from `currentHolder`/`isOutOfService` on the Asset document (those are guards for *now*,
  not for arbitrary past instants).
- `GET /assets/:id/history?asOf=<optional>` — same folding logic, scoped to one asset,
  returning the full ordered Movement list (including corrections, unfiltered) plus the
  derived state at that instant if `asOf` is given.

---

## 7. API surface (NestJS, REST, Swagger-documented)

```
POST   /assets/:id/issue          { workerId, reservationId?, idempotencyKey }
POST   /assets/:id/return         { workerId, condition, occurredAt?, idempotencyKey }
POST   /assets/:id/reserve        { workerId, windowStart, windowEnd, idempotencyKey }
POST   /reservations/:id/cancel   { idempotencyKey }
POST   /assets/:id/out-of-service { idempotencyKey }
POST   /assets/:id/back-in-service{ idempotencyKey }
POST   /movements/:id/correct     { correctedOccurredAt, correctionReason, idempotencyKey }

GET    /assets                    ?kind=&status=       (Store view)
GET    /assets/:id                
GET    /assets/:id/history        ?asOf=
GET    /workers
GET    /reservations              ?assetId=&status=
GET    /reconstruct               ?asOf=
```

All mutating endpoints return `201`/`200` on success, `409` for guard/conflict failures
(concurrent issue, overlapping reservation, idempotency payload mismatch), `422` for
business-rule refusals (certification expired, out of service), `404` for missing
references. Every error body includes a human-readable `reason` string — the brief
explicitly wants refusals "with a reason a human can read."

Swagger UI mounted at `/api/docs` on the NestJS app.

NestJS module boundaries: `AssetsModule`, `WorkersModule`, `ReservationsModule`,
`MovementsModule` (owns the ledger-writing logic and is the only module allowed to write to
`movements` — every other module's mutating actions go through `MovementsService` so the
guard-field-plus-Movement transaction pattern lives in exactly one place), `ReconstructModule`.

---

## 8. Frontend — routes, modals, UX

Routes:
- `/` — keeper select. A simple list of worker/keeper names (same "pick a name from a
  list" mechanism used for workers elsewhere). Stored in client state (e.g. a lightweight
  context/provider, or persisted to `sessionStorage` so a refresh mid-session doesn't lose
  it) — not sent to any backend "login" endpoint, since there is none.
- `/store` — dense table: asset code, kind, status badge (in store / issued to `<worker>` /
  reserved / out of service), row actions opening the Issue/Return/Reserve modals. Filter
  by kind and status. Skeleton loading state while the asset list fetches.
- `/assets/:id` — full Movement history timeline for one asset, corrections visibly
  marked (e.g. a "corrected" badge with a tooltip/expand showing the original value), entry
  point to open the Correct modal on any Movement.
- `/reconstruct` — a datetime picker for `asOf`, then the whole store rendered as it stood
  at that instant, same table shape as `/store`.

Modals: Issue, Return (with a condition toggle: OK / Damaged), Reserve (with overlap error
surfaced inline, not as a generic toast), Correct (shown from `/assets/:id`, pick timestamp
+ reason).

Styling: shadcn/ui components, Tailwind, color-coded status badges (green = in store,
blue = issued, amber = reserved, red = out of service), skeleton loaders on every async
data fetch, no charts/KPI cards/dashboard widgets — this is an operational tool, not a
reporting one.

---

## 9. Seed data

Deterministic, idempotent (`npm run seed` twice does not double the store — either the
script checks for an existing marker document and no-ops, or it clears and re-seeds the
collections it owns). Contents, per the brief's minimums:

- **~60 assets** across ~6-8 kinds (e.g. harness, gas-detector, drill, ladder, generator,
  radio), a subset requiring certification (map specific kinds to a specific certification
  type), **at least 1 out of service**.
- **~12 workers**, each with 0-2 certifications; **at least 1 expired** certification,
  **at least 1 expiring inside the seeded 30-day window** (per §4's rule: expiring exactly
  on a date at or before "today" in the seed's frame of reference counts as expired — so
  pick a date that lands strictly after the seed's "as of now" reference point if the
  intent is to demonstrate a *still-valid-but-soon-to-expire* cert, and strictly before it
  to demonstrate a refusal).
- **30 days of movements**: a realistic mix of ordinary issue/return pairs, a handful still
  outstanding (currently issued, no return yet), **at least 1 overdue** (issued against a
  reservation whose window has passed), **at least 1 late-logged entry** (`recordedAt`
  meaningfully after `occurredAt`), **at least 1 correction** (a `CORRECTION` Movement
  referencing an earlier one).
- **Reservations**, past and future, **including one that was never collected** (window
  passed, never converted to an `ISSUE`).

---

## 10. Testing — `npm run test:invariants`

A dedicated suite, separate from any general unit tests, run against a real API instance
and a real Mongo replica set (test-specific database, torn down/reset between runs):

1. **Concurrency**: fire N concurrent issue requests (`Promise.all`) for the same in-store
   asset; assert exactly one `201`, the rest `409`; assert directly against Mongo that
   exactly one `ISSUE` Movement exists and `currentHolder` matches the winner.
2. **Idempotency**: submit the same issue request twice with the same idempotency key;
   assert one Movement, identical response bodies both times. Then submit a request with a
   reused key but a different payload; assert `409`.
3. **Reservation overlap**: fire concurrent overlapping reservation requests; assert
   exactly one succeeds.
4. **Certification gate**: issue against a worker with an expired cert (including one
   expiring exactly on the issue date); assert `422` with the specific reason.
5. **Out-of-service blocking**: attempt issue/reserve against an out-of-service asset;
   assert `422`. Take an in-store asset with a standing future reservation out of service;
   assert the reservation is auto-cancelled with a `SYSTEM`-actor Movement.
6. **Correction & reconstruction**: seed a known sequence of Movements including a
   correction; assert `/reconstruct?asOf=` and `/assets/:id/history` both reflect the
   corrected timestamp for state purposes while the history endpoint still shows the
   original.
7. **Backdating edge cases**: return with `occurredAt` before the corresponding issue's
   `occurredAt`; assert this is rejected (a movement can't precede the one it follows on
   the same asset) — the exact behavior here (reject vs. accept-and-flag) is a judgment
   call to make explicit in the README if the coding agent implementing this needs to
   choose a specific error message/behavior not otherwise pinned down here.

---

## 11. Environment variables (`.env.example`)

```
MONGODB_URI=mongodb://localhost:27017/equipment-ledger?replicaSet=rs0
# For Atlas instead: mongodb+srv://<user>:<password>@<cluster>.mongodb.net/equipment-ledger

API_PORT=4000
WEB_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

No secrets are committed. `.env.example` ships in the repo; `.env` is gitignored.

---

## 12. Deployment

- **Frontend** → Vercel, `apps/web`, env var `NEXT_PUBLIC_API_URL` pointing at the deployed
  API.
- **Backend** → Render, `apps/api`, built from its own Dockerfile within the monorepo
  (Render supports monorepo subdirectory builds), env var `MONGODB_URI` pointing at Atlas.
- **Database** → MongoDB Atlas, free M0 tier (already a replica set by default — no extra
  transaction-support configuration needed).
- **Alternative — single VPS**: a combined root `Dockerfile` that builds both apps in
  stages and runs them (e.g. via a small process manager or two exposed ports behind one
  container), so the whole thing can be deployed anywhere Docker runs without depending on
  three separate platform accounts.

---

## 13. README requirements checklist

The README must cover, per the brief, explicitly:
- How to run both sides (local, via `npm run dev`, plus the deployed URLs if used).
- How to seed (`npm run seed`), and that it's safe to run repeatedly.
- How to run the invariant checks (`npm run test:invariants`).
- The model chosen and why (append-only Movement log + denormalised guard fields — point
  at ADR-0001).
- How concurrent issue was made impossible — point at ADR-0001, name the exact mechanism
  (atomic `findOneAndUpdate` + transaction), not just "we used MongoDB."
- What you'd do with another day (candidates: `BACK_IN_SERVICE` UI polish, richer
  correction scope, snapshot-based reconstruction if data volume grew, notifications for
  auto-cancelled reservations).
- What was knowingly left out and why (auth/roles — explicitly out of scope per brief;
  correcting worker/asset on a Movement — deliberately narrowed to timestamp-only, see §6.5;
  default due-back time for walk-in issues — deliberately not invented, see §4 Overdue).

---

## 14. Known limitations (carry into README verbatim, adjust as implementation reveals more)

- Corrections amend only `occurredAt`, never the worker or asset on a Movement.
- Walk-in issues (no reservation) have no due-back time and can never be "overdue."
- Out-of-service cannot be applied to a currently-issued asset directly — it must go
  through the Return flow's "damaged" branch.
- No notification mechanism exists for workers whose future reservation was
  system-cancelled when their asset went out of service — the only record is the ledger
  itself.
- No snapshotting for reconstruction — acceptable at this data volume, would need
  revisiting if the ledger grew to years of history.
