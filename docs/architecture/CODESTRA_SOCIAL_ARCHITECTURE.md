# Codestra Social architecture

## Purpose

This repository is the authoritative source for the Codestra Social product: the
Postiz-derived web application, social-provider adapters, publishing workers,
provider-token storage, delivery state, media, engagement, analytics, and the
private control API consumed by Codestra Middleware.

It is not the authority for Kong, Keycloak, n8n, Odoo, or the central Codestra
event ledger. Those systems keep their own repositories and deployment paths.

## Runtime boundary

```text
Browser -> Caddy -> social.codestra.co
                     |
                     +-> Codestra Social web/backend/workers

Service command -> api.codestra.co -> Kong -> Middleware
                                             |
                                             +-> private Codestra Social API

Provider callback -> Codestra Social verified inbox
                  -> local durable outbox
                  -> Middleware signed event endpoint
                  -> n8n orchestration and/or Odoo business update
```

### Authority rules

1. `social.codestra.co` is the user interface, not the canonical public API.
2. `api.codestra.co` is the only canonical public integration entry point.
3. Middleware is the only cross-system write boundary.
4. n8n orchestrates validated events but never owns correctness, authorization,
   idempotency, or authoritative state.
5. Odoo owns contacts, leads, campaigns, activities, consent, and business
   outcomes. Codestra Social never writes directly to the Odoo database.
6. Keycloak owns human and service identity. Human login uses Authorization Code
   with PKCE S256; services use Client Credentials with short-lived tokens.
7. Kong validates issuer, audience, scopes, tenant claims, mTLS, request limits,
   allowlists, and correlation IDs before forwarding to Middleware.
8. PostgreSQL is authoritative. Redis is limited to caches, locks, leases, and
   rate counters. Temporal owns durable publishing workflows.

## Social product ownership

Codestra Social owns:

- Connected social accounts and encrypted provider credentials.
- Provider capability discovery and validation.
- Drafts, platform variants, media, schedules, and publishing workflows.
- Per-provider delivery attempts and read-back/reconciliation state.
- Provider callback signature verification and replay protection.
- Engagement data supported by approved platform APIs.
- Product-local audit facts and normalized events waiting for Middleware.
- Product health, readiness, metrics, and immutable release identity.

Codestra Social must not:

- Call Odoo or n8n directly for cross-system mutations.
- Store provider credentials in n8n exports or Odoo records.
- Accept public mutating traffic that bypasses Kong and Middleware.
- Treat an HTTP timeout as publication success.
- retry a command with a new idempotency key.
- report a provider publication as complete without a provider identifier or
  later read-back/reconciliation result.

## Command lifecycle

```text
requested -> validated -> persisted -> queued -> provider accepted
          -> read-back/reconciled -> completed
                                 \-> failed -> dead-lettered
```

Each target channel is a separate delivery. A retry for one failed channel must
not republish channels that already succeeded.

## Event lifecycle

Provider callbacks are verified and persisted before acknowledgement. A unique
provider event ID, signed-payload digest, tenant, and provider account are stored
for replay detection. Normalization and forwarding happen asynchronously. The
same canonical event ID is retained through Middleware, n8n, and Odoo.

## Deployment safety

The effective staging runtime must keep all external effects disabled:

```text
ENABLE_EXTERNAL_DELIVERY=false
LIVE_WRITE=false
LIVE_WRITES=false
ODOO_WRITE=false
N8N_DELIVERY_ENABLED=false
WEBHOOK_DELIVERY_ENABLED=false
SOCIAL_PUBLISHING_ENABLED=false
SOCIAL_PROVIDER_CALLBACKS_ENABLED=false
PUBLISHING_KILL_SWITCH=true
```

Configuration files are not proof. Readiness checks and synthetic tests must
read back effective values. Production activation requires an exact merged SHA,
immutable image digest, database backup/restore evidence, rollback rehearsal,
canary, and separate human approval.

## Canonical contracts

- `contracts/openapi/codestra-social-v1.yaml` defines the private API that
  Middleware may call.
- `contracts/asyncapi/codestra-social-events-v1.yaml` defines events that the
  social outbox may deliver to Middleware.
- `contracts/examples/` contains non-secret contract fixtures for tests.

Contract versions are immutable. Breaking changes require a new major contract
and a dependency-ordered rollout.
