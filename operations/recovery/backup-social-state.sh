#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

required=(PGHOST PGPORT PGDATABASE PGUSER PGPASSFILE CODESTRA_SOCIAL_UPLOADS_DIR CODESTRA_SOCIAL_BACKUP_ROOT CODESTRA_SOCIAL_RECOVERY_WORK_ROOT CODESTRA_RELEASE_SHA CODESTRA_IMAGE_DIGEST CODESTRA_MIGRATION_HEAD CODESTRA_BACKUP_GPG_RECIPIENT CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT CODESTRA_EXPECTED_DATABASE)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "required recovery setting is missing: $name" >&2; exit 2; }
done
[[ "${CODESTRA_SOCIAL_QUIESCED:-false}" == true ]] || { echo "social application must be quiesced by reviewed deployment authority" >&2; exit 2; }
[[ "$CODESTRA_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "release SHA is not immutable" >&2; exit 2; }
[[ "$CODESTRA_IMAGE_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "image digest is not immutable" >&2; exit 2; }
[[ "$CODESTRA_MIGRATION_HEAD" =~ ^[0-9]{14}_[a-z0-9_]+$ ]] || { echo "migration head is invalid" >&2; exit 2; }
[[ "$CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT" =~ ^[A-Fa-f0-9]{40}$ ]] || { echo "backup signing fingerprint is invalid" >&2; exit 2; }
CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT=${CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT^^}
gpg --batch --list-secret-keys "$CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT" >/dev/null 2>&1 || { echo "authorized backup signing key is unavailable" >&2; exit 2; }
[[ "$CODESTRA_EXPECTED_DATABASE" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "expected database identity is invalid" >&2; exit 2; }
[[ ! -L "$PGPASSFILE" && -f "$PGPASSFILE" ]] || { echo "protected PostgreSQL passfile is invalid" >&2; exit 2; }
[[ "$(stat -c '%a' "$PGPASSFILE")" =~ ^(400|600)$ ]] || { echo "unsafe PostgreSQL passfile mode" >&2; exit 2; }
[[ "$(stat -c '%u' "$PGPASSFILE")" == "$(id -u)" ]] || { echo "PostgreSQL passfile owner mismatch" >&2; exit 2; }
[[ ! -L "$CODESTRA_SOCIAL_UPLOADS_DIR" && -d "$CODESTRA_SOCIAL_UPLOADS_DIR" ]] || { echo "uploads source is invalid" >&2; exit 2; }
[[ ! -L "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT" && -d "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT" ]] || { echo "recovery work root is invalid" >&2; exit 2; }
[[ "$(findmnt -n -o FSTYPE -T "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT")" == tmpfs ]] || { echo "plaintext recovery work requires tmpfs" >&2; exit 2; }
if find "$CODESTRA_SOCIAL_UPLOADS_DIR" -xdev -type l -print -quit | grep -q .; then
  echo "uploads contain a symbolic link" >&2
  exit 2
fi

database_name=$(psql -XAtq -v ON_ERROR_STOP=1 -c 'select current_database()')
[[ "$database_name" == "$CODESTRA_EXPECTED_DATABASE" ]] || { echo "unexpected database identity" >&2; exit 2; }
application_connections=$(psql -XAtq -v ON_ERROR_STOP=1 -c "select count(*) from pg_stat_activity where datname=current_database() and pid <> pg_backend_pid()")
[[ "$application_connections" == 0 ]] || { echo "database still has application connections" >&2; exit 2; }
migration_applied=$(psql -XAtq -v ON_ERROR_STOP=1 -v expected_migration="$CODESTRA_MIGRATION_HEAD" -c "select count(*) from \"_prisma_migrations\" where migration_name=:'expected_migration' and finished_at is not null and rolled_back_at is null")
[[ "$migration_applied" == 1 ]] || { echo "expected migration head is not applied" >&2; exit 2; }

install -d -m 0700 "$CODESTRA_SOCIAL_BACKUP_ROOT"
exec 9>"$CODESTRA_SOCIAL_BACKUP_ROOT/.backup.lock"
flock -n 9 || { echo "another backup is active" >&2; exit 3; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_id="social-${stamp}-${CODESTRA_RELEASE_SHA:0:12}"
work=$(mktemp -d "$CODESTRA_SOCIAL_RECOVERY_WORK_ROOT/${backup_id}.XXXXXX")
publish="$CODESTRA_SOCIAL_BACKUP_ROOT/.${backup_id}.publishing"
cleanup() {
  find "$work" -mindepth 1 -delete 2>/dev/null || true
  rmdir "$work" 2>/dev/null || true
  if [[ -d "$publish" ]]; then
    find "$publish" -mindepth 1 -delete 2>/dev/null || true
    rmdir "$publish" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

window_start=$(date -u +%FT%TZ)
pg_dump --format=custom --serializable-deferrable --no-owner --no-acl --file="$work/database.dump"
pg_restore --list "$work/database.dump" >"$work/database.catalog"
tar --one-file-system --numeric-owner -C "$CODESTRA_SOCIAL_UPLOADS_DIR" -cf "$work/uploads.tar" .
tar -tf "$work/uploads.tar" >/dev/null
upload_files=$(find "$CODESTRA_SOCIAL_UPLOADS_DIR" -xdev -type f | wc -l | tr -d ' ')
window_end=$(date -u +%FT%TZ)
cat >"$work/BUNDLE-METADATA" <<EOF
SCHEMA=codestra-social-recovery-bundle.v1
BACKUP_ID=$backup_id
STAMP=$stamp
DATABASE=$database_name
RELEASE_SHA=$CODESTRA_RELEASE_SHA
IMAGE_DIGEST=$CODESTRA_IMAGE_DIGEST
MIGRATION_HEAD=$CODESTRA_MIGRATION_HEAD
SIGNING_FINGERPRINT=$CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT
UPLOAD_FILE_COUNT=$upload_files
CONSISTENCY_WINDOW_START=$window_start
CONSISTENCY_WINDOW_END=$window_end
APPLICATION_QUIESCED=true
EOF
(cd "$work" && sha256sum database.dump database.catalog uploads.tar BUNDLE-METADATA >BUNDLE-SHA256SUMS)
(cd "$work" && tar -cf - database.dump database.catalog uploads.tar BUNDLE-METADATA BUNDLE-SHA256SUMS) |
  gpg --batch --yes --trust-model always --recipient "$CODESTRA_BACKUP_GPG_RECIPIENT" \
    --encrypt --output "$work/recovery.tar.gpg"
shred -u "$work/database.dump" "$work/database.catalog" "$work/uploads.tar" "$work/BUNDLE-METADATA" "$work/BUNDLE-SHA256SUMS"

destination="$CODESTRA_SOCIAL_BACKUP_ROOT/$backup_id"
[[ ! -e "$destination" && ! -e "$publish" ]] || { echo "backup identity collision" >&2; exit 3; }
install -d -m 0700 "$publish"
mv "$work/recovery.tar.gpg" "$publish/"
cat >"$publish/METADATA" <<EOF
SCHEMA=codestra-social-recovery.v1
BACKUP_ID=$backup_id
STAMP=$stamp
DATABASE=$database_name
RELEASE_SHA=$CODESTRA_RELEASE_SHA
IMAGE_DIGEST=$CODESTRA_IMAGE_DIGEST
MIGRATION_HEAD=$CODESTRA_MIGRATION_HEAD
SIGNING_FINGERPRINT=$CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT
UPLOAD_FILE_COUNT=$upload_files
ENCRYPTION=OPENPGP
APPLICATION_QUIESCED=true
EOF
(cd "$publish" && sha256sum recovery.tar.gpg METADATA >SIGNED-MANIFEST)
gpg --batch --yes --local-user "$CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT" \
  --detach-sign --output "$publish/SIGNED-MANIFEST.sig" "$publish/SIGNED-MANIFEST"
(cd "$publish" && sha256sum recovery.tar.gpg METADATA SIGNED-MANIFEST SIGNED-MANIFEST.sig >SHA256SUMS)
chmod 0600 "$publish"/*
sync "$publish/recovery.tar.gpg" "$publish/METADATA" "$publish/SIGNED-MANIFEST" "$publish/SIGNED-MANIFEST.sig" "$publish/SHA256SUMS"
sync -d "$publish"
mv "$publish" "$destination"
sync -d "$CODESTRA_SOCIAL_BACKUP_ROOT"
printf '%s\n' "$backup_id" >"$CODESTRA_SOCIAL_BACKUP_ROOT/.LAST_SUCCESS-$stamp"
chmod 0600 "$CODESTRA_SOCIAL_BACKUP_ROOT/.LAST_SUCCESS-$stamp"
sync "$CODESTRA_SOCIAL_BACKUP_ROOT/.LAST_SUCCESS-$stamp"
mv "$CODESTRA_SOCIAL_BACKUP_ROOT/.LAST_SUCCESS-$stamp" "$CODESTRA_SOCIAL_BACKUP_ROOT/LAST_SUCCESS"
sync -d "$CODESTRA_SOCIAL_BACKUP_ROOT"
echo "backup=PASS backup_id=$backup_id release_sha=$CODESTRA_RELEASE_SHA image_digest=$CODESTRA_IMAGE_DIGEST production_changed=NO"
