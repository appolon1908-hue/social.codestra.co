# Immutable release, migration, canary, and rollback runbook

This repository publishes images and evidence. It does not deploy them. A release
is not production-ready merely because an image exists.

## Protected prerequisites

1. The exact source SHA is reachable from protected `main`.
2. Required reviews and CI pass, including a clean PostgreSQL migration run.
3. The image workflow publishes GHCR content by digest with BuildKit provenance
   and SBOM attestations.
4. The release evidence manifest matches
   `deploy/release/release-manifest.schema.json`.
5. PostgreSQL backup/PITR health and a recent restore rehearsal are documented.
6. The previous known-good image digest, configuration revision, and compatible
   database restore point are recorded.
7. Gateway, Keycloak, Middleware, n8n, and provider sandbox dependencies have
   explicit owners and go/no-go evidence.

## Migration gate

Run `prisma migrate deploy` as a protected one-shot job using the exact candidate
image digest. The runtime container refuses `MIGRATE_ON_START=true`; replicas do
not race migrations during rollout. The migration job receives only its scoped
database secret and exits before application rollout.

Before the one-shot job:

- take/verify the approved backup or PITR marker;
- confirm migration compatibility with both old and new application versions;
- run it against a restored production-like copy;
- record start/end time, migration head, image digest, and output.

Never use `db push --accept-data-loss`, `migrate reset`, or a down migration in
production. Destructive local commands are guarded by a loopback-only script and
an explicit local opt-in.

## Canary

1. Deploy the exact `repository@sha256:digest`, never a mutable tag.
2. Keep `SOCIAL_PUBLISHING_ENABLED=false`,
   `ENABLE_EXTERNAL_DELIVERY=false`, `PUBLISHING_KILL_SWITCH=true`, provider
   callbacks false, and Middleware outbox false.
3. Verify live, ready, version, digest, migration head, logs, metrics, and network
   policy from the canary.
4. Run read-only tenant isolation and contract probes. Use provider sandboxes for
   any later publication test.
5. Expand only through an approved rollout gate with alert observation windows.

## Rollback

Stop expansion first. Restore the prior immutable image digest and configuration
revision. Do not automatically reverse schema migrations. If the old application
is not forward-compatible with the new schema, keep the new application stopped
and use the approved database recovery plan. Reconcile outbox/inbox events by
event ID before re-enabling any delivery path; do not bulk replay blindly.

Rollback completion requires version/readiness read-back, zero unexpected leases,
provider status reconciliation, and an incident/release record. A rollback is not
complete when only the container scheduler reports success.
