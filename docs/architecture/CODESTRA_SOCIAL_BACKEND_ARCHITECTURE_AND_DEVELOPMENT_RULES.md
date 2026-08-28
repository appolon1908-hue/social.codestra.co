# Codestra Social Backend Architecture and Development Rules

Status: **Binding engineering standard**  
Scope: `apps/backend`, `apps/orchestrator`, backend libraries, Prisma schema and
migrations, APIs, jobs, events, adapters, tests, images, and release evidence.  
Product API: `https://api.codestra.co/v2/social/*`

The words MUST, MUST NOT, REQUIRED, FORBIDDEN, and BLOCKING are literal release
rules. This document applies to humans and automated coding agents.

## Non-negotiable invariants

- `main` MUST contain backend CI, migration and contract validation, and an
  immutable release workflow. Evidence MUST belong to the exact PR and merged
  commit; committed reports are not evidence.
- Every backend PR targets `main`. Deep feature-branch stacks, direct pushes,
  routine admin bypass, force pushes, and branch deletion are forbidden.
- PostgreSQL is authoritative for durable product state. Redis, Temporal, queues,
  caches, n8n, and providers are never the sole correctness truth.
- Middleware is the only cross-system write boundary. Direct writes to Odoo,
  n8n, Klyrow, Telnexa, or another Codestra product are forbidden.
- Codestra Social owns social-domain state, publication intent, per-channel
  delivery state, provider-account metadata, and OAuth-token custody.
- n8n MUST NOT hold provider tokens, call providers, write product databases,
  authorize tenants, or become the publication ledger.
- APIs are OpenAPI-first; durable events are AsyncAPI-first. Routes, operation
  IDs, scopes, tenant rules, schemas, errors, idempotency, audit effects, and
  tests are explicit.
- Commands, callbacks, and Middleware events are durable, idempotent, and replay
  safe. Unknown provider outcomes are reconciled; they are not guessed.
- Every tenant-owned model, repository query, job, cache key, lease, storage
  prefix, event, and metric is tenant-scoped and fails closed.
- Schema changes use reviewed forward migrations. `prisma db push`, destructive
  reset, `--accept-data-loss`, and application-startup migrations are forbidden
  outside disposable local development.
- Production images and manifests use Codestra-built SHA-256 digests. `latest`
  is forbidden.
- Publishing, provider writes, callbacks, outbox delivery, replay, billing,
  Odoo, n8n, Klyrow, Telnexa, and production deployment default to disabled.

## Git and review model

`main` is the only permanent source branch. Staging is an environment promoted
from immutable `main` artifacts. Retire `develop` and `staging` after unique work
is reconciled.

Allowed branches:

- `be/<issue>-<description>`
- `fix/be-<issue>-<description>`
- `contract/<issue>-<description>`
- `data/<issue>-<description>`
- `ops/be-<issue>-<description>`
- `security/<issue>-<description>`

Branches start from green `main`, target `main`, remain backward compatible,
keep incomplete work behind disabled flags, and should live under seven days.
PRs should remain below 700 non-generated lines and 25 non-generated files. A
temporary two-PR stack requires an owner, merge order, 48-hour limit, and one
integration run; deeper stacks are prohibited. Feature/fix PRs are squash merged
after current CI and independent review, then their branches are deleted.

Protect `main` with PRs, resolved conversations, linear history, up-to-date
required backend/contract checks, no force push/deletion/direct push, and no
bypass except governed break-glass review. Require CODEOWNERS approval for auth,
tenancy, contracts, migrations, billing, publication, providers, security, and
release automation only after at least two authorized reviewers exist.

## Architecture and authority

Traffic flows through Kong, then Middleware, then the NestJS modular monolith.
The backend uses PostgreSQL/Prisma as authority, Redis for disposable
coordination, Temporal/orchestrator for durable execution, object storage for
media with PostgreSQL metadata, provider adapters as anti-corruption boundaries,
a transactional outbox, and a durable replay-safe inbox.

`apps/backend` owns synchronous transport, policy, commands/queries, and
persistence orchestration. `apps/orchestrator` owns leased asynchronous work,
delivery, retry, reconciliation, and outbox dispatch. Migrations are a separate
one-shot release job.

Modules follow controller/transport -> application command/query -> domain
policy -> repository/adapter interface -> infrastructure. Controllers contain
no business policy, public APIs never return Prisma models, and provider payloads
never leak into the domain or public contract.

