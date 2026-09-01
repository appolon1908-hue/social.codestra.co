# Codestra Social branch map

Branches are short-lived review units. They are not deployment environments and
do not communicate at runtime.

## Protected baseline

`main` is the only long-lived source baseline. GitHub Environments and immutable
manifests represent staging and production; `develop` and `staging` must not
diverge into independent application sources.

## Implementation stack

| Order | Branch | Repository ownership | Depends on |
| --- | --- | --- | --- |
| 1 | `contract/social-platform-v1` | API, events, authority map | `main` |
| 2 | `security/keycloak-middleware-auth` | token validation, service scopes, tenant context | contract |
| 3 | `core/social-publishing-ledger` | commands, channel deliveries, idempotency, outbox | security |
| 4 | `webhooks/status-delivery` | provider inbox, replay protection, normalized status | core |
| 5 | `integration/middleware-control-plane` | bounded Middleware client and reconciliation | webhooks |
| 6 | `observability/social` | health, readiness, metrics, dashboards, alerts | integration |
| 7 | `ops/immutable-docker-release` | migrations, CI, SBOM, provenance, release controls | observability |

## Product feature branches

The following branches may follow the production foundation. Create them only
when implementation starts; do not create empty placeholder branches.

```text
feature/approval-workflows
feature/engagement-inbox
feature/analytics-attribution
feature/ai-governance
feature/brand-governance
feature/media-governance
portal/admin-client
portal/external-review
provider/<provider-name>
```

## Cross-repository dependencies

This repository publishes consumer requirements but does not own these runtime
changes:

```text
Middleware-: integration/postly-social
N8N:         workflow/postly-social
Keycloak:    feature/client-postly
platform:    platform/kong and platform/caddy
Odoo:        feature/campaign-management and feature/message-history
```

Every pull request must name its dependency branch, required contract version,
required commit SHA, merge order, migration impact, rollback, and proof that live
publishing remained disabled during validation.
