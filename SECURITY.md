# Codestra Social security policy

Codestra LLC maintains the Codestra deployment, branding, integrations, and
extensions in this repository. Only an explicitly supported Codestra Social
release receives security fixes; branch tips, PR images, and untagged images are
not supported releases.

## Scope

Reports are in scope when they demonstrate confidentiality, integrity, or
availability impact in this repository's Codestra-specific application code,
Codestra-owned images or release automation, authentication, authorization,
tenant isolation, secret handling, webhooks, publishing controls, provider
integrations, or the hosted service at `https://social.codestra.co`.

Do not access or retain another user's data. Do not perform denial-of-service,
social engineering, high-volume automated scanning, or real social publishing.

## Private reporting

Open a private report through this repository's Security tab:

<https://github.com/appolon1908-hue/social.codestra.co/security/advisories/new>

Do not disclose an unpatched issue in a public issue, discussion, pull request,
or social post. Include the affected revision/release/component, reproducible
steps, demonstrated impact, required privileges, redacted evidence, and a
suggested mitigation if known.

For exposed credentials, tokens, signing keys, or personal records, provide only
the location and enough private context to identify them. Never paste the secret.

## Response targets

- Initial acknowledgment: 72 hours
- Initial triage: 7 calendar days
- Active-remediation update: at least every 14 calendar days

Remediation and disclosure timing depend on severity and safe rollout. A report
does not guarantee a CVE or bounty.

## Upstream issues

Findings reproducible in unmodified Postiz may be coordinated with the
[upstream security process](https://github.com/gitroomhq/postiz-app/security).
Still notify Codestra privately whenever a supported Codestra release or hosted
service is affected.
