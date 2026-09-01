from __future__ import annotations

import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
BACKUP = (ROOT / "operations/recovery/backup-social-state.sh").read_text()
RESTORE = (ROOT / "operations/recovery/verify-isolated-social-restore.sh").read_text()
FRESHNESS = ROOT / "operations/recovery/check-recovery-freshness.sh"


def _executable(path: Path, body: str) -> None:
    path.write_text("#!/bin/sh\nset -eu\n" + body)
    path.chmod(0o700)


def _backup_tools(root: Path) -> Path:
    tools = root / "bin"
    tools.mkdir()
    _executable(
        tools / "psql",
        'state="${MOCK_PSQL_STATE:?}"\n'
        'count=$(cat "$state" 2>/dev/null || echo 0)\n'
        'if [ "$count" = 0 ]; then echo social_test; elif [ "$count" = 1 ]; then echo 0; else echo 1; fi\n'
        'echo $((count + 1)) >"$state"\n',
    )
    _executable(
        tools / "pg_dump",
        'for arg in "$@"; do case "$arg" in --file=*) out=${arg#--file=};; esac; done\n'
        ': "${out:?}"\nprintf synthetic-dump >"$out"\n',
    )
    _executable(tools / "pg_restore", 'if [ "${1:-}" = --list ]; then echo synthetic-catalog; fi\n')
    _executable(
        tools / "gpg",
        'case " $* " in *" --list-secret-keys "*) exit 0;; esac\n'
        'case " $* " in *" --verify "*) echo "[GNUPG:] VALIDSIG AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; exit 0;; esac\n'
        'out=\nwhile [ "$#" -gt 0 ]; do\n'
        '  case "$1" in --output) out=$2; shift 2;; --recipient|--local-user) shift 2;; *) shift;; esac\n'
        'done\n: "${out:?}"\ncat >"$out"\n',
    )
    _executable(tools / "shred", 'shift\nrm -f "$@"\n')
    _executable(tools / "sync", "exit 0\n")
    _executable(tools / "findmnt", "echo tmpfs\n")
    return tools


