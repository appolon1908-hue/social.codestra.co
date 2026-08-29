# Postly / Codestra Social ↔ governed n8n automation

## Product identity

This repository is the Codestra Social product, branded **Postly** and implemented from the open-source **Postiz** codebase.

```text
Repository: appolon1908-hue/social.codestra.co
Product name: Postly
Upstream implementation: Postiz
Public application: social.codestra.co
```

## Authority boundary

Postly is authoritative for:

- organizations/workspaces and their social-media configuration;
- connected social accounts and provider OAuth-token custody;
- drafts, media references, content versions and approval state;
- scheduling state and publication plans;
- provider submission references and publication status;
- social analytics and engagement records owned by the product;
- platform-specific validation and provider-rate-limit state.

Middleware remains the only Codestra cross-system write boundary. n8n orchestrates approved sequences and does not connect directly to Postly, its PostgreSQL database, Redis, Temporal, provider OAuth endpoints, or social networks.

```text
Postly or provider event
  -> authenticated Postly outbox/webhook relay
  -> Middleware durable inbox and canonical event
  -> Middleware automation job and dispatch outbox
  -> private n8n wake and atomic claim
  -> n8n timing, branching or approval coordination
  -> governed Middleware social command
  -> Postly adapter/API
  -> provider submission and Postly read-back
  -> Middleware reconciliation
  -> Odoo/product projection when approved
```

Public provider callbacks terminate at Postly and/or the approved Middleware ingress. They never terminate directly at n8n.

## Canonical workflow family

```text
workflow_family = social.postly
machine_client  = n8n-social-automation
command_scope   = automation.command.social
```

Common runtime scopes are separately required for claim, read, heartbeat, step evidence, completion, failure, approval read/request and capability read.

## Proposed canonical events

```text
social.workspace.created
social.account.connected
social.account.disconnected
social.account.reauthorization_required
social.content.draft_created
social.content.approval_requested
social.content.approved
social.content.rejected
social.publication.scheduled
social.publication.due
social.publication.submitted
social.publication.published
social.publication.failed
social.publication.cancelled
social.engagement.lead_candidate
social.analytics.snapshot_ready
social.webhook.delivery_failed
```

Every event includes a stable event ID, tenant/workspace reference, correlation and causation IDs, schema version, occurred-at timestamp and a safe resource reference. Provider access tokens, refresh tokens, cookies, private media, full customer payloads and provider secrets are prohibited.

## Governed command families

n8n may request only reviewed Middleware commands with the `social.` prefix, including:

```text
social.content.approval.request.v1
social.publication.schedule.v1
social.publication.cancel.v1
social.publication.status.read.v1
social.analytics.snapshot.request.v1
social.engagement.lead.review.v1
social.account.reauthorization.notify.v1
```

Middleware derives the authoritative tenant, actor, workflow family and command policy from the durable job and machine identity. Caller-supplied tenant or actor values are non-authoritative assertions and must match the job.

## Approval and capability policy

The following capabilities remain false until a separate staging and production canary:

```text
SOCIAL_PUBLISH=false
SOCIAL_ACCOUNT_WRITE=false
SOCIAL_ENGAGEMENT_WRITEBACK=false
LEAD_PUBLISH=false
ENABLE_EXTERNAL_DELIVERY=false
DEAD_LETTER_REPLAY=false
```

Publication requires approved content state plus the applicable content/campaign policy. High-risk or cross-tenant actions require a protected human approval. Workflow activation never enables a capability.

## Prohibited n8n behavior

n8n must never:

- hold or read provider OAuth tokens;
- call Postly/Postiz, social-provider APIs, PostgreSQL, Redis or Temporal directly;
- create a public social-provider webhook;
- approve its own publication request;
- publish content when `SOCIAL_PUBLISH=false`;
- treat a timeout as a failed publication and submit a duplicate blindly;
- write social leads directly into Odoo;
- retain post bodies, private media or provider responses in normal execution logs;
- replay a publication without expected-version, fingerprint, capability and protected approval checks.

## Unknown outcomes and replay

A provider timeout produces `UNKNOWN`. Postly and Middleware reconcile using the Postly publication ID and provider reference before any retry. Exact command replays return the original result. A changed payload using the same idempotency key returns an idempotency conflict and never mutates the original publication.

## Cross-repository dependencies

```text
N8N PR #1 governance baseline
N8N PR #9 automation control plane
Middleware PR #15 durable automation contract
Keycloak PR #10 service identities
social.codestra.co integration/n8n-postly-automation-v2-20260827
N8N automation/postly-social-v2-20260827
```

## Current safety state

```text
SOURCE_ONLY=YES
DIRECT_N8N_POSTLY_ACCESS=NO
DIRECT_N8N_PROVIDER_ACCESS=NO
SOCIAL_PROVIDER_TOKENS_IN_N8N=NO
WORKFLOWS_ACTIVE=NO
SOCIAL_PUBLISH=false
LIVE_SERVER_CHANGED=NO
PRODUCTION_DEPLOYED=NO
```

This branch adds a reviewable contract only. It does not import a workflow, create a credential, change a provider connection, publish content or modify the live deployment.
