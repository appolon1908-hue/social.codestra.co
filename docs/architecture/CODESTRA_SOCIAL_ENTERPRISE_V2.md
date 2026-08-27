# Codestra Social enterprise product architecture

Codestra Social is a tenant-isolated social operating system built on Postiz.
It combines reliable publishing with brand governance, approvals, engagement,
attribution, and automation without moving correctness into n8n or exposing
provider credentials outside the product.

## Product promise

A new customer can create a workspace, invite a team, define its brand, connect
social accounts, import content, configure approvals, and reach a safe test
publication from one guided onboarding journey. Production publishing remains
disabled until every readiness check and an authorized tenant administrator's
explicit activation are recorded.

## Authority and isolation

| Layer           | Owns                                                                                                                    | Must never own                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Caddy and Kong  | TLS, routing, request limits, correlation IDs, coarse traffic policy                                                    | Tenant authorization or business state         |
| Middleware      | Public API, Keycloak authorization, tenant binding, idempotency, integration inbox/outbox, cross-system writes          | Provider OAuth tokens                          |
| Codestra Social | Workspaces, provider tokens, brand profiles, content, approvals, schedules, deliveries, engagement and social analytics | Odoo CRM truth                                 |
| Temporal        | Durable multi-step workflows, timers and compensations                                                                  | Human authorization policy                     |
| NATS            | Versioned domain-event transport                                                                                        | Durable business truth                         |
| n8n             | Governed asynchronous orchestration through Middleware                                                                  | Direct database/provider access or correctness |
| Odoo            | CRM contacts, leads, activities, campaigns and consent                                                                  | Social provider credentials                    |
| PostgreSQL      | Durable tenant and workflow state                                                                                       | Ephemeral locks or caches                      |
| Redis           | Rate-limit counters, short leases and caches                                                                            | Sole copy of commands or events                |

Every durable row is tenant-bound. Every mutation carries a correlation ID,
actor identity, capability decision, semantic idempotency key and audit record.
Cross-tenant identifiers return `404`, not existence-revealing authorization
errors. Provider secrets are envelope-encrypted and never returned by an API.

## The Codestra Brain

The Brain is a governed decision-support layer, not an autonomous publisher.
It combines:

- a versioned brand profile: voice, vocabulary, claims, prohibited topics,
  locales, audience segments, visual rules and legal disclaimers;
- a campaign brief and objective graph;
- provider-specific content constraints and accessibility checks;
- retrieval from tenant-approved assets and prior approved content;
- risk scoring for policy, claims, privacy, brand and duplication;
- explainable suggestions with source references and model metadata;
- human approval requirements based on tenant policy and risk;
- outcome feedback from delivery, engagement and attribution events.

Generated content is stored as a revision. It cannot silently overwrite an
approved revision. Model, prompt policy, sources, inputs, outputs and approval
decisions are auditable. Training on tenant content is disabled by default.

## Core product modules

1. **Guided onboarding** — workspace, identity, role invitations, brand kit,
   provider connection, import, approval policy, dry-run and readiness score.
2. **Content studio** — reusable assets, templates, variants, localization,
   accessibility, link governance and provider previews.
3. **Campaign command center** — objectives, briefs, budgets, owners, calendar,
   dependencies, status and cross-channel orchestration.
4. **Approvals** — policy-driven stages, separation of duties, comments,
   requested changes, external review links and immutable decision history.
5. **Publishing ledger** — semantic idempotency, per-channel delivery state,
   retries, reconciliation, cancellation and dead-letter operations.
6. **Unified engagement** — comments, mentions, direct-message references,
   triage, assignment, SLA, sentiment, escalation and Odoo handoff.
7. **Analytics and attribution** — normalized provider metrics, UTM/link events,
   campaign goals, conversion imports, comparisons and executive reporting.
8. **Brand and AI governance** — brand rules, content risk, model policy,
   evidence, approval gates and cost controls.
9. **Integration hub** — Middleware-managed commands/events for Odoo, n8n,
   Klyrow email, Telnexa SMS and approved enterprise systems.
10. **Enterprise administration** — tenants, plans, quotas, audit, retention,
    exports, incident operations, capabilities and release identity.

## Portals and canonical URLs

| Portal          | URL                                          | Audience                    | Purpose                                                   |
| --------------- | -------------------------------------------- | --------------------------- | --------------------------------------------------------- |
| Marketing       | `https://social.codestra.co/`                | Prospects                   | Product, pricing, security and signup                     |
| Workspace       | `https://social.codestra.co/app`             | Creators and managers       | Studio, calendar, campaigns and analytics                 |
| Engagement      | `https://social.codestra.co/app/inbox`       | Community and support teams | Triage, assign and escalate engagement                    |
| Client portal   | `https://social.codestra.co/client`          | Brand customers             | Briefs, status, approvals and reports                     |
| Reviewer portal | `https://social.codestra.co/review/{token}`  | Time-limited reviewers      | Approve or request changes without broad workspace access |
| Operations      | `https://social.codestra.co/ops`             | Internal operators          | Deliveries, inbox/outbox, reconciliation and incidents    |
| Administration  | `https://social.codestra.co/admin`           | Codestra administrators     | Tenants, capabilities, audit and release state            |
| Public API      | `https://api.codestra.co/v2/social`          | Authorized clients          | Middleware-governed commands and reads                    |
| Webhook ingress | `https://api.codestra.co/v2/webhooks/social` | Registered senders          | Signed, replay-safe inbound events                        |

Private product endpoints remain under `/internal/v2/social/*` and are never
routed by the public virtual host.

## Onboarding state machine

`created -> identity_verified -> workspace_configured -> brand_ready ->
accounts_connected -> policy_ready -> dry_run_passed -> ready_for_activation`

Each transition is idempotent and records prerequisites, actor and evidence.
Activation is a separate privileged command. It fails closed if provider scopes,
brand policy, approval policy, delivery flags, audit or dependency readiness are
invalid.

## Reliability objectives

- API availability target: 99.95% monthly, excluding provider outages.
- Accepted command durability: no acknowledged command may be lost.
- Duplicate external publication target: zero; unknown outcomes reconcile before
  retry.
- Tenant isolation: zero cross-tenant reads, writes or side channels.
- Webhook replay: durable inbox uniqueness plus timestamp/signature validation.
- Recovery: documented RPO/RTO, tested restore and immutable release rollback.
- Accessibility: WCAG 2.2 AA for every first-party portal.

No design can promise zero bugs. The system reduces defect impact through typed
contracts, state machines, isolation, idempotency, outbox/inbox delivery,
property/security tests, canaries, observability, feature flags and rehearsed
rollback.
