# Cortex CI and package delivery

Use regular merge commits for every merge. Squash, rebase and automatic merging
are disabled; the former squash-based Auto-Merge workflow is retired. Main keeps
its review, security, deletion and force-push protections without the contradictory
linear-history requirement.

## Functional checks

`PR Checks` runs on main pushes, supported pull requests and explicit dispatch.
Every PR receives root lint, types, current controlled SDK unit discovery, packed
public contracts and pipeline regressions. Affected CLI/provider packages receive
their offline checks; package and template changes select their consumers too.
Git extraction retains both deleted and added paths when files move.

Drafts defer affected service coverage. Fork and bot PRs report that coverage as
unavailable; their passing offline checks do not certify managed or native services.
Marking a trusted PR ready runs the applicable service gate. Main pushes always
select the full gate. `All Checks Passed` requires every selected job to succeed;
missing, cancelled or unexpectedly skipped jobs fail it.

Controlled unit checks use fake transports and Gateway peers, including current
runtime, installation, policy and natural-close contracts. Both Gateway regression
catalogs run against the current capture and atomic attachment contract; earlier
fixture bytes and qualification failures remain preserved QA evidence. Managed jobs preserve complete
SDK, provider and CLI discovery, then select authenticated runtime integration and
the provider's remote AI SDK parser contract. Eight native proof files and real graph
contracts run separately. Discovery counts describe selected files, not executed
tests; inspect hosted results and inherited skips separately. Missing target,
identity or qualified model prerequisites fail service coverage explicitly.

## Permanent main contents

Main-target pull requests and main pushes enforce `.main-release-policy.json` against
the complete committed candidate tree before selecting coverage. Internal development
records remain on dev; unchanged forbidden files and paths outside sparse checkout
also fail. Use `npm run release:prepare` to create a filtered normal-merge release
branch, then open an ordinary main PR. See [branch contents and promotion](release-branches.md).
Local validation may be explicitly waived for an operation; GitHub checks, reviews,
main-push qualification and publishing prerequisites remain required. Never use a
CI-skip marker or administrator bypass as a substitute for that path.

## Shared deployments and candidate packages

Offline checks and isolated demo, graph and native containers run outside the
shared backend lock. The called managed workflow holds `cortex-shared-ci-backends`
through guarded preparation, all SDK shards, provider completion, CLI integration
and scoped cleanup. SDK unit shards stay serial, use `--runInBand`, and finish
before provider tests. Actual SDK runtime coverage executes once on shard one.
Selected Jest processes use natural shutdown; graph and runtime contracts have
bounded termination and a five-second escalation window.
Do not cancel an active shared lifecycle to accelerate another candidate.

Managed runs use GitHub's larger pending queue and refuse stale candidates before
shared preparation. Development keys must match two distinct allowlisted disposable
deployment URLs before writing auth configuration or deploying. Consumers receive
scoped verified-host JWTs and no deployment keys. Backend model policy is installed
from the pinned qualified manifest; consumers carry no application inference keys.
Both target retirements run independently after failures or cancellation, and their
observed success is required in the exact-candidate managed receipt.

A queue probe proves scheduling only: it carries no
backend/model secrets, performs no service mutation and cannot qualify delivery.

Demo jobs reuse SDK/provider archives and the built CLI composer from one exact
candidate artifact. Verify the manifest's source SHA, package identities and byte
hashes before installing. Ordinary/frozen demo installs and transitive provider-to-SDK
closure validation remain required. Runtime setup uses Node 24.21.0, npm 12.2.0
and a lockfile-based npm download cache, never a shared `node_modules` cache.

CLI command fixtures bind the selected supported positive Node binary's actual
version and digest and require Node >=24.15.0. The retained `MINIMUM` input and
`minimum` receipt field identify that positive runtime; a Node 24.21.0 CI receipt
does not claim an exact 24.15.0 floor run. Legacy Node 20 binaries retain their
official checksum and exact version checks. Workflow launches use `node --` so
the environment output flag reaches the fixture script without native preloading.

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
failures block the summary.

PR/manual Scorecard analysis must complete, produce valid native SARIF and upload
successfully. Source checks bind the normal PR checkout or current default-branch
manual dispatch before/after scanning and before upload; stale sources fail.
Upstream PR/manual support is experimental and fork repositories are unsupported.
Scores remain advisory. External Scorecard publication runs separately in
`Scorecard Publishing` on main pushes and its weekly schedule; `Security Scans`
does not certify that independent workflow's outcome.

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
