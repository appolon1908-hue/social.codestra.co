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
The runtime-enforced publishing safety switch is `PUBLISHING_KILL_SWITCH`. It must remain `true` by default and throughout repository/source certification. The adapter must reject publish/schedule mutations while the kill switch is active, and must also require an approved calling post before any later release-authorized publishing action. A higher-level `SOCIAL_PUBLISHING_ENABLED` capability may be used by the Codestra control plane, but it does not replace the runtime kill switch; production publishing requires both the control-plane capability and the runtime kill switch to be in the explicitly approved state. Paid advertising is explicitly out of scope for this runtime adapter and belongs to Codestra Marketing.
