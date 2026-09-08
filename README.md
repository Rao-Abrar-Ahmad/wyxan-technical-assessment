# Equipment Ledger

> A site store issues and receives back physical assets to and from workers. The system of record is an **append-only ledger** — an immutable event log of what happened and when — not a set of mutable "current status" rows that get overwritten.

---

## 1. Quick Start & How to Run Both Sides

### Prerequisites
- **Node.js**: v18+ (tested on Node v20 / v24)
- **MongoDB**: A MongoDB replica set is required for multi-document transactions (e.g., local Docker, Atlas M0, or the automated embedded `mongodb-memory-server` replica set).
- **Zero-Config Fallback**: If `MONGODB_URI` is not set or local Mongo is not running, the application and invariant test runner automatically initialize an in-memory replica set (`MongoMemoryReplSet`) on `rs0` with WiredTiger and transactions enabled. Zero external accounts or setup required!

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default values:
```env
MONGODB_URI=mongodb://localhost:27017/equipment-ledger?replicaSet=rs0
API_PORT=4000
WEB_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Running Locally
Run both the Next.js frontend and NestJS backend concurrently:
```bash
npm install
npm run dev
```
- **Web UI**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:4000](http://localhost:4000)
- **OpenAPI / Swagger Documentation**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

### Docker Compose (Optional)
To run MongoDB as a local replica set in Docker:
```bash
docker compose up -d
```

---

## 2. Seeding the Store (`npm run seed`)

The database seed populates 30 days of realistic history.

```bash
npm run seed
```

### Repeatability & Determinism
`npm run seed` is **idempotent and deterministic**: running it multiple times cleans the store collections and re-seeds the exact same baseline:
- **~60 assets** across 8 kinds (`harness`, `gas-detector`, `tripod`, `drill`, `ladder`, `generator`, `radio`, `grinder`).
  - Specific kinds require certification: `harness` requires *"Working at Heights"*; `gas-detector` and `tripod` require *"Confined Spaces"*.
  - **2 assets out of service** (`DRIL-004` motor failure, `HARN-008` webbing frayed).
- **12 workers** with realistic certification profiles:
  - At least 1 worker with an **expired** certificate (Marcus Vance, expired 2 days ago).
  - At least 1 worker with a certificate **expiring in the 30-day window** (Elena Rostova, expiring in 12 days).
  - Workers with valid certificates and workers without certificates.
- **30 days of append-only movements**:
  - Realistic issue/return history.
  - Active outstanding issues (`DRIL-002`, `GASD-001`).
  - **1 overdue issue** (`HARN-001` issued against a reservation whose window ended yesterday, held past the due window).
  - **1 late-logged entry** (`LADD-002` return occurred at 09:00, recorded at 11:40).
  - **1 correction movement** (`DRIL-001` issue occurredAt corrected from 10:30 to 08:30 with mandatory reason).
- **Reservations**:
  - **1 uncollected reservation** (`GENR-001` window passed, never converted to an issue).
  - Active upcoming reservations for workers.

---

## 3. Invariant Test Suite (`npm run test:invariants`)

To run the automated invariant and concurrency test suite:

```bash
npm run test:invariants
```

This dedicated suite executes against real MongoDB multi-document transactions and verifies all 7 critical assessment invariants:
1. **Concurrency**: Fires $N$ concurrent `issue` requests (`Promise.all`) for the same in-store asset $\rightarrow$ asserts exactly one `201 Created` and remaining $N-1$ receive `409 Conflict`. Verifies directly against MongoDB that exactly one `ISSUE` movement exists and `currentHolder` matches the winning worker.
2. **Idempotency**: Submits an issue request twice with the same `idempotencyKey` $\rightarrow$ verifies identical response bodies, no duplicate movements. Submitting the same key with an altered payload fails with `409 Conflict`.
3. **Reservation Overlap**: Submits concurrent overlapping reservation windows $\rightarrow$ asserts exactly one succeeds with `201`, overlapping attempts receive `409 Conflict`.
4. **Certification Gate**: Attempts to issue an asset requiring certification to a worker whose certificate expired yesterday (or on the issue date) $\rightarrow$ rejects with `422 Unprocessable Entity` with a clear, readable explanation.
5. **Out-of-Service Blocking & System Auto-Cancellation**: Attempting to issue or reserve an out-of-service asset returns `422`. Taking an in-store asset with a standing future reservation out of service automatically cancels the reservation with `actor: "SYSTEM"` audit entries.
6. **Correction & Reconstruction**: Verifies that when a movement is corrected via `POST /movements/:id/correct`, `/reconstruct?asOf=` uses the corrected timestamp for state calculation, while `/assets/:id/history` preserves both original and correction records.
7. **Backdating Protection**: Attempting to return an asset with an `occurredAt` earlier than its issue's `occurredAt` is rejected with `422`.

---

## 4. Architectural Model Chosen & Why

### The Model: Append-Only Event Log + Denormalised Concurrency Guards
The application architecture is grounded in **Event Sourcing with Concurrency Guards**, specified in [docs/adr/0001-mutual-exclusion-via-guard-field.md](docs/adr/0001-mutual-exclusion-via-guard-field.md):
- **Source of Truth**: The `movements` collection is strictly append-only. No document in `movements` is ever edited or deleted at the application layer. Historical queries, audit timelines, and point-in-time reconstructions (`/reconstruct?asOf=`) are computed by folding movements live.
- **Concurrency Guards**: Determining whether an asset is available by folding the entire log on every issue request is slow and vulnerable to race conditions between two concurrent folds. Therefore, the `Asset` document maintains two denormalised fields: `currentHolder` (`ObjectId | null`) and `isOutOfService` (`boolean`).
- **Transactional Atomic Boundary**: Every mutating operation updates the guard field and inserts the corresponding `Movement` document inside the **same MongoDB multi-document transaction**. If either fails or conflicts, the entire transaction rolls back.

---

## 5. How Concurrent Issue Was Made Impossible

Rather than relying on vague assurances like "Mongo is fast enough", mutual exclusion is enforced by construction at the database level:

```typescript
// From MovementsService.ts:
const updatedAsset = await this.assetModel.findOneAndUpdate(
  {
    _id: assetId,
    currentHolder: null,       // Concurrency Guard
    isOutOfService: false,     // Concurrency Guard
  },
  {
    $set: { currentHolder: workerId },
  },
  { session, new: false }
);
```

### The Mechanism
1. Inside a MongoDB session/transaction, `findOneAndUpdate` executes atomically on the storage engine matching `{ _id: assetId, currentHolder: null, isOutOfService: false }`.
2. When two requests arrive in the exact same millisecond:
   - The first request matches the document, sets `currentHolder: workerId`, locks the document for the transaction, and proceeds.
   - The second request either fails to match (`matchedCount === 0`) because `currentHolder` is no longer null, or encounters a write conflict detected by the wiredTiger engine.
3. If zero documents match, the server inspects the asset state, immediately aborts the transaction, and returns a descriptive `409 Conflict` ("Asset is already held by worker X").
4. The client surfaces this refusal to the hatch keeper without auto-retrying under a new idempotency key.

---

## 6. Out-of-Service Resolution (ADR-0002)

Per [docs/adr/0002-out-of-service-resolution.md](docs/adr/0002-out-of-service-resolution.md):
1. **Issued Assets**: An asset cannot be marked out of service while held by a worker. Damage discovered during use is captured via the Return flow with `condition: "DAMAGED"`. This single user action atomically records both a `RETURN` movement and an `OUT_OF_SERVICE` movement in one transaction, avoiding an impossible "issued AND out of service" dual state.
2. **In-Store Assets**: Marking an in-store asset out of service automatically cancels all future standing reservations with `actor: "SYSTEM"` movements in the ledger audit log.

---

## 7. What We'd Do With Another Day

1. **Worker Notification System**: When standing reservations are auto-cancelled due to equipment damage, trigger asynchronous SMS/push notifications to notify workers and suggest alternative assets of the same kind.
2. **Snapshot-Based Compaction for High Volume**: If the ledger grew to hundreds of thousands of events over multiple years, introduce periodic cryptographically hashed snapshot checkpoints to accelerate reconstruction queries.
3. **QR / NFC Hatch Scanner Mode**: Add instant camera/barcode scanning to speed up hatch transactions for high-throughput site stores.
4. **Offline PWA Queue**: Allow the keeper's browser to queue operations locally in IndexedDB if site Wi-Fi drops, synchronizing idempotently once connectivity resumes.

---

## 8. What Was Knowingly Left Out and Why

- **Authentication & Roles**: Explicitly out of scope per the brief. The hatch keeper is identified by selecting their name from a list, persisted in client session state.
- **Editing Non-Timestamp Fields on Corrections**: Deliberately restricted to `occurredAt` only (§6.5). If a keeper issued equipment to the wrong worker, the real-world remedy is to record a return and re-issue, rather than rewriting past identity facts.
- **Default Loan Duration for Walk-In Issues**: Walk-in issues have no due-back time and can never be marked "overdue" (§4). Overdue status strictly applies to issues against an explicit reservation window.

---

## 9. Known Limitations (Verbatim from §14)

1. Corrections amend only `occurredAt`, never the worker or asset on a Movement.
2. Walk-in issues (no reservation) have no due-back time and can never be "overdue."
3. Out-of-service cannot be applied to a currently-issued asset directly — it must go through the Return flow's "damaged" branch.
4. No notification mechanism exists for workers whose future reservation was system-cancelled when their asset went out of service — the only record is the ledger itself.
5. No snapshotting for reconstruction — acceptable at this data volume, would need revisiting if the ledger grew to years of history.