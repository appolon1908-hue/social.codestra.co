# OPS runtime health

## Outcome and authority

The `postiz` application container reports Docker health only when its existing
private orchestrator probe can authenticate to Temporal and describe the
configured namespace, and when the enforced social-publishing kill switch is
not in its write-enabled state.

Codestra Social owns this container-health decision. It does not make Docker,
Temporal, monitoring, or this probe authoritative for durable product state.
PostgreSQL remains the durable authority.

## Release context

- Branch: `ops/be-runtime-health-evidence`
- Base branch: `main`
- Base SHA: `4f7817f6c6d1bb38fa7d85bb1656eb41865283d5`
- Expected PR: `appolon1908-hue/social.codestra.co#34`
- Production deployment: forbidden by this PR
- Live capabilities enabled: no

## Operations and contracts

No API or event is added or changed. The healthcheck calls the existing private
loopback operation `GET http://127.0.0.1:3002/health/status`; it does not expose
that operation through Nginx, Kong, or a public interface.

- Public operations: none
- New private operations: none
- OpenAPI changes: none
- AsyncAPI changes: none
- Operation IDs/scopes/tenant rules/schemas/problems: not applicable
- URL-registry change: none

Canonical `/live`, `/ready`, `/version`, `/metrics`, and capability read-back
remain blocked on the complete BE-1 contract foundation. This feature must not
be interpreted as supplying those contracts.

## Safety, state, and durability

`PUBLISHING_KILL_SWITCH=true` is the source default. The publication activity
already refuses provider execution unless the value is exactly `false`; the
healthcheck uses the same boundary and fails when the value is exactly `false`.
No other source flag is treated as an enforced capability or certification
signal.

The probe performs no mutation. It uses the existing bounded Temporal client,
including configured TLS and API-key authentication, and calls
`describeNamespace`. The HTTP request is bounded to five seconds and Docker's
healthcheck is bounded to eight seconds.

- Tables/migrations/backfill: none
- Tenant-owned state: none
- Idempotency/concurrency: not applicable; read-only probe
- Outbox/inbox/replay/acknowledgement: none
- Provider or Middleware call: none
- Production business write: none

## Testing and observability

`security-remediation/tests/container-healthcheck.spec.ts` verifies that:

1. the healthcheck calls only the existing loopback orchestrator route;
2. the Docker and publication-boundary kill-switch semantics agree; and
3. both request and container-health durations are bounded.

Required repository CI still performs formatting, policy and contract checks,
empty and supported-head migration verification, security tests, backend and
orchestrator builds, and hardened exact-candidate image inspection.

Docker health status is the only new observable output. No metric, log schema,
trace, alert, or public monitoring route is added. Broader dependency readiness
and service-to-trace-to-log evidence remain separate blockers.

## Failure, rollback, and forward fix

An invalid publishing state, failed Temporal authentication/namespace lookup,
timeout, or non-2xx response makes the container unhealthy. It does not restart,
migrate, publish, or repair anything itself; runtime restart behavior remains a
separate deployment-policy decision.

Before any separately reviewed deployment, rollback is removal of the Compose
healthcheck and explicit safe default while retaining the pre-existing private
orchestrator probe. A forward fix may add the canonical private operations only
after BE-1 contracts, registry entries, enforcement evidence, and tests merge.

This source feature does not establish a current or previous production image
digest, deployed Git SHA, restore result, or production certification.
