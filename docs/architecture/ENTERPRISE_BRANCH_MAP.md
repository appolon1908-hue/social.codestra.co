# Codestra Social enterprise delivery branches

These branches follow `ops/immutable-docker-release`. They are stacked review
units, not deployment environments. Live publishing and external delivery stay
disabled throughout implementation.

| Order | Branch                              | Review boundary                                                            |
| ----: | ----------------------------------- | -------------------------------------------------------------------------- |
|     8 | `contract/social-enterprise-v2`     | Product architecture, portal map, API and event vocabulary                 |
|     9 | `gateway/kong-social-edge-v2`       | Public route isolation, limits, headers and configuration validation       |
|    10 | `core/tenant-onboarding`            | Durable onboarding state machine, readiness and provider connection checks |
|    11 | `feature/brand-intelligence`        | Brand profile, governed AI revisions, risk and evidence                    |
|    12 | `feature/approval-workflows`        | Staged approvals, separation of duties and immutable decisions             |
|    13 | `feature/campaign-command-center`   | Briefs, objectives, calendar and content dependencies                      |
|    14 | `feature/engagement-inbox`          | Normalized engagement, assignment, SLA and escalation                      |
|    15 | `feature/analytics-attribution`     | Normalized metrics, goals, attribution and reports                         |
|    16 | `portal/admin-client`               | Admin, operations, workspace and client portal navigation                  |
|    17 | `portal/external-review`            | Scoped, expiring reviewer experience                                       |
|    18 | `integration/enterprise-connectors` | Middleware contracts for Odoo, n8n, Klyrow and Telnexa                     |
|    19 | `ops/social-enterprise-release`     | E2E, accessibility, performance, backup, canary and rollback gates         |

Provider-specific work uses `provider/<provider>` branches after the shared
account-health and delivery contracts are accepted. Never combine a provider's
OAuth/token changes with unrelated portal or analytics work.

## Required pull-request evidence

Every branch states its exact base SHA, schema impact, tenant/isolation tests,
contract version, feature-flag state, migration/rollback plan and affected URLs.
Final release evidence must prove exact-head CI, immutable image digest, SBOM,
provenance, restore rehearsal and a no-write canary before activation review.
