# Cortex CI and package delivery

Use regular merge commits for every merge. Squash, rebase and automatic merging
are disabled; the former squash-based Auto-Merge workflow is retired. Main keeps
its review, security, deletion and force-push protections without the contradictory
linear-history requirement.

## Functional checks

`PR Checks` runs on main pushes, supported pull requests and explicit dispatch.
Every PR receives root lint, types, an inspected offline SDK unit subset, packed
public contracts and pipeline regressions. Affected CLI/provider packages receive
their offline checks; package and template changes select their consumers too.
Git extraction retains both deleted and added paths when files move.

Drafts defer affected service coverage. Fork and bot PRs report that coverage as
unavailable; their passing offline checks do not certify managed or native services.
Marking a trusted PR ready runs the applicable service gate. Main pushes always
select the full gate. `All Checks Passed` requires every selected job to succeed;
missing, cancelled or unexpectedly skipped jobs fail it.

The full current gate retains 214 managed SDK test files, eight separate native
proof files and eleven paid stress cases. Discovery counts describe selected files,
not executed tests; inspect hosted results and inherited skips separately. Missing
inference credentials fail required managed coverage before tests can silently skip.

## Shared deployments and candidate packages

Offline checks and isolated demo, graph and native containers run outside the
shared backend lock. The called managed workflow holds `cortex-shared-ci-backends`
through preparation, all SDK shards, provider completion and CLI integration.
SDK shards stay serial, use `--runInBand`, and finish before provider tests.
Do not cancel an active shared lifecycle to accelerate another candidate.

Managed runs use GitHub's larger pending queue and refuse stale candidates before
destructive preparation. A queue probe proves scheduling only: it carries no
backend/model secrets, performs no service mutation and cannot qualify delivery.

Demo jobs reuse SDK/provider archives and the built CLI composer from one exact
candidate artifact. Verify the manifest's source SHA, package identities and byte
hashes before installing. Ordinary/frozen demo installs and transitive provider-to-SDK
closure validation remain required. Runtime setup uses Node 24.15.0, npm 12.2.0
and a lockfile-based npm download cache, never a shared `node_modules` cache.

Functional sparse checkouts omit captured `_goals` and `work` files. Their source
evidence is preserved. Security scanning retains its full Git history.

## Security outcomes

`Security Scans` requires actual CodeQL, Trivy, Gitleaks and Semgrep execution,
valid results and supported uploads. Dependency Review is required on PRs and
retains the reviewed vulnerability/license policy. Fork/bot PR scans use scoped
tokens and no vendor account secret. Only documented non-PR Dependabot upload
limitations are reported as unavailable uploaded coverage.

Scanner success does not mean zero findings. Gitleaks and Dependency Review apply
their blocking policies; uploaded CodeQL/Trivy/Semgrep alerts retain branch-rule
enforcement. Semgrep's authentic SARIF identity is `Semgrep OSS`. Explicitly
classified PartialParsing warnings are visible incomplete parser coverage;
scanner crashes, other errors, empty coverage, invalid output and required upload
failures block the summary. Scheduled/main Scorecard scores remain advisory.

## Delivery and recovery

A merge into **dev does not publish packages or deploy production**. Publishing
requires the exact current main SHA, successful latest main-push `PR Checks` and
`Security Scans`, successful uploaded CodeQL from the expected GitHub app, and
success for every applicable Snyk status. A manual merge does not satisfy a failed
security prerequisite. Scheduled scans do not independently qualify a release.

Read the Publishing job summary first. It distinguishes ineligible/superseded
sources, pending/failed prerequisites, no changes, partial delivery and completion.
The gate paginates relevant checks and reconciles late results within a bounded
window. If results arrive later, dispatch Publishing on main with its exact
40-character SHA and `mode: dry-plan`; repair any reported prerequisite before
requesting `mode: recover`. Both modes use the same security/source contract and
the qualified immutable `delivery-paths` artifact. Recovery has no security waiver.

Publication rechecks current main, latest prerequisites and the selected artifact
run immediately before effects. It preserves SDK → provider → templates → CLI
ordering and registry visibility checks. A partial publication is not a complete
release; recovery reuses accepted same-source versions instead of republishing them.

## Qualification evidence

Pipeline receipts and nonpublic captures live in the private Cortex Proofs checkout,
under `pipeline-audit-2026-10-09/`. Goal/task records distinguish source review from
hosted queue, upload, artifact and complete trusted-run qualification. Report elapsed
time, runner minutes and model/API spend separately; test discovery or a shorter
selected scope is not proof of an equivalent faster full gate.
