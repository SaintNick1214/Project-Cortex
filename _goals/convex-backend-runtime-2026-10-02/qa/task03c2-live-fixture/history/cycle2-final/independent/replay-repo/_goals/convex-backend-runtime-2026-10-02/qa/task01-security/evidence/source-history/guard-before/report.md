# Task 01 security followup completion report

Status: **COMPLETE — fresh independent review pending.**

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
| Explicit matching private deploy context | PASS | purpose/name/isolation/dev/URL checks, receipt-bound env path/key/selectors, ambient selector override; rejected mismatch cases |
| Archived receipts and source provenance preserved | PASS | 38 protected hashes unchanged, including original receipts; authorized erased-type import has byte-identical JS proof; generator/source histories retained; archive path/symlink aliases rejected |
| Separate verified live qualification target | PASS | parent qa/task01-security/target.json: project3133652, fiery-setter-784, purpose qualification-security, dev/cloud; parent deployment success08:54:47 UTC |
| Actual Gateway observer disconnect/reconnect on patched ws | PASS | fresh live check: two observers,1 attempt,1 tool effect,1 final receipt, same canonical assistant IDs |
| Synthetic persisted cursor/privacy and cancel on patched ws | PASS | fresh two checks: real managed components; saved cursor resumes, private marker absent, durable cancel/aborted stream/no second attempt |
| Honest scoped/current/historical evidence | PASS | fresh3-check matrix records ws8.21.0/current lock hash and timestamps; original10-check matrix unchanged and historical |
| Full qualification route remains reproducible | COMPLETE | optional explicit private effect-secret.mjs setup and full runner commands in contracts.md/checks.md; not executed by this scoped task |
| Private key check/write race removed | PASS | Exclusive wx/0600 creation; real isolated concurrent generation1 winner, rejected loser/repeat, matching public JWKS, no overwrite; ephemeral keys cleaned |
| Fixture lint source and parsing issue | PASS | Parent's standalone tsconfig mapping; unused Id type import removed; exact transpileModule JavaScript byte identity; fixture lint exit0 with0 errors/3 existing warnings |
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

The original qualification target was retired. Generic work/backend-runtime/target.json
still names product integration and is never a live fixture fallback. The new target
and generated fixture records are retained for fresh review; the parent retires them
after PASS. The scoped deployment intentionally omitted its private HTTP peer secret.
Full interrupted-effect replay requires the separately documented explicit private
setup; the three affected checks do not certify unexecuted current-source structured,
native, transaction or HTTP-effect checks. Those original observed outcomes retain
their own historical provenance. Native interactive browser evidence remains absent
and unclaimed. No unresolved technical conflict remains for this followup.
