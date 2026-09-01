# Codestra control-plane integration

## Middleware

Middleware calls the private social API with a dedicated Keycloak service
identity, mTLS, a tenant claim, a stable idempotency key, and a correlation ID.
The social service persists the command before returning `202 Accepted`.

Codestra Social sends normalized events only to the configured Middleware event
endpoint. The endpoint is private/allowlisted and authenticated independently of
the user webhook feature.

## n8n

Codestra Social does not call n8n. Middleware may trigger the governed
`CP-POSTLY-*` workflow group after validating and persisting a social event. n8n
must call Middleware for any subsequent mutation and must reuse the received
correlation and idempotency identifiers.

Workflow exports remain in the `appolon1908-hue/N8N` repository, are inactive by
default, contain no credentials, and use a common error/dead-letter workflow.

## Kong and Caddy

Caddy exposes the browser application at `social.codestra.co`. Kong exposes the
canonical API at `api.codestra.co` and forwards approved social routes to
Middleware—not directly to this repository's backend.

The private Middleware-to-social route requires:

- mTLS between services.
- Keycloak issuer `https://auth.codestra.co/realms/codestra`.
- Audience `codestra-social`.
- Scope per command or read operation.
- Tenant and service-subject claims.
- Request/correlation IDs and body/rate limits.

## Odoo

Middleware maps normalized social events into Odoo contacts, campaigns,
activities, communication history, or leads. Codestra Social retains the social
provider and delivery IDs, while Odoo owns business outcomes. Neither service
writes the other's database.

## Required service scopes

```text
social.commands.write
social.commands.read
social.deliveries.read
social.accounts.read
social.events.write
social.reconciliation.write
```

The service client is not a super-admin client and receives no browser session,
provider token, billing, or user-management scopes.
