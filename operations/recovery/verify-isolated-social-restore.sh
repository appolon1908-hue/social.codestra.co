#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "${ALLOW_ISOLATED_RESTORE:-false}" == true ]] || { echo "isolated restore requires explicit authorization" >&2; exit 2; }
required=(PGHOST PGPORT PGDATABASE PGUSER PGPASSFILE CODESTRA_SOCIAL_BACKUP_DIR CODESTRA_SOCIAL_RESTORE_UPLOADS_DIR CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR CODESTRA_SOCIAL_RECOVERY_WORK_ROOT CODESTRA_EXPECTED_RELEASE_SHA CODESTRA_EXPECTED_IMAGE_DIGEST CODESTRA_EXPECTED_MIGRATION_HEAD CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "required recovery setting is missing: $name" >&2; exit 2; }
done
[[ "$CODESTRA_EXPECTED_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "expected release SHA is invalid" >&2; exit 2; }
[[ "$CODESTRA_EXPECTED_IMAGE_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "expected image digest is invalid" >&2; exit 2; }
[[ "$CODESTRA_EXPECTED_MIGRATION_HEAD" =~ ^[0-9]{14}_[a-z0-9_]+$ ]] || { echo "expected migration head is invalid" >&2; exit 2; }
[[ "$CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT" =~ ^[A-Fa-f0-9]{40}$ ]] || { echo "backup signing fingerprint is invalid" >&2; exit 2; }
CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT=${CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT^^}
[[ ! -L "$PGPASSFILE" && -f "$PGPASSFILE" ]] || { echo "protected PostgreSQL passfile is invalid" >&2; exit 2; }
[[ "$(stat -c '%a' "$PGPASSFILE")" =~ ^(400|600)$ ]] || { echo "unsafe PostgreSQL passfile mode" >&2; exit 2; }
[[ "$(stat -c '%u' "$PGPASSFILE")" == "$(id -u)" ]] || { echo "PostgreSQL passfile owner mismatch" >&2; exit 2; }
[[ ! -L "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT" && -d "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT" ]] || { echo "recovery work root is invalid" >&2; exit 2; }
[[ "$(findmnt -n -o FSTYPE -T "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT")" == tmpfs ]] || { echo "plaintext recovery work requires tmpfs" >&2; exit 2; }
for file in recovery.tar.gpg METADATA SIGNED-MANIFEST SIGNED-MANIFEST.sig SHA256SUMS; do
  [[ -f "$CODESTRA_SOCIAL_BACKUP_DIR/$file" ]] || { echo "backup artifact is missing: $file" >&2; exit 2; }
done
(cd "$CODESTRA_SOCIAL_BACKUP_DIR" && sha256sum -c SHA256SUMS)
signature_status=$(gpg --batch --status-fd=1 --verify "$CODESTRA_SOCIAL_BACKUP_DIR/SIGNED-MANIFEST.sig" "$CODESTRA_SOCIAL_BACKUP_DIR/SIGNED-MANIFEST" 2>/dev/null)
valid_fingerprint=$(awk '$1 == "[GNUPG:]" && $2 == "VALIDSIG" {print toupper($3)}' <<<"$signature_status")
[[ "$valid_fingerprint" == "$CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT" ]] || { echo "backup signature verification failed" >&2; exit 2; }
(cd "$CODESTRA_SOCIAL_BACKUP_DIR" && sha256sum -c SIGNED-MANIFEST)
metadata_value() { sed -n "s/^$1=//p" "$CODESTRA_SOCIAL_BACKUP_DIR/METADATA"; }
[[ "$(metadata_value SCHEMA)" == codestra-social-recovery.v1 ]] || { echo "unsupported backup schema" >&2; exit 2; }
backup_id=$(metadata_value BACKUP_ID)
source_database=$(metadata_value DATABASE)
release_sha=$(metadata_value RELEASE_SHA)
image_digest=$(metadata_value IMAGE_DIGEST)
migration_head=$(metadata_value MIGRATION_HEAD)
signing_fingerprint=$(metadata_value SIGNING_FINGERPRINT)
[[ "$release_sha" == "$CODESTRA_EXPECTED_RELEASE_SHA" ]] || { echo "backup release SHA mismatch" >&2; exit 2; }
[[ "$image_digest" == "$CODESTRA_EXPECTED_IMAGE_DIGEST" ]] || { echo "backup image digest mismatch" >&2; exit 2; }
[[ "$migration_head" == "$CODESTRA_EXPECTED_MIGRATION_HEAD" ]] || { echo "backup migration head mismatch" >&2; exit 2; }
[[ "$signing_fingerprint" == "$CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT" ]] || { echo "backup signing identity mismatch" >&2; exit 2; }
target_database=$(psql -XAtq -v ON_ERROR_STOP=1 -c 'select current_database()')
[[ "$target_database" != "$source_database" && "$target_database" =~ (^|_)restore(_|$) ]] || { echo "restore target is not explicitly isolated" >&2; exit 2; }
existing_user_objects=$(psql -XAtq -v ON_ERROR_STOP=1 <<'SQL'
with user_namespaces as (
  select oid, nspname from pg_namespace
  where nspname <> 'information_schema' and nspname !~ '^pg_'
), object_counts as (
  select count(*)::bigint as amount from user_namespaces where nspname <> 'public'
  union all select count(*) from pg_class c join user_namespaces n on n.oid=c.relnamespace
  union all select count(*) from pg_proc p join user_namespaces n on n.oid=p.pronamespace
  union all select count(*) from pg_type t join user_namespaces n on n.oid=t.typnamespace
  union all select count(*) from pg_extension where extname <> 'plpgsql'
)
select coalesce(sum(amount), 0) from object_counts;
SQL
)
[[ "$existing_user_objects" == 0 ]] || { echo "isolated restore database contains user objects" >&2; exit 2; }
[[ ! -L "$CODESTRA_SOCIAL_RESTORE_UPLOADS_DIR" && -d "$CODESTRA_SOCIAL_RESTORE_UPLOADS_DIR" ]] || { echo "isolated uploads target is invalid" >&2; exit 2; }
[[ -z "$(find "$CODESTRA_SOCIAL_RESTORE_UPLOADS_DIR" -mindepth 1 -print -quit)" ]] || { echo "isolated uploads target is not empty" >&2; exit 2; }

work=$(mktemp -d "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT/restore-${backup_id}.XXXXXX")
cleanup() { find "$work" -mindepth 1 -delete 2>/dev/null || true; rmdir "$work" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
gpg --batch --quiet --decrypt --output "$work/recovery.tar" "$CODESTRA_SOCIAL_BACKUP_DIR/recovery.tar.gpg"
tar -tf "$work/recovery.tar" >"$work/bundle.members"
if grep -Eq '(^/|(^|/)\.\.(/|$))' "$work/bundle.members"; then echo "unsafe recovery bundle path" >&2; exit 2; fi
expected_members=$'BUNDLE-METADATA\nBUNDLE-SHA256SUMS\ndatabase.catalog\ndatabase.dump\nuploads.tar'
[[ "$(LC_ALL=C sort "$work/bundle.members")" == "$expected_members" ]] || { echo "unexpected recovery bundle members" >&2; exit 2; }
(cd "$work" && tar --no-same-owner --no-same-permissions -xf recovery.tar)
for file in database.dump database.catalog uploads.tar BUNDLE-METADATA BUNDLE-SHA256SUMS; do
  [[ -f "$work/$file" && ! -L "$work/$file" ]] || { echo "recovery bundle member is not a regular file" >&2; exit 2; }
done
(cd "$work" && sha256sum -c BUNDLE-SHA256SUMS)
[[ "$(sed -n 's/^BACKUP_ID=//p' "$work/BUNDLE-METADATA")" == "$backup_id" ]] || { echo "inner and outer backup identities differ" >&2; exit 2; }
[[ "$(sed -n 's/^RELEASE_SHA=//p' "$work/BUNDLE-METADATA")" == "$release_sha" ]] || { echo "inner and outer release identities differ" >&2; exit 2; }
[[ "$(sed -n 's/^IMAGE_DIGEST=//p' "$work/BUNDLE-METADATA")" == "$image_digest" ]] || { echo "inner and outer image identities differ" >&2; exit 2; }
[[ "$(sed -n 's/^MIGRATION_HEAD=//p' "$work/BUNDLE-METADATA")" == "$migration_head" ]] || { echo "inner and outer migration identities differ" >&2; exit 2; }
[[ "$(sed -n 's/^SIGNING_FINGERPRINT=//p' "$work/BUNDLE-METADATA")" == "$signing_fingerprint" ]] || { echo "inner and outer signing identities differ" >&2; exit 2; }
pg_restore --exit-on-error --no-owner --no-acl --dbname="$PGDATABASE" "$work/database.dump"
required_tables=$(psql -XAtq -v ON_ERROR_STOP=1 -c "select count(*) from information_schema.tables where table_schema='public' and table_name in ('_prisma_migrations','Media','User','Post')")
[[ "$required_tables" == 4 ]] || { echo "required restored tables are missing" >&2; exit 1; }
migration_applied=$(psql -XAtq -v ON_ERROR_STOP=1 -v expected_migration="$CODESTRA_EXPECTED_MIGRATION_HEAD" -c "select count(*) from \"_prisma_migrations\" where migration_name=:'expected_migration' and finished_at is not null and rolled_back_at is null")
[[ "$migration_applied" == 1 ]] || { echo "expected restored migration head is not applied" >&2; exit 1; }
tar -tf "$work/uploads.tar" >"$work/uploads.members"
if grep -Eq '(^/|(^|/)\.\.(/|$))' "$work/uploads.members"; then echo "unsafe uploads archive path" >&2; exit 2; fi
tar --no-same-owner --no-same-permissions -xf "$work/uploads.tar" -C "$CODESTRA_SOCIAL_RESTORE_UPLOADS_DIR"
if find "$CODESTRA_SOCIAL_RESTORE_UPLOADS_DIR" -xdev -type l -print -quit | grep -q .; then echo "restored uploads contain a symbolic link" >&2; exit 1; fi
expected_files=$(sed -n 's/^UPLOAD_FILE_COUNT=//p' "$work/BUNDLE-METADATA")
restored_files=$(find "$CODESTRA_SOCIAL_RESTORE_UPLOADS_DIR" -xdev -type f | wc -l | tr -d ' ')
[[ "$restored_files" == "$expected_files" ]] || { echo "restored upload count mismatch" >&2; exit 1; }

install -d -m 0700 "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR"
exec 8>"$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.restore.lock"
flock -n 8 || { echo "another restore verification is publishing evidence" >&2; exit 3; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
result="RESTORE-RESULT-$stamp"
cat >"$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.$result" <<EOF
SCHEMA=codestra-social-restore-result.v1
STAMP=$stamp
BACKUP_ID=$backup_id
RELEASE_SHA=$release_sha
IMAGE_DIGEST=$image_digest
MIGRATION_HEAD=$migration_head
SIGNATURE=PASS
TARGET_CLASS=ISOLATED
DATABASE_SCHEMA=PASS
UPLOAD_ARCHIVE=PASS
UPLOAD_FILE_COUNT=$restored_files
RESTORE=PASS
PRODUCTION_CHANGED=NO
EOF
chmod 0600 "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.$result"
sync "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.$result"
mv "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.$result" "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/$result"
(cd "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR" && sha256sum "$result" >".$result.sha256")
chmod 0600 "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.$result.sha256"
sync "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.$result.sha256"
mv "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.$result.sha256" "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/$result.sha256"
printf '%s\n' "$result" >"$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.LAST_SUCCESS-$stamp"
chmod 0600 "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.LAST_SUCCESS-$stamp"
mv "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/.LAST_SUCCESS-$stamp" "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR/LAST_SUCCESS"
sync -d "$CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR"
echo "restore=PASS target_class=ISOLATED backup_id=$backup_id production_changed=NO"
