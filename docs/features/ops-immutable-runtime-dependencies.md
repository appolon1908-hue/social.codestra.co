# OPS immutable runtime dependencies

## Outcome and authority

The production-like Compose source resolves every literal PostgreSQL, Redis,
Elasticsearch, and Temporal service image through a reviewed SHA-256 OCI index
digest while retaining readable version tags. Registry manifests were resolved
read-only from Docker Hub on 2026-09-01.

Codestra Social source controls these dependency references. This change does
not claim that any image is deployed, authorize a pull or rollout, or establish
the live container tuple.

## Release context

- Branch: `ops/be-immutable-runtime-dependencies`
- Base branch: `main`
- Base SHA: `4f7817f6c6d1bb38fa7d85bb1656eb41865283d5`
- Expected PR: assigned when opened
- Production deployment: no
- Live capabilities enabled: no

## Scope and contracts

Pinned services are application PostgreSQL, Redis, Temporal Elasticsearch,
Temporal PostgreSQL, Temporal server, Temporal administration tools, and
Temporal UI. The application image and optional debug Spotlight image remain
required deployment inputs because their immutable digest is produced or
selected by separate release authority.

No API, event, schema, migration, tenant policy, idempotency, concurrency,
outbox/inbox, provider, or business-write behavior changes.

## Validation

The production image validator now rejects every literal `docker-compose.yaml`
image without `@sha256:<64 hex>`, in addition to rejecting moving `latest`
references. Focused tests require seven pinned infrastructure images, retain the
two explicit immutable deployment inputs, and reject `latest`.

Compose interpolation is validated using non-secret placeholders. Exact-head CI
must still pass migration replay, security tests, backend/orchestrator builds,
and hardened candidate-image inspection.

## Rollback and remaining gates

Rollback is a reviewed source reversion to a previously approved digest; tags
must not be restored as runtime authority. A separately reviewed dependency
update must resolve and test replacement manifests before changing a digest.

This feature does not prove registry retention, vulnerability acceptance,
current/previous deployed digests, backup/restore, or rollback execution. Those
remain production-certification gates.

`LIVE_CAPABILITIES_ENABLED=NO`

`PRODUCTION_DEPLOYED=NO`

`LIVE_SERVER_CHANGED=NO`
