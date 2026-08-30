# Repository agent instructions

All backend and orchestrator work MUST follow
[`docs/architecture/CODESTRA_SOCIAL_BACKEND_ARCHITECTURE_AND_DEVELOPMENT_RULES.md`](docs/architecture/CODESTRA_SOCIAL_BACKEND_ARCHITECTURE_AND_DEVELOPMENT_RULES.md).

That standard is binding. In particular: branch from current green `main`, target
`main`, use contract-first APIs/events, preserve tenant isolation and durable
idempotency, run forward migrations separately, keep every live capability
disabled, and never push directly to `main` or merge your own pull request.
