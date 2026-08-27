# Required GitHub protection

Repository administrators must configure these rules in GitHub. This document is
the desired state, not proof that the settings are active.

For `main`:

- require pull requests and at least two approvals;
- require CODEOWNERS review for owned paths;
- dismiss stale approvals and require approval of the latest push;
- require conversation resolution;
- require the `Validate, migrate, test, and build` status check;
- require branches to be current before merge;
- block force pushes, deletions, direct pushes, and administrator bypass;
- require signed commits if the organization supports enforceable signing;
- prefer squash merge so the reviewed SHA/release evidence is unambiguous.

For `social-v*` tags and the `artifact-release` environment:

- restrict tag creation to release maintainers;
- require protected-environment approval before GHCR publication;
- allow only the immutable image workflow;
- do not grant deployment credentials to pull-request workflows.

Staging and production are GitHub Environments plus immutable manifests, not
independent source branches. Existing `develop` and `staging` branches should be
retired after active work is reconciled into protected `main`; do not delete them
without a separate reviewed maintenance action.
