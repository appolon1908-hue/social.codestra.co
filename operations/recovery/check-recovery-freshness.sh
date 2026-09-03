#!/usr/bin/env bash
set -Eeuo pipefail
root=${CODESTRA_RECOVERY_ROOT:?recovery root is required}
max_age=${CODESTRA_RECOVERY_MAX_AGE_SECONDS:?maximum age is required}
kind=${CODESTRA_RECOVERY_KIND:?recovery kind is required}
signer=${CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT:-}
[[ "$max_age" =~ ^[1-9][0-9]*$ ]] || { echo "maximum age must be a positive integer" >&2; exit 2; }
[[ "$kind" == backup || "$kind" == restore ]] || { echo "recovery kind must be backup or restore" >&2; exit 2; }
[[ -f "$root/LAST_SUCCESS" ]] || { echo "recovery success marker is missing" >&2; exit 1; }
marker=$(tr -d '\r\n' <"$root/LAST_SUCCESS")
if [[ "$kind" == backup ]]; then
  [[ "$signer" =~ ^[A-Fa-f0-9]{40}$ ]] || { echo "backup signing fingerprint is invalid" >&2; exit 2; }
  signer=${signer^^}
  [[ "$marker" =~ ^social-([0-9]{8}T[0-9]{6}Z)-[0-9a-f]{12}$ ]] || { echo "invalid backup marker" >&2; exit 1; }
  stamp=${BASH_REMATCH[1]}
  artifact="$root/$marker"
  for file in recovery.tar.gpg METADATA SIGNED-MANIFEST SIGNED-MANIFEST.sig SHA256SUMS; do [[ -f "$artifact/$file" ]] || { echo "backup evidence is incomplete" >&2; exit 1; }; done
  (cd "$artifact" && sha256sum -c SHA256SUMS >/dev/null)
  signature_status=$(gpg --batch --status-fd=1 --verify "$artifact/SIGNED-MANIFEST.sig" "$artifact/SIGNED-MANIFEST" 2>/dev/null)
  valid_fingerprint=$(awk '$1 == "[GNUPG:]" && $2 == "VALIDSIG" {print toupper($3)}' <<<"$signature_status")
  [[ "$valid_fingerprint" == "$signer" ]] || { echo "backup signature verification failed" >&2; exit 1; }
  (cd "$artifact" && sha256sum -c SIGNED-MANIFEST >/dev/null)
  metadata_id=$(sed -n 's/^BACKUP_ID=//p' "$artifact/METADATA")
  metadata_stamp=$(sed -n 's/^STAMP=//p' "$artifact/METADATA")
  [[ "$metadata_id" == "$marker" && "$metadata_stamp" == "$stamp" ]] || { echo "backup marker does not match verified metadata" >&2; exit 1; }
else
  [[ "$marker" =~ ^RESTORE-RESULT-([0-9]{8}T[0-9]{6}Z)$ ]] || { echo "invalid restore marker" >&2; exit 1; }
  stamp=${BASH_REMATCH[1]}
  [[ -f "$root/$marker" && -f "$root/$marker.sha256" ]] || { echo "restore evidence is incomplete" >&2; exit 1; }
  (cd "$root" && sha256sum -c "$marker.sha256" >/dev/null)
  metadata_stamp=$(sed -n 's/^STAMP=//p' "$root/$marker")
  [[ "$metadata_stamp" == "$stamp" ]] || { echo "restore marker does not match verified metadata" >&2; exit 1; }
fi
stamp_iso="${stamp:0:4}-${stamp:4:2}-${stamp:6:2}T${stamp:9:2}:${stamp:11:2}:${stamp:13:2}Z"
age=$(($(date -u +%s) - $(date -u -d "$stamp_iso" +%s)))
(( age >= -300 )) || { echo "recovery marker is unreasonably in the future" >&2; exit 1; }
(( age <= max_age )) || { echo "recovery evidence is stale age_seconds=$age" >&2; exit 1; }
echo "recovery_freshness=PASS kind=$kind age_seconds=$age max_age_seconds=$max_age"
