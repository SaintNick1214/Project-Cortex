# Task 01 security followup completion report

Status: **COMPLETE — fresh independent review PASS4.2/5.**

The standalone fixture now pins ws8.21.0, resolving PR132 CI's HIGH
CVE-2026-48779 and MEDIUM CVE-2026-45736 reports. Before-audit records both
advisories on direct8.18.3; after-audit exits0 with zero vulnerabilities. Official
GitHub advisory JSONs confirm the CVE identities/ranges. All6 qualified core versions
remain unchanged. The only extra lock graph effect is deduplication of Convex's
already8.21.0 ws copy to the patched direct version; no broad update occurred.

| Requirement | Result | Evidence |
|---|---|---|
| Exact fixed direct ws and unchanged core pins | PASS | fixture/package.json/lock; evidence/pin-comparison.json, audit-before/after.json |
| npm12.2 / strict TypeScript | PASS | evidence/check-commands.json: npm12.2.0, typecheck exit0 |
| AI SDK7 text/tool/cancel transport and browser-safe bundle | PASS | evidence/transport.json; decoder exact text/input/result, detach vs explicit cancel, only transport.ts browser input |
| Product target cannot receive qualification spike | PASS | 21 no-network assertions; deploy/qualify/optional effect setup reject actual limitless-chameleon product receipt before action |
| Evidence aliases reject before external effects | PASS after essential judge correction | guard-fix/effect-ordering.json: 32 intercepted cases, directory aliases with missing suffixes, individual output symlinks/hardlinks, zero effects for every denied case and active interception positive controls |
| Optional private HTTP secret stays private | PASS after essential judge correction | Canonical scratch confinement; parent/file symlink escapes rejected; existing file requires owner/0600/unlinked regular file; wx creation and O_NOFOLLOW/fstat read; secure create/reuse with no overwrite tested privately |
| Explicit matching private deploy context | PASS | purpose/name/isolation/dev/URL checks, receipt-bound env path/key/selectors, ambient selector override; rejected mismatch cases |
| Archived receipts and source provenance preserved | PASS | 38 protected hashes unchanged, including original receipts; authorized erased-type import has byte-identical JS proof; generator/source histories retained; archive path/symlink aliases rejected |
| Separate verified live qualification target | PASS | parent qa/task01-security/target.json: project3133652, fiery-setter-784, purpose qualification-security, dev/cloud; parent deployment success08:54:47 UTC |
| Actual Gateway observer disconnect/reconnect on patched ws | PASS | fresh live check: two observers,1 attempt,1 tool effect,1 final receipt, same canonical assistant IDs |
| Synthetic persisted cursor/privacy and cancel on patched ws | PASS | fresh two checks: real managed components; saved cursor resumes, private marker absent, durable cancel/aborted stream/no second attempt |
| Honest scoped/current/historical evidence | PASS | fresh3-check matrix records ws8.21.0/current lock hash and timestamps; original10-check matrix unchanged and historical |
| Full qualification route remains reproducible | COMPLETE | optional explicit private effect-secret.mjs setup and full runner commands in contracts.md/checks.md; not executed by this scoped task |
| Private key check/write race removed | PASS | Exclusive wx/0600 creation; real isolated concurrent generation1 winner, rejected loser/repeat, matching public JWKS, no overwrite; ephemeral keys cleaned |
| Fixture lint source and parsing issue | PASS | Parent's standalone tsconfig mapping; unused Id type import removed; exact transpileModule JavaScript byte identity; current guard-fix fixture lint exit0 over23 files with0 errors/3 existing warnings |
| Scope and secret hygiene | PASS | source-inventory.json and evidence/hygiene.json; no root product/other-agent files, credentials/JWTs in QA, staging or commits |

Fresh live execution ran only after the parent deployed and explicitly authorized
the three selected checks. Start2026-10-03T08:55:46.358Z, finish08:56:04.750Z,
all3 outcomes PASS, exit0. The actual Gateway case exercises real model/tool work;
synthetic slow-model cases are labeled separately and use real managed Agent/Workflow
storage/subscriptions. No model retry or direct-provider fallback was introduced.

Modified fixture paths are package.json, package-lock.json, scripts and one unused
type-only Gateway import, authorized by the parent after the lint finding:
explicit target/evidence path guards, deploy/client/qualify/check runners, typed helper
declaration,21 target-safety assertions, race-safe key generation/concurrency test and
optional private full-effect setup. The only backend source edit removes an unused
erased type import; before/after emitted JavaScript is byte-identical.
source-inventory.json lists exact paths and before/current hashes. Generated bindings,
browser transport implementation, contracts/report and receipts are unchanged. Old
generator/Gateway source is retained in history; backend runtime bytes are unchanged.
New evidence/prose is under qa/task01-security/ only. Private scratch
is confined to work/backend-runtime/task01-security/; the existing signing key/JWKS
remains in its original private/public locations.

The open fresh judge found an essential defect in the initial runner-safety guard:
canonical archive checks ran only when an evidence path was requested after deploy,
paid action or secret setup, and individual output-file aliases were unchecked. The
optional secret setup also used lexical confinement and did not verify an existing
file's permissions. The current fix resolves existing ancestors during module load
(including missing suffixes), preflights every expected output before any effect,
rejects file symlink/hardlink aliases, and confines/checks private secrets canonically.
Before-fix scripts and the initial report/check/inventory snapshots are retained in
evidence/source-history/guard-before/. Initial safety claims are superseded by the
current 32-case intercepted outcome qualification in evidence/guard-fix/.

This correction made no live call, deployment, paid inference, backend or live-key
change. Both the original 10-check matrix and the separate three-check live receipts
are byte-preserved. Current offline strict types, AI SDK7 transport/browser bundle,
21 target guards, concurrent key generation and byte-equivalence checks were rerun
into evidence/guard-fix/; current fixture lint passes. The new guard tests intercept
subprocesses, actual Convex client actions and outbound fallbacks, prove interception
with positive controls, and remove all temporary private test secrets. The previously
observed three live results retain their original timestamps and source provenance;
they are not represented as fresh live execution of the guard-only correction.

The original qualification target was retired. Generic work/backend-runtime/target.json
still names product integration and is never a live fixture fallback. The new target
and generated fixture records were retired after fresh review PASS; management DELETE
returned200 and project GET returned404. See target-retirement.json.
The scoped deployment intentionally omitted its private HTTP peer secret.
Full interrupted-effect replay requires the separately documented explicit private
setup; the three affected checks do not certify unexecuted current-source structured,
native, transaction or HTTP-effect checks. Those original observed outcomes retain
their own historical provenance. Native interactive browser evidence remains absent
and unclaimed. No unresolved technical conflict remains for this followup.

After the final followup review, CI confirmed dependency and lint fixes. Its high
CodeQL finding moved to the preserved historical keys-before.mjs snapshot. The
coordinator renamed only that inert snapshot to keys-before.mjs.text, retaining
byte-identical contents. Earlier path/hash receipts remain historical; the explicit
old/new mapping is in ../ci-followups/archive-source-rename.json. No active fixture
source or scanner suppression changed. The outbound-file-data annotation remains
unresolved as a scanner result and is not reported clean.
