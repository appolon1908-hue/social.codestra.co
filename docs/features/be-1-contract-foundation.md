# BE-1 contract foundation

## Outcome and authority

Establish authoritative OpenAPI, AsyncAPI, URL-registry, operation-authority,
generated SDK, and drift evidence for every Social backend and orchestrator
transport. PostgreSQL/domain authority and all runtime behavior remain unchanged.

The first mechanical input is a deterministic inventory of every literal NestJS
HTTP route on current `main`. It records method, normalized path, controller,
handler, source file, controller/handler decorators, and parameter decorators
that expose existing tenant and actor injection evidence. It rejects duplicate
method/path authority. Decorator presence is evidence for classification; it
does not itself classify or authorize a route.

## Contract decisions still required

Every inventoried route must be classified as canonical, private,
compatibility-only, or retired. Surviving operations require stable operation
IDs, scopes, tenant rules, schemas, RFC 9457 problems, idempotency, concurrency,
audit effects, and tests. Durable events require ownership, versioning,
tenant/correlation/causation, replay, acknowledgement, and compatibility rules.

No OpenAPI/AsyncAPI/registry file is introduced until the complete atomic set is
generated and validates; the existing partial-foundation rejection remains in
force.

## Data, flags, and rollout

- Migrations: none.
- Runtime routes or events: none.
- Live capability flags: unchanged and disabled.
- Production deployment: none.
- Rollback: remove the generated inventory and validation command; no data
  rollback is required.

## Verification

The generator uses the TypeScript AST rather than regex parsing, accepts only
literal controller/method paths, normalizes route identity, rejects duplicates,
and supports a byte-for-byte `--check` mode for CI drift enforcement.

- Branch: `ops/be-contract-foundation`
- Base: `main` at `4f7817f6c6d1bb38fa7d85bb1656eb41865283d5`
- Expected PR: pending complete atomic BE-1 contract set
