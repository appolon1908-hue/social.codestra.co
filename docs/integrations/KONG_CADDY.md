# Caddy, Kong, Keycloak, Middleware, and n8n routing

The files in `deploy/gateway` are reviewable reference fragments. They must not
be applied independently. The authoritative Caddy, Kong, certificate, network,
Keycloak client, and Middleware configuration lives in the platform repositories.

| Entry point                                         | Edge route           | Upstream                    | Authority                                              |
| --------------------------------------------------- | -------------------- | --------------------------- | ------------------------------------------------------ |
| `https://social.codestra.co`                        | Caddy                | Codestra Social web/backend | Social UI and product-local APIs                       |
| `https://api.codestra.co/v1/social/*`               | Caddy then Kong      | Middleware                  | Public social commands and reads                       |
| `https://api.codestra.co/v1/webhooks/social/events` | Caddy then Kong      | Middleware                  | Authenticated Codestra Social lifecycle events         |
| `/internal/v1/social/*`                             | Private network only | Codestra Social backend     | Middleware commands and product-local worker callbacks |
| n8n workflows                                       | Private service path | Middleware                  | Governed asynchronous orchestration                    |

Kong must never route a public mutating request directly to Codestra Social,
n8n, Odoo, Temporal, PostgreSQL, or a provider. Middleware remains the only
cross-system write boundary.

## Required gateway policy

Before the reference fragments can be promoted, the gateway repository must add
and prove:

- issuer `https://auth.codestra.co/realms/codestra`, expected audience, token
  expiration, and route scopes;
- Authorization Code + PKCE S256 for humans and Client Credentials for services;
- mTLS and service/IP allowlists on event and private callback paths;
- exact tenant and correlation header policy;
- Redis-backed distributed rate limiting for a multi-node Kong deployment;
- request/body/time limits, structured audit, and redaction of credentials;
- trusted proxy addresses matching Codestra Social's `TRUSTED_PROXY_IPS`;
- a negative test proving `/internal/v1/social/*`, metrics, readiness, and release
  identity are not exposed by the public Caddy virtual host.

The example intentionally does not declare an `openid-connect` plugin because
availability and fields differ between Kong editions. The authoritative gateway
must select its supported Keycloak validator and verify the effective runtime
configuration. A configuration file alone is not deployment evidence.

## n8n

n8n receives only Middleware-validated events. It may call Middleware with a
dedicated scoped service identity and idempotency key; it may not call the
private Codestra Social endpoints, hold provider tokens, or write product/CRM
databases. See `MIDDLEWARE_N8N.md` for the event acknowledgement and mutation
boundary.
