# 0001 — Mutual exclusion via a denormalised guard field, not log-folding

## Status
Accepted

## Context
Movements are an append-only event log (source of truth for history and reconstruction).
"One holder, ever" must still be enforced atomically under real concurrency — two issue
requests for the same asset can arrive at the same instant and exactly one must win.
Folding the full event log on every issue request to determine current state is both slow
and itself racy between two concurrent folds.

## Decision
The Asset document carries a denormalised `currentHolder` field that is NOT the source of
truth for history — it exists purely as a concurrency guard. Issuing an asset is an atomic
`findOneAndUpdate` matching on the expected prior guard value (e.g. `currentHolder: null`);
zero documents matched means someone else won the race, and the request fails with a 409.
The guard flip and the corresponding Movement append happen together inside a MongoDB
multi-document transaction, which requires a replica-set deployment (single-node replica
set is sufficient for dev/docker-compose; standalone `mongod` is not enough).

## Alternatives considered
- Fold recent Movements for the asset inside a transaction on every write, with no
  denormalised field, relying on Mongo's transaction-level write-conflict detection alone.
  Rejected: pays a fold cost on every issue request for no correctness benefit over the
  guard-field approach, and is harder to point at as "the one line that makes it impossible."

## Consequences
- Requires a MongoDB replica set even in local/dev environments (docker-compose must run
  Mongo with `--replSet` and an rs.initiate(), not a plain single mongod instance).
- The guard field must be kept perfectly in sync with the Movement log by construction —
  every code path that appends an issue/return Movement must also flip the guard in the
  same transaction, or the two can drift.
- Reservation overlap checks will likely need an analogous atomic-check-then-write pattern
  (open question, not yet decided).
