# Kong social edge v2

The candidate configuration routes only two public v2 path families and both
terminate at Middleware:

- `/v2/social/*` for authenticated commands and reads;
- `/v2/webhooks/social/*` for registered, signed webhook senders.

It does not route `/internal/*`, monitoring endpoints, Codestra Social directly,
n8n, Odoo, PostgreSQL, Redis, Temporal, NATS or a social provider.

## Layered enforcement

1. Caddy owns public TLS, blocks product-private paths and rejects TRACE/CONNECT.
2. Kong owns exact host/path/method matching, request IDs, body limits, spoofed
   identity-header removal and Redis-backed distributed traffic limits.
3. Middleware verifies Keycloak issuer/audience/expiration/scopes, binds the
   authenticated subject to a tenant, authorizes the capability, validates the
   contract and persists idempotency/inbox/outbox state.
4. Codestra Social accepts only private scoped service commands and retains
   provider-token custody.

Kong configuration is not identity proof. The effective gateway deployment must
still test its supported Keycloak integration and demonstrate that Middleware
rejects missing, expired, wrong-issuer, wrong-audience, wrong-scope and
cross-tenant tokens.

## Promotion checklist

- Resolve Redis, Middleware and Kong versions in the platform repository.
- Load secrets from protected files or a secret manager, never declarative YAML.
- Require mTLS on the service webhook route at the authoritative edge.
- Configure exact trusted proxies and service-network allowlists.
- Validate with `pnpm validate:kong-social` and the platform's native Kong check.
- Run negative probes for private paths, spoofed headers and unsupported methods.
- Run rate-limit consistency tests across at least two Kong nodes.
- Keep social publishing and external delivery disabled during the edge canary.
