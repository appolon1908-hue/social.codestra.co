# Repository Profile — `social.codestra.co`

## Identity

- **Repository:** `appolon1908-hue/social.codestra.co`
- **Category:** Product platform — social publishing
- **Visibility:** `public`
- **Default branch:** `main`
- **Authority:** Primary Postiz-based social publishing application authority
- **Status:** Active application repository with publishing, scheduling, approvals, adapters, analytics, and integration work.

## Purpose

Provides social media account connections, publishing, scheduling, approvals, content workflows, engagement synchronization, analytics, and operator experiences.

## Owns

- Existing social publishing application and its runtime adapters
- Post, schedule, approval, account, engagement, and analytics workflows
- Application UI, persistence, background jobs, and deployment source

## Does not own

- Codestra-wide SDK or provider-neutral social contract authority
- Cross-system privileged writes that bypass Middleware
- Duplicate marketing, identity, gateway, or communications control planes

## Key integrations

- Middleware and n8n
- Kong and Keycloak
- `SDK-repository`
- `Codestra-Marketing-`, `Codesrea-Social-`, and approved social providers

## Current priorities

1. Flatten fragile stacked PR chains into reviewable promotion paths
2. Require CI and branch protection on accepted branches
3. Pin runtime images and complete provider adapters and contracts
4. Prove account connection, publishing, scheduling, webhook, staging, and rollback behavior

## Governance and safety

- Promotion model: `feature/docs/fix/security/upgrade -> development -> test -> staging -> production -> main`.
- Use pull requests and exact-head/merge-result validation; merge never authorizes provider publishing.
- Never commit social-provider tokens, account credentials, customer content, private keys, or production database dumps.
- Provider effects require capability gates, idempotency, audit, read-back, and separate activation approval.
- This document does not connect accounts, publish posts, activate schedules, call providers, or deploy the application.

## Account-wide catalog

See `appolon1908-hue/documentaions/REPOSITORY_CATALOG.md`.
