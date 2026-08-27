# Change type and outcome

Describe the user/system outcome and select the change type:

- [ ] Contract or architecture
- [ ] Security or tenant isolation
- [ ] Durable state, migration, or worker
- [ ] Integration
- [ ] Observability or operations
- [ ] Product feature

# Why this change is needed

Explain the problem, authority boundary, and the evidence supporting the change.

# Stack and dependencies

- Base/dependency branch:
- Required contract version:
- Required cross-repository branch/SHA:
- Merge order:

# Security and data review

- [ ] Middleware remains the only cross-system write boundary.
- [ ] Tenant, issuer, audience, scope, idempotency, and replay behavior were reviewed.
- [ ] No provider token, signing secret, credential, or sensitive payload was committed/logged.
- [ ] PostgreSQL remains authoritative; Redis/n8n are not used as correctness truth.
- [ ] Publishing and external delivery remained fail-closed during validation.

# Migration, release, and rollback

- Migration impact:
- Backup/restore requirement:
- Canary/read-back evidence:
- Rollback digest/configuration/schema plan:

# Validation evidence

List exact commands, test counts, build results, and any known limitations.

- [ ] Prisma schema and migrations validated when changed.
- [ ] Relevant tests pass.
- [ ] Backend/orchestrator/frontend builds pass when affected.
- [ ] Contracts and deployment YAML parse and are formatted.
- [ ] No live deployment or production mutation was performed by this PR.
