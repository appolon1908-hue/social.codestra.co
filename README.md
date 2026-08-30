# Codestra Social

Codestra Social is Codestra LLC's governed social-media operations platform for
planning, approvals, publishing controls, analytics, engagement workflows, and
enterprise integration.

This product is derived from [Postiz](https://github.com/gitroomhq/postiz-app)
and remains licensed under [AGPL-3.0](LICENSE). Codestra's branding and
extensions do not imply authorship of the upstream project. See
[CODESTRA_BRANDING.md](CODESTRA_BRANDING.md) and `/legal/open-source`.

## Release status

A branch, successful local build, or image tag is not a production release.
Releases require protected exact-SHA CI on `main`, reviewed forward migrations,
an immutable Codestra image digest, SBOM and provenance, release evidence,
staging validation, rollback evidence, and separate production approval.

All publishing, provider writes, callbacks, external delivery, replay, billing,
n8n, Odoo, Klyrow, Telnexa, and production-deployment capabilities default to
disabled.

## Architecture

The TypeScript/pnpm monorepo contains:

- `apps/backend`: NestJS synchronous API and policy enforcement
- `apps/orchestrator`: Temporal-backed asynchronous execution and reconciliation
- `apps/frontend`: browser application
- `libraries`: shared backend and frontend modules
- `contracts`: versioned OpenAPI, AsyncAPI, authority, and URL contracts

PostgreSQL is authoritative for durable product state. Redis is disposable
coordination. Middleware is the only cross-system write boundary.

Backend work is governed by the binding
[backend architecture and development rules](docs/architecture/CODESTRA_SOCIAL_BACKEND_ARCHITECTURE_AND_DEVELOPMENT_RULES.md).

## Development

Use the versions declared in `package.json` and the locked dependency graph:

```bash
pnpm install --frozen-lockfile
pnpm dev:docker
pnpm prisma-migrate-deploy
pnpm dev
```

The root Compose file is local-only and requires explicit credentials and an
immutable application image. Production candidates use reviewed manifests and
image digests. Migrations are invoked as a separate one-shot step and never from
application startup.

## Validation

```bash
pnpm validate:backend-policy
pnpm prisma-validate
pnpm prisma-migrate-deploy
pnpm prisma-migrate-status
pnpm test
pnpm build
```

GitHub CI is authoritative. Generated JUnit, coverage, browser, and test reports
are CI artifacts and must not be committed.

## Security and contribution

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md). All
changes use a short-lived branch and pull request targeting protected `main`.
Follow [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md), and the pull
request template.

## License

Upstream and modified portions retain their respective copyright. The complete
source is distributed under [GNU AGPL v3](LICENSE).
