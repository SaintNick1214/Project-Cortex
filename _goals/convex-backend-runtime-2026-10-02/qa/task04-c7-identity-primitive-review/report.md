# Judgment: INITIAL C7 exact identity primitive and recorded controls

## Verdict: NEEDS FIXES

Bounded independent initial-version source review only. The isolated string schema, native capture and comparator have no correctness defect identified in this inspection. The initial held-row consumers permit missing/falsy baseline identity, which defeats mandatory immutable baseline comparison. Initial recorded controls have meaningful outcome assertions, but do not test that bypass or several parser/schema cases required by the handoff. This is no whole Task04, launcher or current-candidate verdict.

## Evidence Review

Read repository AGENTS.md, .agents/CODEX-RUNTIME.md, .agents/PROJECT-PROFILE.md and pessimistic-judge role, original Task04, frozen C6 restored-review report and frozen C7 source aid. User numerical cycle waiver changes no criterion.

Reviewed source derives exclusively from INITIAL controls-PRE.sourceTools before-byte gzip backings. Eleven small source/control files were independently copied, including actual `fs-identity.cjs` (decoded SHA256 `2b44d0d8691264b39f0be074a9eef274cddc6d71df7970f2772704a29eb068de`, 4830 bytes, gzip43 SHA256 `466bce4467f872899173bff00c4f6247aa749ef7d613b357f52b642552ad0334`, 1958 bytes) and `fs_identity.py` (decoded SHA256 `7021d16bfe5d92f65d26830ed8abcb743332073f954826a1961870990e52381a`, 367 bytes). Every selected gzip was held through O_NOFOLLOW, all nine lstat/fstat/POST fields compared exactly, full encoded byte count/SHA verified, and decompressed through full gzip EOF with no unused/unconsumed input. Complete decoded count/SHA matched PRE. Each selected recorded sourceToolPOST matched its recorded PRE identity/count/SHA. Current backing identities establish this inspection's custody, not initial historical backing custody.

`work/resume/task04-c7-identity-primitive-review/verify-review.py` repeated held verification of selected gzip references and owned decoded copies, and separately held/verified initial PRE, receipt and both raw files against ROOT inspection's exact current nine-field identities/counts/SHA. `capture-verification.json` and `review-evidence.json` retain full individual details. No evolving candidate source was read or imported. No candidate/control body, VM body, original command, service, compiler or fresh microcontrol was dispatched by this reviewer.

Initial stdout records 20 PASS rows, exit0, timeout=false, elapsed0.233551864s under90s. They remain RECORDED outcomes, not this reviewer's executions. ROOT's full131-pair inspection is context; this reviewer independently verified only the eleven selected before-byte backings. Recorded groupEmpty is Boolean only; no initial PID/startTime/PGID/argv binding or census is established here.

### Primitive source findings

All references below name owned authenticated copies, retaining original captured line numbering.

- `fs-identity.cjs:6–11`: exact own keysets at wrapper/fields layers; data-only enumerable descriptors; plain or null prototype only; no array/null acceptance; all nine required fields. Numeric safe/unsafe values are rejected by the canonical string validator. Canonical decimals reject leading zeros, plus, whitespace, fractions, exponent notation and negative zero. Negative mtime_ns/ctime_ns are allowed, other fields are nonnegative. Capture requires native BigInt fields, directly mtimeNs/ctimeNs rather than floating milliseconds. `same` validates both operands and compares every field without coercion or partial iteration.
- `fs-identity.cjs:19–31`: complete JSON tokenization retains integer lexemes, requires complete input consumption, and checks decoded-key duplicates before defining own properties. This rejects Unicode escaped-key collisions. Object.defineProperty protects `__proto__` and `constructor` keys from assignment-driven prototype mutation in the parsed value. Unknown identity keys still fail exact keyset validation. Ordinary non-authority numeric values use Number(token), matching JSON.parse numeric value semantics; duplicate ordinary keys are deliberately rejected by this parser. Recursive traversal reaches nested/array `identity` properties and directly tagged schema objects. Valid identity wrappers contain only schema/fields, so skipping further traversal within a validated wrapper introduces no hidden nested authority.
- Explicit `legacyExact:true` only reconstructs canonical decimal integer source tokens with all nine required keys; it does not convert already parsed Numbers. It cannot determine whether an earlier producer had already rounded before serialization. Therefore it cannot be an authority upgrade for old precision-limited captures. Inspected production readers (`package-aliases`, `command-registry`, `composition-engine`) use strict default parsing. Initial controls use legacyExact to test token mechanics only; that control does not qualify a production legacy-authority migration.
- `preimage-store.mjs:11`: held path/fd PRE/POST samples use BigInt stats and full all-nine equality, fresh byte reads, SHA downstream, and retained primary/close-secondary handling. `input-ledger.mjs:11` verifies current captured exact identity against consumed-event identity. `bridge-preload.cjs` and `route-policy.mjs` use full current fd/path equality, with dev/ino-only stable-object pins where a writable object can legitimately change metadata. That explicit stable-object predicate is not a full immutable baseline comparator.
- Bridge outward stat methods forward caller arguments to native originals; FileHandle.stat similarly forwards options. Initial controls assert prototype/flavor and Number/bigint ino, sync time value, promises/callback Number ino, FileHandle read result, restoration and one conditional invalid-option error name/code comparison. They do not exhaust every outward stat/option/error family.

