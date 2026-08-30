# social.codestra.co — Social Publishing Runtime Boundary

## Mission
social.codestra.co is the social publishing runtime used by Codestra Social. It executes supported social-network publishing and retrieval operations behind the Codestra Social control plane.

## Owns
- Runtime-specific social account connections
- Provider publishing execution
- Provider-side scheduling/execution where supported
- Runtime synchronization state
- Provider response/error normalization needed by the adapter

## Does Not Own
- Enterprise social business API
- Paid advertising budgets/campaigns
- CRM records
- AI policy
- Cross-platform identity authority
- Codestra-wide workflow policy

## Integration Boundary
Codestra Social remains the stable business-facing abstraction. Middleware or the approved integration adapter handles durable handoff and normalized callbacks where required. Other Codestra applications should not depend directly on runtime-internal schemas.

## Required Runtime Capabilities
- Account connection status
- Publish/schedule command execution
- Publication status retrieval
- Provider error reporting
- Engagement/metric retrieval where supported
- Health/readiness reporting

## Safety and Reliability
Publishing commands must be traceable to an approved Codestra request, carry correlation/idempotency context where the runtime supports it, and return enough provider identity/state for reconciliation.

## Implementation Order
1. Inventory existing runtime capabilities
2. Map runtime operations to Codestra Social contract
3. Implement adapter compatibility layer
4. Add status/reconciliation mapping
5. Add callback/event mapping
6. Add staging contract tests
7. Promote only after rollback and observability checks