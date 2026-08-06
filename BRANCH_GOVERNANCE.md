# Branch Governance

## Stable branch

`main` is the production integration branch. Feature and agent branches must target `main` through pull requests.

## Required controls

- Do not use agent-named branches as the long-term default branch.
- Require CI checks before merge.
- Block direct pushes to `main` once branch protection is enabled.
- Use short-lived branches named by purpose.
- Tag production releases and document rollback steps.

## Migration

A `main` branch has been created from the current `codex/authorized-lead-intake` head so no code is lost. The repository default branch must be switched to `main` in repository settings, then branch protection should be enabled.