Domains and authority:

| Domain            | Owns                                            | Does not own                             |
| ----------------- | ----------------------------------------------- | ---------------------------------------- |
| Identity/tenancy  | local mapping, membership, roles, capabilities  | Keycloak credential issuance             |
| Onboarding        | state machine and evidence                      | automatic activation                     |
| Brand             | immutable profiles/revisions and policy         | unreviewed publishing                    |
| Social accounts   | metadata and token custody                      | browser-visible tokens                   |
| Content           | content, revisions, media references            | provider result truth                    |
| Approvals         | policy, stages, decisions, separation of duties | mutation after approval without revision |
| Campaign/calendar | windows, timezone, ownership, schedule intent   | provider result truth                    |
| Publishing        | commands, deliveries, transitions               | public signature termination             |
| Callback inbox    | normalized verified replay-safe processing      | edge-owned raw verification              |
| Engagement        | references, assignment, SLA                     | direct Odoo writes                       |
| Analytics         | normalized metrics/read models                  | credentials                              |
| Billing           | normalized tenant subscription/capabilities     | browser or raw-webhook trust             |
| Integration       | Middleware outbox/ack/reconciliation            | direct cross-system writes               |
| Audit             | immutable security/business evidence            | debug logs as audit truth                |
| Operations        | private health/version/metrics/backlogs         | public monitoring                        |

New domains require an authority decision record.

## API rules

Canonical namespaces are `/v2/social/*`, `/v2/webhooks/social/{provider}`,
`/internal/v1/social/*`, and private `/live`, `/ready`, `/version`, `/metrics`.
No route may exist outside the OpenAPI source and URL registry.

Use lowercase plural nouns, opaque path IDs, cursor pagination, stable globally
unique `operationId`s, and RFC 9457 `application/problem+json` errors containing
stable machine codes and correlation IDs. Timestamps are UTC ISO 8601; local
scheduling includes an IANA timezone; money uses integer minor units and ISO
currency. Null/omitted/empty semantics and enum compatibility are explicit.

Mutations carry authenticated actor/service, tenant authority, scope/capability,
correlation ID, idempotency key, normalized payload hash, command ID, expected
version when applicable, audit context, kill-switch evaluation, and durable
result. Reusing a key with different content returns `IDEMPOTENCY_CONFLICT`.
Optimistic concurrency applies to approvals, revisions, calendars, billing,
assignments, cancellations, and retries.

Keycloak user auth uses Authorization Code + PKCE S256. APIs verify signature,
issuer, audience, time claims, token type, and scope, including JWKS rotation.
Services use least-privilege client credentials plus mTLS/HMAC where contracted.
Public spoofable identity headers are stripped. Authorization includes identity,
audience, route scope, tenant authority, role/capability, object policy,
entitlement, kill switch, and legal state transition.

## Persistence and asynchronous work

Tenant-owned repositories require tenant context; generic `findById(id)` is
forbidden. Tenant-local uniqueness includes tenant keys. Cross-tenant access
fails closed and normally returns 404 where existence is sensitive.

Migrations require schema and named SQL, empty replay, supported-head upgrade,
status verification, lock/runtime analysis, backfill, forward-fix/restore plan,
backup requirements, and a compatibility window. Breaking changes use
expand/deploy/backfill/migrate/stop-old-writes/contract phases.

Business state and normalized outbox events commit atomically. Outbox and inbox
records include stable IDs, versions, tenant, correlation/causation, hashes,
timestamps, processing/lease/retry state, acknowledgements, and dead-letter
metadata. Workers claim atomically, use bounded leases/backoff/concurrency,
check capabilities at execution time, and shut down gracefully. No blind retry
may duplicate publishing or billing.

Provider adapters translate canonical models, normalize results/errors, use
provider idempotency when available, bound timeouts/retries, redact secrets,
retain minimal evidence, support reconciliation, and remain disabled until
approved. Provider payloads are not public API models.

## Cross-system, billing, and AI safety

Middleware calls use service OAuth, least-privilege scope, correlation/event IDs,
replay identity, bounded timeout, durable outbox, and exact acknowledgement. n8n
is non-authoritative coordination only. All other product integration uses
versioned Middleware contracts and replay-safe events/commands.

Billing distrusts browser prices and raw webhook outcomes. Entitlements are
tenant-bound versioned snapshots; ordering, grace, past-due, cancellation,
trial, paused, and incomplete states are explicit. Billing never implicitly
enables delivery.

