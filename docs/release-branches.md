# Branch contents and release promotion

`dev` retains the complete development history, implementation plans, raw evidence,
research and orchestration instructions. `main` carries the product source, backend,
packages, application templates/demos, tests, build and CI configuration, manifests,
licenses and user-facing documentation.

The following root paths are omitted from the current `main` tree on every promotion:

- `_goals/`
- `_research/`
- `work/`
- `.agents/`
- `AGENTS.md`

The development-only workflow `.github/workflows/task04-c8-native-infrastructure.yml`
is also omitted because its inputs live under `work/`.

Promotions use a normal two-parent merge commit: the previous `main` head is the first
parent and the promoted `dev` head is the second. The resulting tree uses the `dev`
product contents with the paths above excluded and these release-specific documentation
links and ignore entries retained. This records the integration without squashing,
rewriting `dev`, deleting its records, or force-pushing `main`.

A plain unfiltered merge can reintroduce development-only paths. Apply this exclusion
policy on every promotion; `.gitignore` alone does not exclude tracked merge inputs.
Links to development instructions and evidence point to their retained `dev` locations.
Development records remain public in this public repository and reachable through Git
history. This policy filters the current release tree; it does not purge Git objects.

The repository owner explicitly waived new validation for the 2026-11-01 promotion.
Its merge message skips push/PR Actions for that promotion. That exception does not
assert that skipped checks passed and does not change future validation requirements.
No package publication or production deployment is part of this promotion.
