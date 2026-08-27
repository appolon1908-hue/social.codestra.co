# Product-local provider callback contract

The callback endpoint in this repository is for Codestra Social provider workers
that operate inside the Codestra Social trust boundary. It is not a public
provider gateway and must not be exposed directly through the public Kong API.
Cross-system callers and n8n must call Middleware instead.

## Request

`POST /internal/v1/social/provider-events/{provider}` requires:

- `X-Tenant-Id`: the owning organization UUID.
- `X-Correlation-Id`: a request UUID propagated into the outbox event.
- `X-Codestra-Timestamp`: current Unix seconds.
- `X-Codestra-Signature`: `v1=<hex HMAC-SHA256>`.

The signed bytes are exactly `<timestamp>.<raw request body>`. Secrets are
tenant/provider specific and supplied by the runtime secret manager through
`SOCIAL_PROVIDER_WEBHOOK_SECRETS_JSON`. The endpoint rejects missing secrets,
stale timestamps, invalid signatures, invalid state transitions, tenant/provider
mismatches, and semantic replays. It is disabled unless
`SOCIAL_PROVIDER_CALLBACKS_ENABLED=true`.

## Durability and replay

Every verified event is written to `SocialProviderInbox` before it changes a
delivery. The tuple `(tenant, provider, event_id)` is unique. An identical replay
returns the original result; a reused event ID with different bytes returns a
conflict. The delivery update, aggregate command state, normalized outbox event,
and inbox completion are one PostgreSQL transaction.

Native social-network webhooks require provider-specific signature adapters.
They must normalize into this contract only after verifying the provider's
official signature scheme. No generic fallback or unsigned callback is allowed.
