# Horizon portfolio-shell adoption

## Authority

- Horizon repository: `appolon1908-hue/SDK-repository`
- Foundation PR: `#73`
- Foundation exact head: `7db4c6549a0a007922355090f03c082a308f3855`
- Adoption branch: `feature/horizon-portfolio-shell-v1`
- Product theme: `social`
- Runtime activation: **not included**

## Canonical domains

| Role | Domain |
|---|---|
| Social application | `https://social.codestra.co` |
| Shared identity | `https://auth.codestra.co` |
| Shared API edge | `https://api.codestra.co` |
| Corporate authority | `https://codestra.co` |

## Integration strategy

Codestra Social is a mature authenticated application. Horizon is therefore applied through supported application-owned layers rather than replacing the publishing product:

- root document metadata and theme attributes
- existing dark/light CSS variable system
- navigation rail and logo treatment
- page-title top bar with visible product and domain identity
- accessible focus, borders, surfaces and reduced motion
- compact shared corporate footer

The publishing calendar, composer, media, integrations, analytics, billing, organizations, provider controls, user context, authentication, telemetry and runtime safety gates remain in place.

## Safety

This branch does not:

- enable social publishing or any provider
- change the fail-closed runtime adapter or publishing kill switch
- change backend APIs, tenant scoping, billing, authentication or analytics
- change deployment, secrets, DNS or production runtime
- patch upstream Postiz behavior outside the owned presentation layer

## Validation

```bash
pnpm install --frozen-lockfile
pnpm build:frontend
pnpm test
pnpm validate:backend-policy
```

Run representative authenticated Playwright and accessibility checks for launches, integrations, analytics, settings, mobile navigation, dark mode and light mode before merge.
