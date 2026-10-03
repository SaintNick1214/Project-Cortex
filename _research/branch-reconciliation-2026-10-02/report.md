# Main/dev reconciliation

**Date:** 2026-10-02 (America/Los_Angeles)
**User direction:** Bring dev up to or ahead of main before creating the router feature branch. Router work remains planning only.
**Existing PR:** [#130 — reverse PR](https://github.com/SaintNick1214/Project-Cortex/pull/130), main into dev; attached to this chat.
**Status:** COMPLETE. [PR #131](https://github.com/SaintNick1214/Project-Cortex/pull/131) merged with a merge commit; GitHub also marked [PR #130](https://github.com/SaintNick1214/Project-Cortex/pull/130) merged through the imported main ancestry. Remote dev is `3341d64ddc06f1de26ed525312ef2c1b89b16952`; main remains `8e9351c87c1968dd19f91a63548fb3c9cc6d296c`. Main is an ancestor of dev. Final PR Checks and Security Scans passed.
**Candidate checkout:** `/tmp/cortex-reconciliation-20261002`
**Review patch:** [Final five-file delta from main](reconciliation-vs-main.patch)
**Exact tree evidence:** [Candidate refs and state](candidate-evidence.json)

## Diagnosis

Fetched dev is `46013de5919a72ecdbf55d02486aaaa7994cb79f`; fetched main is `8e9351c87c1968dd19f91a63548fb3c9cc6d296c`. Raw divergence is 740/744 commits. After equivalent non-merge patches are matched, unique divergence is three dev commits and five main commits. Commit counts alone therefore exaggerate distinct development work.

The January main snapshots `9369ec91` and `8c679a24` have exactly the same Git tree, `daaf8349ce57b000d564110045e13f44ef34ad9a`, despite different commit IDs. The actual common ancestor is `91dd9a23` from October 2025. A normal merge from that old base emits 230 conflict messages, including add/add and renamed/deleted documentation paths.

The complete actual dev delta from the matching January snapshot spans 17 files, including dependency/lockfile/updater changes bundled in the agent-guidance commit. It was reviewed directly rather than inferred from commit titles.

## Resolved contents

Preserve current main, including all five unique changes: Python/pipeline archival; TypeScript modernization; canonical website documentation and test cleanup; SDK audit/delivery restoration; npm release propagation handling. The candidate differs from main only in:

| File | Preserved dev intent |
|---|---|
| `.gitignore` | Preserve `.agents/` ignore rule alongside main's documentation rule. |
| `AGENTS.md` | Retain agent guidance, updated to the actual main packages, Node/npm floor, archived Python, website docs, modern tooling and separate offline/deployment checks. |
| `tests/state-transitions.test.ts` | Preserve the 20-second wait and 300-ms polling interval. |
| `.github/workflows/security.yml` | Preserve immutable scanner pinning while retaining main's Trivy v0.36.0. Upstream annotated tag was independently verified to peel to `ed142fd0673e97e23eac54620cfb913e5ce36c25`. Verify the mandatory PR head and newly introduced commits while excluding existing main/dev history; explicit Bash pipefail makes revision errors fatal. |
| `.github/dependency-review-config.yml` | Narrow license metadata exception for archived `typing-extensions`, whose upstream metadata declares PSF-2.0. Global license checking and high-severity vulnerability enforcement remain enabled. |

Main's current publishing workflow already checks out `workflow_run.head_sha`, preserving the dev publishing fix. Its modern dependencies and updater intentionally supersede dev's older package revisions, pnpm setting and `.ncurc.json` holds. Those old constraints are not restored.

Commit `cd17208aadd2fd2b27d59189257e9c9e2cbed4ab` records the reviewed tree with dev and main as its two parents. Signed child `08af725225ab735e3e6beb4541a9a3b6bbc89d15` contains the two CI repairs. GitHub verifies both signatures. PR #131 merged as `3341d64ddc06f1de26ed525312ef2c1b89b16952`, preserving main's ancestry without rewriting either branch or altering release main. The merged dev tree exactly matches the tested PR head.

## Validation and limits

- PASS: final differences from main are exactly the five reviewed files; all other tracked files retain main's content and modes.
- PASS: no unresolved entries or unstaged tracked differences; staged whitespace check against main.
- PASS: security workflow YAML syntax, using Ruby Psych; exact upstream tag/commit verification.
- PASS: main's Python archive and documentation removal are preserved; publishing workflow and package/lockfile contents match main.
- Base evidence: main's exact-SHA [PR Checks](https://github.com/SaintNick1214/Project-Cortex/actions/runs/37085379926), [Security Scans](https://github.com/SaintNick1214/Project-Cortex/actions/runs/37085379928), and [Publishing](https://github.com/SaintNick1214/Project-Cortex/actions/runs/37085756477) completed successfully. These certify the main base.
- PASS: fresh [PR Checks](https://github.com/SaintNick1214/Project-Cortex/actions/runs/37105936000) and [Security Scans](https://github.com/SaintNick1214/Project-Cortex/actions/runs/37105935998) completed successfully on `08af725`. All 31 reported checks passed; the expected PR-only Scorecard job was skipped. SDK shards, provider, CLI, demos, lint/types, graph/package/browser contracts and security checks passed. No local application/service suites were run; CI owns its test-backend deployments. This is not a full independent core QA certification.
- The original checkout was not reset, stashed, switched or overwritten. Other local source work changed during the session; none was copied into this candidate. Router research/plans are also excluded from the merge.

Independent read-only review: PASS for the reconciliation after inspection of all 17 dev-delta files, the result and merge ancestry state. The CI repair also passed independent review after adding explicit Bash pipefail; a deliberately invalid revision now fails the step. Final candidate CI independently passed before merging.

## Authorized finalization

The workspace [repository AGENTS.md](../../AGENTS.md) says: “Do not commit, publish, deploy production, or message other chats unless requested.” The user explicitly approved committing/pushing the reconciliation branch and opening its PR, then authorized monitoring and merging #130/#131 with issue resolution. PR #130 has main as its head; resolving by pushing a dev merge to main would unnecessarily alter the release branch. A separate reconciliation PR keeps the update directed at dev.

Before router execution, use the reconciled dev baseline and qualify the plan against its manifests and canonical documentation paths. Preserve ongoing local work separately; do not automatically replay or discard it. No router implementation is authorized.

## October 3 monitoring and CI repairs

The user explicitly authorized monitoring and merging #130/#131 and resolving issues. The first reconciliation run passed all functional PR Checks (SDK shards, provider, CLI, package/browser contracts, graph contracts, four demo builds and lint/type checks). Security failures were:

- Dependency Review: no high-severity vulnerable additions; archived `typing-extensions` was flagged by historical license-text detection. [Upstream 4.15.0 metadata](https://github.com/python/typing_extensions/blob/4.15.0/pyproject.toml) declares PSF-2.0. A package-specific license exception retains global license and high-severity vulnerability enforcement. [Action configuration](https://github.com/actions/dependency-review-action#configuration-options).
- Commit signatures: 579 verified and 166 unverified imported historical commits were enumerated; the reconciliation head itself has GitHub-verified valid SSH signing. The repair always checks the PR head and every commit outside existing main/dev history, retaining failure for any selected unverified commit. Historical branch imports do not require re-signing/rewrite.

Local workflow/config YAML syntax, Bash syntax and actual revision selection passed. A new unsigned local fixture remained selected; even a head already on a trusted branch remained mandatory. Invalid revision enumeration fails nonzero with the explicit Bash shell. The repair passed independent review and was committed/pushed as `08af725`. Fresh CI qualified it before merging.

## Verified completion

- #131 merged at 2026-10-03 07:24:51 UTC as `3341d64ddc06f1de26ed525312ef2c1b89b16952` with parents old dev and tested repair head.
- #130 was marked merged at 07:24:53 UTC, through reconciliation commit `cd17208aadd2fd2b27d59189257e9c9e2cbed4ab`.
- After fetching, `git merge-base --is-ancestor origin/main origin/dev` passed. Main has zero commits absent from dev.
- Merged dev and tested head share tree `10f23177d3ba646d8520371cfd1df3cd93a10c5c`; their content diff is empty.
- The original checkout received a fetch only: its local branch and source edits were not switched, reset, stashed or fast-forwarded. Router planning documents remain local and separate; no router implementation or feature branch was created.
