# Outcome

OUTCOME=
BASE_BRANCH=main
BASE_SHA=
HEAD_SHA=

# Contracts and persistence

PUBLIC_API_OPERATIONS_ADDED_OR_CHANGED=NONE
PRIVATE_API_OPERATIONS_ADDED_OR_CHANGED=NONE
OPENAPI_VERSION=UNCHANGED
ASYNCAPI_EVENTS_ADDED_OR_CHANGED=NONE
DATABASE_MIGRATIONS=NONE
TENANT_ISOLATION_CONTROLS=
IDEMPOTENCY_AND_CONCURRENCY=
OUTBOX_OR_INBOX_IMPACT=NONE

# Safety and evidence

CAPABILITY_FLAGS=UNCHANGED
LIVE_CAPABILITIES_ENABLED=NO
PRODUCTION_DEPLOYED=NO
TEST_COMMANDS=
CI_RUN_URL=
ROLLBACK_OR_FORWARD_FIX=

## Authority and design

- Authoritative service and durable store:
- URLs and stable operation IDs changed:
- Duplicate command/event behavior:
- Cross-tenant denial mechanism:
- Unknown external-outcome reconciliation:
- Migration/backfill/restore plan:
- Logs, metrics, alerts, and audit effects:
- Why this can merge independently into `main`:

## Checklist

- [ ] This PR targets `main` from current green `main`.
- [ ] The applicable `docs/features/` specification is current.
- [ ] Contracts, examples, URL registry, SDKs, and drift evidence are current.
- [ ] Tenant isolation, idempotency, concurrency, and replay tests are included.
- [ ] Migrations are forward-only, separately invoked, and replay-tested.
- [ ] No direct cross-system or authoritative n8n/Redis behavior was added.
- [ ] Dangerous capabilities default false and are checked during execution.
- [ ] No secrets, generated reports, moving images, or stale evidence are committed.
- [ ] Exact-head CI is green; this PR will not be self-merged.
