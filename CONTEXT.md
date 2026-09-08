# CONTEXT.md — Equipment Ledger

Glossary of resolved terms. No implementation details — see docs/adr/ for design decisions and the tech spec for implementation.

## Movement

A single immutable fact recorded in the ledger: an asset went to a worker, came back, a reservation was made or cancelled, an asset went out of service (or back in), or a prior Movement was corrected.

Movements are **append-only** — the ledger is an event log, never a set of mutable rows. Current state (who holds what, what's reserved) is derived by folding Movements, not stored as the primary record. A correction is itself a new Movement that references and amends an earlier one; the earlier Movement is never edited or deleted.

## Correction

A new Movement that amends the `occurred_at` timestamp of an earlier Movement (timestamp only — correcting the wrong worker or wrong asset is out of scope, treated as a known limitation). The corrected timestamp is authoritative for state-folding and "as of" reconstruction — it represents the keeper telling us the truth. The history/audit view for that Movement always shows both the original entry and the correction, visibly marked as corrected; the original is never hidden or deleted.

## Certification expiry

All dates and times are fixed to UTC — there is no locale/timezone concept anywhere in the system. A certification is expired for the purpose of gating an issue if `expiryDate` is on or before the calendar date of the issue attempt (UTC). A certification is only valid to issue against while `expiryDate` is strictly after today (UTC) — expiring on the same calendar day as the issue already counts as expired.

## Overdue

Only applies to an asset issued against a reservation: it is overdue once held past that reservation's window end. A walk-in issue (no reservation) has no due-back time and can never be overdue — there is nothing to be overdue against. This is a deliberately narrower reading than the lifecycle diagram might suggest; no default loan duration is invented for walk-in issues.
