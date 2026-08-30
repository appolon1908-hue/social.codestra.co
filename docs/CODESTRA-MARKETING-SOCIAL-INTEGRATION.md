# Codestra Marketing / Social Integration

## Purpose
This repository remains the implementation/runtime authority for the existing social publishing platform. Codestra Social is the Codestra-facing abstraction/control plane that integrates with this system through approved APIs and events.

## Responsibilities of this repository
- social publishing runtime
- provider-specific social network integrations already implemented here
- scheduling/execution mechanics
- media publishing workflows
- provider webhook/engagement ingestion where applicable
- platform-specific account/session behavior
- operational health of the social publishing application

## Responsibilities moved to Codestra Social abstraction
Codestra Social should expose stable Codestra contracts for:
- connected account references
- social posts and variants
- content calendar
- approval workflow
- publish/schedule intents
- normalized engagement
- social inbox abstraction
- normalized analytics

The Codestra platform should not make every business application depend directly on provider-specific objects inside this repository.

## Integration path
Codestra SDK -> Kong -> Codestra Social -> Middleware/integration adapter -> social.codestra.co runtime -> external social providers.

Inbound provider events return through the controlled integration path and are normalized before reaching Codestra Social, Marketing, Odoo, or analytics.

## Marketing relationship
Codestra Marketing owns paid campaign business intent, campaign budgets, attribution, experiments, spend policy, and advertising-provider abstractions.

This repository and Codestra Social own organic/social publishing behavior. Paid-media activation must not be silently implemented as a normal social-post publish action.

## AI relationship
Codestra AI may generate draft social copy, variants, summaries, classifications, and recommendations. AI output remains draft until the Codestra Social approval policy allows publishing.

## Required contracts
- stable versioned API for account discovery/reference
- create/update draft post
- media attachment reference
- schedule publish
- publish now command
- cancel scheduled publish
- fetch publish status
- normalized engagement/analytics read
- webhook/event schema for publish state changes and engagement

## Safety and release rules
- live publishing remains separately controlled from documentation work
- publishing commands must be idempotent
- account credentials/tokens must not be exposed to frontend clients or stored in documentation
- account connect/disconnect is privileged and audited
- provider failures must return explicit degraded/failed state; HTTP acceptance alone is not business success
- all cross-service requests propagate tenant/business-unit/correlation identifiers
- production provider writes require explicit release evidence and approval

## Initial events
social.post.created
social.post.approval_requested
social.post.approved
social.post.scheduled
social.post.publish_requested
social.post.published
social.post.failed
social.engagement.received
social.analytics.updated

## Boundary rule
`social.codestra.co` is the social publishing implementation platform. `Codesrea-Social-` is the enterprise Codestra service boundary. Business applications and the shared SDK target the Codestra Social API, not undocumented internals of this runtime.
