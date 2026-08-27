# Middleware and n8n integration boundary

Codestra Social writes normalized lifecycle events to `SocialOutboxEvent` in the
same PostgreSQL transaction as the authoritative social state. The orchestrator
leases due rows and sends them only to Middleware. It never sends directly to
n8n, Odoo, NATS, or a provider database.

## Middleware delivery

The destination is configured by `CODESTRA_MIDDLEWARE_SOCIAL_EVENTS_URL` and is
expected to be the governed Middleware route behind the canonical Codestra API.
Production delivery requires:

- Keycloak Client Credentials for client `codestra-social`, audience enforced by
  Middleware, and scope `social.events.write`.
- Tenant and correlation headers matching the signed event envelope.
- mTLS when `MIDDLEWARE_MTLS_REQUIRED=true`.
- HMAC-SHA256 over `<timestamp>.<raw JSON body>` when
  `MIDDLEWARE_HMAC_REQUIRED=true`.
- An idempotency key stable for the outbox event.

Middleware must validate the contract, issuer, audience, service scope, tenant,
signature, timestamp window, idempotency, and event version before persisting its
own inbox record. A successful response is not sufficient by status code alone;
it must read back the accepted event identity:

```json
{
  "accepted": true,
  "event_id": "the-social-outbox-event-uuid"
}
```

Codestra Social marks the row delivered only after this exact acknowledgement.
Failures use an expiring lease, exponential backoff with jitter, a bounded retry
budget, and durable `DEAD_LETTERED` state.

## n8n responsibility

After Middleware persists and validates an event, Middleware may publish it to
NATS JetStream and start an approved n8n workflow. The workflow may enrich,
wait, schedule, branch, or notify. Any mutation requested by the workflow must
call Middleware with its own client-credentials token, scope, tenant header,
correlation ID, and idempotency key.

n8n must not:

- write to the Codestra Social or Odoo databases;
- receive social provider access or refresh tokens;
- call social providers on Codestra Social's behalf;
- decide authorization, consent, tenant ownership, or correctness;
- mark a social publication successful without a normalized provider result.

The executable n8n workflows belong in `appolon1908-hue/N8N`. This repository
owns only the Codestra Social side of the versioned boundary.
