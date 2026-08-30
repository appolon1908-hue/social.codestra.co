# Codestra Social Integration Files

## Purpose

This branch prepares the files needed to connect `social.codestra.co` to the Codestra platform without enabling production traffic.

## Files Added

- `codestra/integration/social-codestra.integration.v1.json` — machine-readable integration manifest.
- `codestra/integration/middleware-command-contract.v1.json` — Middleware command/event contract for social automation.
- `codestra/integration/n8n-orchestration.v1.json` — CP-POSTLY workflow import contract, inactive by default.
- `codestra/integration/openbao-secret-aliases.v1.json` — secret alias manifest without secret values.
- `codestra/integration/runtime.env.example` — non-secret runtime environment template.
- `monitoring/social-codestra-metrics-contract.v1.json` — bounded metrics contract for Prometheus and Grafana.
- `monitoring/prometheus-target.disabled.yml` — disabled Prometheus scrape target example.
- `monitoring/codestra-social-recording-rules.yml` — social-specific recording rules for Grafana.
- `docs/CODESTRA-INTEGRATION-FILES.md` — operator handoff.
- `scripts/validate-codestra-integration.mjs` — fail-closed validation.
- `.github/workflows/validate-codestra-integration.yml` — CI for the integration files.

## Intended Integration Path

```text
Browser / social.codestra.co
  -> same-origin frontend/backend
  -> Codestra SDK or intake BFF
  -> Caddy
  -> Kong
  -> Middleware
  -> n8n orchestration when coordination is required
  -> Middleware
  -> approved destination systems or providers
```

## Boundaries

- No browser code receives Keycloak confidential-client secrets.
- No browser code receives direct Middleware, Odoo, n8n, provider, SMS, email or voice credentials.
- Product writes that affect external providers must go through Middleware.
- Communications writes currently map to the Middleware `email.message.send.v1` command contract.
- n8n may claim jobs and coordinate commands only through Middleware automation endpoints.
- n8n must not call social provider APIs, Odoo, SMTP, SMS, PostgreSQL, Redis or OpenBao directly.
- Metrics are disabled until Prometheus target approval.
- Voice controls are UX only; they do not authorize PSTN dialing.

## Prepared Workflow Lane

The prepared n8n lane is `CP-POSTLY-*`:

- `CP-POSTLY-COMMON-ERROR`
- `CP-POSTLY-PUBLICATION-REQUEST`
- `CP-POSTLY-STATUS-SYNC`
- `CP-POSTLY-INBOX-TRIAGE`
- `CP-POSTLY-ANALYTICS-SNAPSHOT`

All workflow exports must remain inactive by default, hash-versioned in Git and free of credential material. Runtime credentials belong in n8n's credential store, backed by OpenBao aliases where applicable.

## Activation Gates

Before production activation:

1. Merge the relevant SDK intake and communications PRs.
2. Prove Keycloak and Kong route/scope matrix for `social-codestra`.
3. Prove Middleware canary calls with valid, invalid, no-token and wrong-scope cases.
4. Approve private Prometheus target inventory.
5. Confirm Alertmanager routing through Middleware, not direct email/SMS/voice receivers.
6. Verify no direct provider write path remains for governed communications.
7. Import inactive `CP-POSTLY-*` workflows into staging n8n.
8. Run the first staging proof through Middleware with live delivery disabled and confirm no unexpected DLQ.
