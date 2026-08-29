# Postly Social — Codestra Integration Fabric v2

## Authority

Postly, implemented from Postiz, owns social workspaces, connected provider accounts, OAuth token custody, content drafts and versions, media, approvals, schedules, provider submission references, publication state, inbox items, analytics and account health.

Postly does not own global authentication, CRM truth, n8n state, tenant authorization across Codestra, or provider credentials outside its own encrypted custody. Middleware is the only cross-system write boundary.

## Communication path

```text
Odoo/product campaign intent -> Middleware -> Postly API
Postly/provider lifecycle -> Postly durable state/outbox -> Middleware
n8n -> Middleware only -> Postly adapter
```

n8n receives no social-provider access token, refresh token, client secret, Postly database access, Redis access or Temporal administrative access.

## Social API

The governed API supports:

- social-account connection metadata and reauthorization state;
- content and media lifecycle;
- approval requests and decisions;
- publication scheduling and cancellation;
- publication status and unknown-outcome reconciliation;
- analytics and account health;
- safe inbox classification and lead-candidate events;
- provider callback inboxes.

Every publication requires an approved immutable content version, connected account, policy snapshot, tenant capability, idempotency key and durable publication operation. Provider timeout becomes `PUBLICATION_UNKNOWN`; Postly reconciles before retry.

## Approval

A workflow may coordinate review, but Middleware/Postly record the authoritative approval. n8n cannot self-approve content or enable publishing.

## Capabilities

```text
SOCIAL_PUBLISH=false
SOCIAL_ACCOUNT_WRITE=false
SOCIAL_ENGAGEMENT_WRITEBACK=false
LEAD_PUBLISH=false
ODOO_WRITE=false
DEAD_LETTER_REPLAY=false
```

## Branch program

```text
integration/n8n-postly-automation-v2-20260827
  -> integration/codestra-social-fabric-v2
       -> integration/middleware-social-api-v1
       -> automation/publication-event-outbox-v1
       -> feature/content-approval-policy-v1
       -> feature/social-inbox-triage-v1
       -> feature/social-analytics-projection-v1
       -> test/social-fabric-contracts-v1
```

No child branch connects a provider, changes OAuth credentials, publishes content, activates n8n, or deploys production.