AI is disabled unless configured. Output is untrusted, never auto-published,
and bound to versioned brand/source policy and human approval. Model metadata is
audited without secrets, and tenant content is never sent to unapproved models.

## Audit, observability, and testing

Immutable audits include actor/service, tenant, action, resource/version/state,
correlation/causation, policy/capability decision, result, timestamp, and denial
reason without secrets or unnecessary personal data. Structured redacted logs
and traces propagate correlation across every boundary.

Required metrics cover operation latency/errors, auth and tenant denials,
publication/delivery state, outbox/inbox age and depth, retry/dead letters,
provider errors/rate limits, lease recovery, migration/build identity, and safe
capability state. Readiness fails for invalid dependencies or safety config.

Applicable tests include domain unit tests; real PostgreSQL repository,
transaction, tenancy, idempotency, concurrency, outbox/inbox and lease tests;
real PostgreSQL/Redis integration tests; OpenAPI/AsyncAPI/examples/SDK drift and
breaking-change tests; auth/security/replay/redaction/limit tests; empty and
supported-head migration tests; backend/orchestrator builds; hardened container
inspection; secret/dependency/license/SAST scans; and exact-SHA evidence.

## Required feature specification

Every backend feature updates `docs/features/<feature-id>.md` with outcome,
authority, APIs/operation IDs/scopes/tenant rules/schemas/problems, idempotency,
concurrency, reconciliation, tables/migration/backfill/restore, events/outbox/
inbox/replay/acknowledgement, default-false flags, tests, observability, audit,
branch, base SHA, and expected PR. An endpoint, table, event, worker, provider,
or integration without this record is incomplete.

## Required pull-request evidence

Backend PRs provide `OUTCOME`, `BASE_BRANCH=main`, `BASE_SHA`, `HEAD_SHA`, public
and private operations, OpenAPI version, AsyncAPI changes, migrations, tenant
controls, idempotency/concurrency, outbox/inbox impact, capability flags,
`LIVE_CAPABILITIES_ENABLED=NO`, `PRODUCTION_DEPLOYED=NO`, tests, CI URL, and
rollback/forward-fix. They explain authority, durability, duplicates, tenancy,
unknown-outcome reconciliation, migrations, metrics, and independent mergeability.

## Agent authority and completion

Agents inspect `main`, branch, worktree, contracts, migration head, domain, and
tests before editing; state files/tests/migration impact/non-goals; branch from
green `main`; and preserve disabled capabilities. They may edit, test, migrate
forward, document, commit/push a branch, and open/update a PR targeting `main`.

Agents MUST NOT push directly to `main`, merge their own PR, weaken protection or
tests, run destructive staging/production operations, activate live capabilities,
rotate secrets, alter DNS/Keycloak/gateway/provider runtime, or claim release
readiness without exact-SHA CI and immutable evidence.

Completion output includes backend result, branch/base/final SHA, PR URL, API and
event changes, migrations, files/tests, CI, image digest, remaining risks, and
always `LIVE_SERVER_CHANGED=NO` and `PRODUCTION_DEPLOYED=NO` unless separately
authorized by a binding production procedure.

## Stabilization sequence

1. **BE-0:** governance, this standard, agent links, CODEOWNERS, PR evidence,
   backend CI, protected `main`, immutable release controls.
2. **BE-1:** authoritative OpenAPI, AsyncAPI, URL registry, authority map, SDK
   generation, compatibility/drift gates.
3. **BE-2:** Keycloak identity separation, tenant repositories/tests, spoofed
   header stripping.
4. **BE-3:** idempotency, concurrency, ledger, outbox/inbox, leases, retries,
   dead letters, reconciliation, and migration replay.
5. **BE-4:** additive product-domain slices.
6. **BE-5:** sandboxed providers and Middleware acknowledgements with n8n kept
   non-authoritative and every live capability disabled.
7. **BE-6:** green-main image digest, SBOM/provenance, restore/migration rehearsal,
   no-write staging canary, rollback, then separate production approval.

Do not merge the existing dependency chain sequentially. Merge PR A governance,
then PR B contracts, then small coherent backend PRs C/D targeting current green
`main`, and independent frontend PR E. Close superseded drafts with preserved
commit links. Documentation alone is not governance: CI, validators, branch
rules, and exact evidence are required.
