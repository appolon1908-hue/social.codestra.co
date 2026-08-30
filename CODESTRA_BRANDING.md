# Codestra Social branding overlay

The initial source snapshot was derived from upstream Postiz `v2.22.1` at
commit `c90b6c625bc0ec470d6dcdb57c63608aaa9b7b74`. The import was published as a
snapshot and does not contain the complete upstream commit graph. It preserves
the upstream AGPL-3.0 license, package names, database schema, migrations,
environment-variable compatibility, and technical identifiers. The recorded
revision supports tree comparison and auditable future upgrades.

Customer-facing modifications identify the deployed product as **Codestra Social**, operated by **Codestra LLC**. They do not claim that Codestra LLC created the upstream software. The in-application `/legal/open-source` page acknowledges upstream and links to the applicable license and source history.

## Logo status

The production website contains only raster logo files. No authoritative Codestra SVG or sufficiently large transparent wordmark was found. The SVG wordmark and letter mark in this branch are explicitly temporary text-based assets. Replace them only after an approved authoritative SVG or high-resolution transparent PNG is supplied.

## Public configuration

The intended public values are:

```text
PUBLIC_PRODUCT_NAME=Codestra Social
PUBLIC_COMPANY_NAME=Codestra LLC
PUBLIC_COMPANY_URL=https://codestra.co
PUBLIC_APP_URL=https://social.codestra.co
PUBLIC_SUPPORT_EMAIL=
PUBLIC_PRIVACY_EMAIL=
PUBLIC_TERMS_URL=
PUBLIC_PRIVACY_URL=
```

Legal address, jurisdiction, support/privacy email addresses, Terms URL, and Privacy URL remain intentionally unset until approved. Outbound email must remain disabled until SMTP, sender-domain SPF/DKIM/DMARC, and controlled delivery tests pass.

## Branding audit classification

- `CUSTOMER_FACING_REPLACE`: frontend pages/components, metadata, manifest, navigation, auth, customer errors, and email subjects/body text were changed to Codestra Social.
- `LEGAL_PRESERVE`: `LICENSE`, the recorded upstream revision, package metadata,
  and `/legal/open-source` preserve Postiz/upstream acknowledgment.
- `TECHNICAL_PRESERVE`: package scopes, database/schema identifiers, migrations, Docker volumes, Temporal names, environment variables, and API fields remain unchanged.
- `TEST_UPDATE`: authentication and metadata tests must assert Codestra-facing labels.
- `DOCUMENTATION_REVIEW`: upstream developer documentation remains upstream documentation and is not rewritten as Codestra authorship.

## Sustainable upstream upgrades

1. Fetch the next stable upstream tag and read release/migration notes.
2. Create and validate encrypted database/media/configuration backups.
3. Merge or rebase the Codestra branding branch onto the pinned tag.
4. Resolve branding conflicts without renaming technical identifiers.
5. Run the classified customer-facing branding audit.
6. Build an immutable candidate image and record its digest.
7. Restore the production backup into an isolated test environment.
8. Validate migrations, login, workspaces, OAuth records, scheduled posts, media, Temporal workers, accessibility, responsive layouts, metadata, and legal acknowledgments.
9. Deploy through a controlled rollout while retaining the previous image and backup.
10. Roll back immediately on failed health, login, migration, or preservation checks.