## Issues Found

### Critical (must fix for strict immutable authority)

`preimage-store.mjs:14,15,18` accepts absent, null or false expected identity through truthy guards: `row.identity && !identity.same(...)` and `r.identity && !identity.same(...)`. With correct path/bytes/SHA and identity omitted, captureRows supplies a fresh identity and verifyRows accepts hash-only. This establishes a current capture but never compares the mandatory initial immutable filesystem identity. A matching byte hash cannot distinguish objects. A caller can therefore evade the strict missing-schema criterion by removing the whole identity property, despite field-level deletion being rejected by the isolated validator.

Production projections can pass that condition through: captured `command-registry.mjs:21` maps `destinationIdentity` into `identity`; `composition-engine.mjs:17` maps both destination/source identities into physical closure rows. The parser traverses present tagged objects but does not require those authority properties to exist. Missing projected identity is consequently not rejected at that held-row boundary. This is a source-proven initial-version gap, not a claim that a particular original command or current candidate exercised it.

Require validated identity on immutable authority rows before comparing or capturing. Where a genuine fresh acquisition intentionally has no expected baseline, use an explicit separate acquisition contract/classification so it cannot masquerade as an immutable comparison. Retain legitimate fresh snapshots, mutable-version semantics and all native/byte/backing/fence requirements.

### Important (should fix before broader acceptance)

Initial `controls.mjs:15` tests missing individual fields against id.validate, while its nine actual captureRows/verifyRows mismatch arms retain the whole identity. Extend actual-consumer adverse tests to omitted/null/false identity, malformed wrapper/schema/fields, and missing projected source/destination authority. Demonstrate strict denial before successful authority-bearing capture, with authentic raw evidence.

Parser/schema controls do not assert prototype/accessor/symbol-key rejection; __proto__/constructor safety; Unicode escaped duplicate collisions; nested and array identity authorities; or ordinary non-authority JSON value equivalence at caller boundaries. Static source supports most of these properties, but no recorded outcome should be invented. The stream-equivalence arm compares a single identity object, not general ordinary payload values. One of the20 PASS rows is syntax compilation rather than semantic execution. Keep the20 raw labels exact and scope their coverage honestly.

### Minor (consider fixing)

No additional isolated primitive source defect found. The tokenizer's global duplicate rejection is stricter than ordinary JSON.parse; preserve deliberate authority-reader use and keep unrelated product/VM/build JSON at its intended ordinary JSON boundary. No generalized replacement or whole-reader audit was performed here.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment | 2/5 | Mandatory immutable baseline identity can be omitted; focused review only. |
| Primitive code quality | 4/5 | Exact native capture/schema/full comparison and token handling; caller omission gap remains. |
| Test quality | 3/5 | Meaningful actual consumers/outward results, but missing consumer/schema/parser edge assertions. |
| Pattern adherence | 4/5 | Authenticated initial captures, disjoint owned review, no subject execution or retroactive custody claim. |
| Scoped completeness | 3/5 | Static initial primitive/selected wiring and recorded controls inspected; no fresh execution or full-source migration qualification. |

**Average:3.2/5**, a bounded review score, not Task04 acceptance.

## Recommendation

Repair mandatory identity at immutable consumer boundaries and add meaningful actual-consumer/parser edge controls. Independently review the complete candidate after ROOT freezes it. This review does not certify evolving current source, all501 sites, new producer bindings, original122, faithful whole120, compiler/private/native/default/paid behavior, gate approval or Task04 product criteria. C6 whole failure and irreparable historical custody limits remain intact. Own literal self seals authenticate only new reviewer files, excluding solely each own selfseal.json.
