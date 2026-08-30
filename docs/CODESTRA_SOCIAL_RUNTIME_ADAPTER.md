# Codestra Social Runtime Adapter

social.codestra.co is the publishing runtime behind Codestra Social.

## Adapter operations
- validate account connection
- create runtime post draft
- schedule approved post
- cancel scheduled post
- fetch publication status
- fetch engagement metrics
- reconcile provider/runtime identifiers

## Required mapping
Each runtime object stores/returns Codestra tenant_id, social_account_id, codestra_post_id, runtime_post_id, provider, provider_post_id where available, correlation_id, and timestamps.

## Safety
SOCIAL_PUBLISHING_ENABLED=false by default. The adapter must reject publish/schedule mutations unless the calling post is approved and the environment capability is enabled. Paid advertising is explicitly out of scope for this runtime adapter and belongs to Codestra Marketing.
