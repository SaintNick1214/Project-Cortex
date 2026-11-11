# Branch contents and release promotion

`dev` retains development history, implementation plans, raw evidence, research and
orchestration instructions. `main` carries product source, backend, packages,
application templates/demos, tests, build and CI configuration, manifests, licenses
and user-facing documentation.

## Enforced contents

`.main-release-policy.json` is the shared versioned policy for the release preparation
command and the GitHub CI guard. These root entries stay on `dev` and are excluded
from the current `main` tree:

- `_goals/`
- `_research/`
- `work/`
- `.agents/`
- `AGENTS.md`

The development-only workflow `.github/workflows/task04-c8-native-infrastructure.yml`
is excluded because its inputs live under `work/`. Similarly named files inside
packages remain allowed; the root exclusion does not remove shipped template files.

Every main-target PR and main push checks the complete committed candidate tree,
including entries unchanged by that PR and entries outside a sparse checkout.
A forbidden path or an invalid/missing policy fails the required functional gate.
A plain unfiltered merge can reintroduce development-only paths; `.gitignore` alone
does not implement branch-specific merge exclusions.

## Prepare an ordinary release PR

Use Node >=24.15.0 and npm 12.2.0. Preparation uses Git and Node built-ins; it does not
install packages, run validation, publish, push a branch, open a PR or merge main.
Use an isolated worktree to keep normal development work untouched. Replace `origin`
with the GitHub remote name when the checkout uses a different name.

```bash
git fetch origin main dev
git worktree add --detach ../cortex-main-release origin/main
cd ../cortex-main-release
npm run release:prepare -- --main origin/main --dev origin/dev --branch release/main-YYYY-MM-DD
git push origin release/main-YYYY-MM-DD
gh pr create --repo SaintNick1214/Project-Cortex --base main --head release/main-YYYY-MM-DD
```

The command pins the exact main/dev commits, uses the normal three-way merge result,
filters the policy exclusions, and creates a new local release branch with a normal
two-parent commit: main first, dev second. Permitted product changes from both sides
are retained. Product conflicts require resolution before a release branch can be
created. An existing destination or moved source ref is refused. Preparation leaves
main, dev, existing worktrees and indexes untouched and never force-updates a ref.

Review the resulting PR through the regular GitHub workflow. Required reviews,
`All Checks Passed`, `Security Checks Summary`, scanner results and branch protections
remain active. GitHub creates the merge commit after those requirements are met.
The main push then receives its own normal full CI/security run and the existing
Publishing gate evaluates that exact main SHA.

An explicit waiver of local tests/builds/lint does not waive GitHub validation.
Do not add CI-skip markers or use administrator bypass to deliver a release. The
2026-11-01 skip-CI promotion was an incorrect interpretation of a local-only waiver;
it is not the release procedure.

## History and delivery

This is not a squash or history rewrite. Development records remain public on `dev`
and reachable through the normal merge ancestry. Filtering protects the current
main tree; it does not purge historical Git objects or make development records private.
Links to retained development instructions and evidence use their `dev` locations.

The existing publication pipeline compares package paths with registry `gitHead`
metadata as well as the checked commit's delivery artifact. An earlier skipped
promotion therefore does not silently erase pending package changes. Publication
still requires all exact-main prerequisites and verified registry visibility. A
failed, pending or skipped publishing outcome is not a completed release.