class SocialRecoveryAuthorityTests(unittest.TestCase):
    def test_backup_is_consistent_encrypted_and_release_bound(self) -> None:
        for required in (
            "CODESTRA_SOCIAL_QUIESCED", "pg_stat_activity", "--serializable-deferrable",
            "database.dump", "uploads.tar", "BUNDLE-SHA256SUMS", "recovery.tar.gpg",
            "CODESTRA_RELEASE_SHA", "CODESTRA_IMAGE_DIGEST", "APPLICATION_QUIESCED=true",
            'findmnt -n -o FSTYPE', '== tmpfs', 'flock -n 9',
            'mv "$publish" "$destination"', 'sync -d "$CODESTRA_SOCIAL_BACKUP_ROOT"',
            "CODESTRA_MIGRATION_HEAD", "CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT",
            "--detach-sign", "SIGNED-MANIFEST.sig",
        ):
            self.assertIn(required, BACKUP)
        self.assertIn('shred -u "$work/database.dump"', BACKUP)
        self.assertNotIn("POSTGRES_PASSWORD", BACKUP)
        self.assertNotIn("DATABASE_URL", BACKUP)

    def test_restore_is_empty_isolated_tuple_bound_and_verifying(self) -> None:
        for required in (
            "ALLOW_ISOLATED_RESTORE", "CODESTRA_EXPECTED_RELEASE_SHA",
            "CODESTRA_EXPECTED_IMAGE_DIGEST", "restore target is not explicitly isolated",
            "isolated restore database contains user objects", "isolated uploads target is not empty",
            "sha256sum -c BUNDLE-SHA256SUMS", "--exit-on-error", "'_prisma_migrations'",
            "'Media'", "'User'", "'Post'", "restored upload count mismatch",
            "TARGET_CLASS=ISOLATED", "PRODUCTION_CHANGED=NO", 'flock -n 8',
            "unexpected recovery bundle members", "recovery bundle member is not a regular file",
            "VALIDSIG", "backup signature verification failed",
            "expected restored migration head is not applied", "existing_user_objects",
        ):
            self.assertIn(required, RESTORE)
        self.assertNotIn("--clean", RESTORE)
        self.assertNotIn("drop database", RESTORE.lower())
        self.assertNotIn("createdb", RESTORE.lower())

    def test_archives_fail_closed_on_links_and_unsafe_members(self) -> None:
        self.assertIn("uploads contain a symbolic link", BACKUP)
        self.assertIn("unsafe recovery bundle path", RESTORE)
        self.assertIn("unsafe uploads archive path", RESTORE)
        self.assertIn("restored uploads contain a symbolic link", RESTORE)
        self.assertIn("--no-same-owner --no-same-permissions", RESTORE)

    def test_freshness_verifies_backup_checksum_and_age(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stamp = subprocess.run(
                ["date", "-u", "+%Y%m%dT%H%M%SZ"], check=True,
                text=True, capture_output=True,
            ).stdout.strip()
            backup_id = f"social-{stamp}-{'1' * 12}"
            artifact = root / backup_id
            artifact.mkdir()
            (artifact / "recovery.tar.gpg").write_text("encrypted fixture")
            (artifact / "METADATA").write_text(
                f"BACKUP_ID={backup_id}\nSTAMP={stamp}\n"
            )
            with (artifact / "SIGNED-MANIFEST").open("w") as output:
                subprocess.run(
                    ["sha256sum", "recovery.tar.gpg", "METADATA"], cwd=artifact,
                    check=True, text=True, stdout=output,
                )
            (artifact / "SIGNED-MANIFEST.sig").write_text("signature fixture")
            with (artifact / "SHA256SUMS").open("w") as output:
                subprocess.run(
                    ["sha256sum", "recovery.tar.gpg", "METADATA", "SIGNED-MANIFEST", "SIGNED-MANIFEST.sig"], cwd=artifact,
                    check=True, text=True, stdout=output,
                )
            (root / "LAST_SUCCESS").write_text(backup_id + "\n")
            tools = root / "bin"
            tools.mkdir()
            _executable(
                tools / "gpg",
                'echo "[GNUPG:] VALIDSIG AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"\n',
            )
            env = {
                **os.environ,
                "PATH": f"{tools}:{os.environ['PATH']}",
                "CODESTRA_RECOVERY_ROOT": str(root),
                "CODESTRA_RECOVERY_MAX_AGE_SECONDS": "120",
                "CODESTRA_RECOVERY_KIND": "backup",
                "CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT": "A" * 40,
            }
            result = subprocess.run([str(FRESHNESS)], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            (artifact / "recovery.tar.gpg").write_text("corrupt")
            result = subprocess.run([str(FRESHNESS)], env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            (artifact / "recovery.tar.gpg").write_text("encrypted fixture")
            (artifact / "METADATA").write_text(
                f"BACKUP_ID={backup_id}\nSTAMP=20990101T000000Z\n"
            )
            with (artifact / "SHA256SUMS").open("w") as output:
                subprocess.run(
                    ["sha256sum", "recovery.tar.gpg", "METADATA", "SIGNED-MANIFEST", "SIGNED-MANIFEST.sig"], cwd=artifact,
                    check=True, text=True, stdout=output,
                )
            result = subprocess.run([str(FRESHNESS)], env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("checksum did NOT match", result.stderr)

            (artifact / "METADATA").write_text(
                f"BACKUP_ID={backup_id}\nSTAMP={stamp}\n"
            )
            with (artifact / "SIGNED-MANIFEST").open("w") as output:
                subprocess.run(
                    ["sha256sum", "recovery.tar.gpg", "METADATA"], cwd=artifact,
                    check=True, text=True, stdout=output,
                )
            with (artifact / "SHA256SUMS").open("w") as output:
                subprocess.run(
                    ["sha256sum", "recovery.tar.gpg", "METADATA", "SIGNED-MANIFEST", "SIGNED-MANIFEST.sig"], cwd=artifact,
                    check=True, text=True, stdout=output,
                )
            renamed_id = f"social-{stamp}-{'3' * 12}"
            artifact.rename(root / renamed_id)
            (root / "LAST_SUCCESS").write_text(renamed_id + "\n")
            result = subprocess.run([str(FRESHNESS)], env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("does not match verified metadata", result.stderr)

    def test_backup_behavior_publishes_only_encrypted_atomic_pair(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            tools = _backup_tools(root)
            uploads = root / "uploads"
            uploads.mkdir()
            (uploads / "fixture.bin").write_bytes(b"synthetic-upload")
            backup_root = root / "backups"
            work_root = root / "work"
            work_root.mkdir()
            passfile = root / "pgpass"
            passfile.write_text("synthetic")
            passfile.chmod(0o600)
            env = {
                **os.environ,
                "PATH": f"{tools}:{os.environ['PATH']}",
                "MOCK_PSQL_STATE": str(root / "psql-state"),
                "PGHOST": "synthetic.invalid", "PGPORT": "5432",
                "PGDATABASE": "social_test", "PGUSER": "synthetic",
                "PGPASSFILE": str(passfile),
                "CODESTRA_SOCIAL_UPLOADS_DIR": str(uploads),
                "CODESTRA_SOCIAL_BACKUP_ROOT": str(backup_root),
                "CODESTRA_SOCIAL_RECOVERY_WORK_ROOT": str(work_root),
                "CODESTRA_RELEASE_SHA": "1" * 40,
                "CODESTRA_IMAGE_DIGEST": "sha256:" + "2" * 64,
                "CODESTRA_MIGRATION_HEAD": "20260803000200_codestra_security_expand",
                "CODESTRA_BACKUP_GPG_RECIPIENT": "synthetic-recipient",
                "CODESTRA_BACKUP_GPG_SIGNING_FINGERPRINT": "A" * 40,
                "CODESTRA_EXPECTED_DATABASE": "social_test",
                "CODESTRA_SOCIAL_QUIESCED": "true",
            }
            result = subprocess.run(
                [str(ROOT / "operations/recovery/backup-social-state.sh")],
                env=env, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            backup_id = (backup_root / "LAST_SUCCESS").read_text().strip()
            published = backup_root / backup_id
            self.assertEqual(
                sorted(path.name for path in published.iterdir()),
                ["METADATA", "SHA256SUMS", "SIGNED-MANIFEST", "SIGNED-MANIFEST.sig", "recovery.tar.gpg"],
            )
            self.assertFalse(any(backup_root.glob(".*.publishing")))
            verified = subprocess.run(
                ["sha256sum", "-c", "SHA256SUMS"], cwd=published,
                capture_output=True, text=True,
            )
            self.assertEqual(verified.returncode, 0, verified.stderr)
            self.assertFalse(any(work_root.iterdir()))

    def test_source_does_not_schedule_or_execute_recovery(self) -> None:
        compose = (ROOT / "docker-compose.yaml").read_text()
        workflows = "\n".join(path.read_text() for path in (ROOT / ".github/workflows").glob("*.yml"))
        for executable in ("backup-social-state.sh", "verify-isolated-social-restore.sh"):
            self.assertNotIn(executable, compose)
            self.assertNotIn(executable, workflows)


if __name__ == "__main__":
    unittest.main(verbosity=2)
