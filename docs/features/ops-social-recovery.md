# OPS-SOCIAL-RECOVERY — source-only recovery authority

Outcome: provide a reviewable, fail-closed recovery contract for the Codestra
Social PostgreSQL database and local uploads as one release-bound recovery
point. This change does not schedule a backup, stop an application, decrypt an
artifact, restore data, deploy an image, or enable any live capability.

Authority and safety:

- PostgreSQL remains authoritative; the local uploads volume is paired state.
- Backup execution requires an external reviewed deployment authority to
  quiesce the application, set `CODESTRA_SOCIAL_QUIESCED=true`, and prove zero
  remaining application database connections.
- Plaintext dump/archive work is accepted only below an existing `tmpfs` root.
- The published artifact is OpenPGP-encrypted, checksum-bound, atomically
  identified, and records the exact 40-character source SHA plus image digest.
- Database credentials are accepted only through an owner/mode-checked
  `PGPASSFILE`; secret values never enter metadata or logs.
- Restore requires explicit authorization, an empty database whose name is
  visibly isolated, an empty uploads directory, and exact expected source/image
  identities. It never cleans or creates a database and never targets the
  source database identity.
- Archive paths, symbolic links, database schema, upload count, evidence
  checksums, freshness and isolated target class fail closed.

APIs, events, tables and migrations: none are added or changed. Restore verifies
the existing `_prisma_migrations`, `Media`, `User`, and `Post` tables. There is
no application-startup migration, backfill, provider call, outbox delivery, or
inbox mutation.

Capabilities: all existing default-false publishing, provider, callback,
outbox, replay, billing, Odoo, n8n, Klyrow, Telnexa, and production-deployment
flags remain unchanged and disabled. `LIVE_CAPABILITIES_ENABLED=NO`.

Observability and audit: a successful backup or isolated rehearsal publishes a
sanitized, checksum-verifiable marker containing only backup identity, time,
release identity, target class and pass/fail evidence. Runtime scheduling,
retention, off-host replication, alert wiring, RPO/RTO measurement, restore
execution and immutable deployment remain separate reviewed infrastructure
work.

- Branch: `ops/be-social-recovery-authority`
- Base branch: `main`
- Base SHA: `4f7817f6c6d1bb38fa7d85bb1656eb41865283d5`
  Expected PR: source-only recovery authority targeting `main`.

Rollback: revert the source commit. No live state is changed by this PR.
