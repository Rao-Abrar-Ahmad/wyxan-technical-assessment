# 0002 — Out-of-service resolution: return-first, auto-cancel standing reservations

## Status
Accepted

## Context
The brief requires assets to be takeable out of service, but leaves resolution of standing
issues/reservations against an asset going out of service as an explicit open decision
("your problem to resolve — decide, and say what you decided").

## Decision
- An asset cannot be marked out of service while currently issued. Damage discovered while
  a worker holds it is captured through the Return flow (which already has a "possibly
  damaged, going out of service" branch) — return and out-of-service-flagging happen as one
  action, not two. This avoids an "issued AND out of service" simultaneous state that would
  otherwise need special-casing throughout the rest of the system.
- Marking an in-store asset out of service automatically cancels all its future standing
  reservations. Each cancellation is its own system-authored Movement (visible in the
  asset's history), not a silent deletion.

## Alternatives considered
- Allow "out of service while issued" as a real simultaneous state. Rejected: creates a
  state combination every other rule (can it be reserved? can it be returned again?) would
  need to explicitly account for, for a case the real world doesn't actually produce (the
  keeper can't inspect what isn't at the hatch).
- Manual resolution: block the out-of-service action until the keeper explicitly
  clears/reassigns standing reservations. Rejected: adds a blocking UI step for a case
  where the honest outcome is unambiguous (an unserviceable asset cannot honor a future
  reservation), and leaves room for the asset to sit in limbo, unable to be marked out of
  service, if reservations aren't cleared.

## Consequences
- The Return action's "damaged" branch is really doing two things at once (return + out of
  service) — needs to be modelled as such in the Movement it produces, not squeezed into a
  plain return.
- System-authored cancellation Movements need a way to be distinguished from
  keeper/worker-authored ones (an "actor" or "reason" field), since there's no
  notification mechanism to tell an affected worker their reservation vanished — the
  audit trail is the only record.
