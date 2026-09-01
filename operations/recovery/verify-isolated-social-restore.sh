#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "${ALLOW_ISOLATED_RESTORE:-false}" == true ]] || { echo "isolated restore requires explicit authorization" >&2; exit 2; }
required=(PGHOST PGPORT PGDATABASE PGUSER PGPASSFILE CODESTRA_SOCIAL_BACKUP_DIR CODESTRA_SOCIAL_RESTORE_UPLOADS_DIR CODESTRA_SOCIAL_RESTORE_EVIDENCE_DIR CODESTRA_SOCIAL_RECOVERY_WORK_ROOT CODESTRA_EXPECTED_RELEASE_SHA CODESTRA_EXPECTED_IMAGE_DIGEST)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "required recovery setting is missing: $name" >&2; exit 2; }
done
[[ "$CODESTRA_EXPECTED_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "expected release SHA is invalid" >&2; exit 2; }
[[ "$CODESTRA_EXPECTED_IMAGE_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "expected image digest is invalid" >&2; exit 2; }
[[ ! -L "$PGPASSFILE" && -f "$PGPASSFILE" ]] || { echo "protected PostgreSQL passfile is invalid" >&2; exit 2; }
[[ "$(stat -c '%a' "$PGPASSFILE")" =~ ^(400|600)$ ]] || { echo "unsafe PostgreSQL passfile mode" >&2; exit 2; }
[[ "$(stat -c '%u' "$PGPASSFILE")" == "$(id -u)" ]] || { echo "PostgreSQL passfile owner mismatch" >&2; exit 2; }
[[ ! -L "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT" && -d "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT" ]] || { echo "recovery work root is invalid" >&2; exit 2; }
[[ "$(findmnt -n -o FSTYPE -T "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT")" == tmpfs ]] || { echo "plaintext recovery work requires tmpfs" >&2; exit 2; }
for file in recovery.tar.gpg METADATA SHA256SUMS; do
  [[ -f "$CODESTRA_SOCIAL_BACKUP_DIR/$file" ]] || { echo "backup artifact is missing: $file" >&2; exit 2; }
done
(cd "$CODESTRA_SOCIAL_BACKUP_DIR" && sha256sum -c SHA256SUMS)
metadata_value() { sed -n "s/^$1=//p" "$CODESTRA_SOCIAL_BACKUP_DIR/METADATA"; }
[[ "$(metadata_value SCHEMA)" == codestra-social-recovery.v1 ]] || { echo "unsupported backup schema" >&2; exit 2; }
backup_id=$(metadata_value BACKUP_ID)
source_database=$(metadata_value DATABASE)
release_sha=$(metadata_value RELEASE_SHA)
image_digest=$(metadata_value IMAGE_DIGEST)
[[ "$release_sha" == "$CODESTRA_EXPECTED_RELEASE_SHA" ]] || { echo "backup release SHA mismatch" >&2; exit 2; }
[[ "$image_digest" == "$CODESTRA_EXPECTED_IMAGE_DIGEST" ]] || { echo "backup image digest mismatch" >&2; exit 2; }
target_database=$(psql -XAtq -v ON_ERROR_STOP=1 -c 'select current_database()')
[[ "$target_database" != "$source_database" && "$target_database" =~ (^|_)restore(_|$) ]] || { echo "restore target is not explicitly isolated" >&2; exit 2; }
existing_tables=$(psql -XAtq -v ON_ERROR_STOP=1 -c "select count(*) from information_schema.tables where table_schema='public'")
[[ "$existing_tables" == 0 ]] || { echo "isolated restore database is not empty" >&2; exit 2; }
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
pg_restore --exit-on-error --no-owner --no-acl --dbname="$PGDATABASE" "$work/database.dump"
required_tables=$(psql -XAtq -v ON_ERROR_STOP=1 -c "select count(*) from information_schema.tables where table_schema='public' and table_name in ('_prisma_migrations','Media','User','Post')")
[[ "$required_tables" == 4 ]] || { echo "required restored tables are missing" >&2; exit 1; }
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
