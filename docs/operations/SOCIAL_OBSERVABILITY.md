# Codestra Social observability and runbooks

## Endpoints

- `/monitor/live` proves only that the backend process can serve requests.
- `/monitor/ready` verifies PostgreSQL, Redis, Temporal, and immutable release
  identity. It returns 503 when a required dependency is unavailable.
- `/monitor/version` returns source revision, image digest, image version, and
  build timestamp.
- `/monitor/metrics` exposes Prometheus text only when `METRICS_ENABLED=true`
  and the exact proxy address appears in `METRICS_ALLOWED_IPS`.
- The orchestrator provides corresponding `/health/live`, `/health/ready`, and
  `/health/version` endpoints. `/health/status` remains a readiness alias.

Metrics contain aggregate counts only. Tenant IDs, post contents, provider
tokens, callback bodies, authorization headers, and signing material must never
be labels or logs.

## Outbox dead-lettered

1. Keep publishing and replay flags unchanged; do not bulk replay.
2. Inspect the event ID, error code, attempt count, Middleware availability, and
   Keycloak/mTLS identity without printing secrets or payload content.
3. Confirm Middleware has no inbox row for the event ID. If it does, reconcile
   the acknowledgement instead of redelivering.
4. Repair the underlying contract or dependency and replay a single event
   through an audited operator procedure.

## Outbox stalled

Check the orchestrator readiness endpoint, worker logs, expired leases,
Keycloak client credentials, Middleware acknowledgement behavior, and network
policy. A leased row older than its lease may be reclaimed automatically. Do not
edit row state by hand.

## Delivery failures

Compare each failed channel with the provider's authoritative status and the
Codestra Social provider result. Retry only the failed channel. Never republish a
channel already recorded as published.

## Provider inbox failures

An inbox failure means the HMAC was valid but tenant/provider ownership, event
state, or delivery identity was not acceptable. Treat repeated failures as a
possible compromised worker or contract drift. Do not weaken signature or state
transition checks.

## Dependency down

PostgreSQL, Redis, and Temporal are required for readiness. Use the deployment
rollback procedure if the outage follows a release. Redis loss must not be
treated as loss of durable audit state; PostgreSQL remains authoritative.

## Unsafe flags

Publishing requires both `SOCIAL_PUBLISHING_ENABLED=true` and
`ENABLE_EXTERNAL_DELIVERY=true`, with `PUBLISHING_KILL_SWITCH=false`. If the
combination is inconsistent, restore the approved fail-closed values and audit
the configuration change. Enabling any flag requires the protected release
gate, canary, provider sandbox evidence, and an approved rollback point.
