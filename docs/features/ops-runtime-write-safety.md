# Runtime write-safety enforcement

## Outcome and authority

Production-effecting billing, external-model, and webhook operations fail closed
unless their canonical capability flag is exactly `true`. Credentials alone do
not authorize an external effect. This change introduces no new API, event, or
database authority.

## Capability flags

| Capability                        | Environment flag               | Safe/default state |
| --------------------------------- | ------------------------------ | ------------------ |
| Stripe mutations and live charges | `BILLING_LIVE_CHARGE`          | `false`            |
| External model execution          | `EXTERNAL_MODEL_CALLS_ENABLED` | `false`            |
| Outbound webhook delivery         | `WEBHOOK_DELIVERY_ENABLED`     | `false`            |

Missing, empty, differently-cased, or non-boolean values are disabled. Existing
social publishing authority remains independently controlled by
`PUBLISHING_KILL_SWITCH`; this change does not enable or relax it.

## Interfaces and migrations

No public contract, event schema, or database migration changes. Disabled HTTP
features retain their existing unavailable/disabled response behavior. Internal
service calls receive a deterministic `runtime_capability_disabled:<FLAG>` error.

## Verification and observability

Unit tests prove fail-closed parsing and exact opt-in semantics. CI policy/build
checks verify that enforcement compiles at the provider boundaries. The existing
private metrics endpoint exposes sanitized `0`/`1` capability gauges for billing,
models, webhooks, and publishing. The flag names and boolean states are safe
runtime evidence; secret values must never be logged or returned.

## Rollout and rollback

Deploy with every new flag set to `false`. Enabling any capability is a separate
production-authority decision outside this PR. Rollback uses the prior immutable
image; no schema rollback is required.

- Branch: `ops/be-runtime-write-safety`
- Base: `main` at `4f7817f6c6d1bb38fa7d85bb1656eb41865283d5`
