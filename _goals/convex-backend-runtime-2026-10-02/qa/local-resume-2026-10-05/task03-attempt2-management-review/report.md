# Task Judgment: Task03 attempt2 disposable target management

## Verdict: PASS

Scope is **TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY**. This independent review does not certify preparation, native foundation, full Task03, or the goal. The reviewer wrote no enabling attestation and made no live requests or private/helper mutations.

## Evidence review and custody

The exact helper is SHA256 `213739458a90078a164cb4b87a583364109d43c2e2ee6687b8a2c97a0600a457`. Its parsed-request digest, using Node `SHA256(JSON.stringify(parsedRequest))`, is `e085a6822de67476645f04d89f5ca6b8951ab845ae1b0663382abfbef95a13c2`. The imported actual guard is `754be31a4eedddc1bcdb07061ba51de54754f5a1dc357677362374bc082c9d65`. Source hashes remained identical after execution.

The helper is byte-equivalent to accepted cycle3 source `31b06108a5e3dc55693b9963d6c662032c3b3ecfea6cc06cdf790a9168101fe4` after exactly four substitutions: new guard namespace, management review filename, provision receipt filename, and retirement receipt filename. No validation, error, ownership, deadline, call-limit, or assertion was removed.

The request binds operation `511363b3-8cec-4e98-95d8-ecd4865457a8`, project `cortex-foundation-delta-cd358019d808`, and the new owned private namespace. The candidate has 774 files and frozen-manifest SHA256 `7d633bd5e2e6588b9650c6a8b717e4f9eaab9528b6e988ccd3d3746a6b65db7c`. These observations identify the review inputs; they are not an independent preparation verdict.

Prior cycle1/2 failures and cycle3 PASS were read with their raw controls and reports. Cycle1's two unsafe-outcome reproduction labels and cycle2's three native Header reflection reproduction labels remain failures of those helpers despite raw case labels saying PASS. Their evidence was not edited. The first native attempt's public custody records retain CLI exit1, zero native cases, private generated/incidental custody, retired selector invalidation, and physical retirement POST200/GET404. This review does not relabel that attempt as successful.

## Requirements review

| Bounded requirement | Result and evidence |
|---|---|
| Independent exact-source/request review before effects | PASS. Helper lines44-48; five original invalid-review and fifteen invalid-request controls reject before network/file effects. New controls reject old enabling filename, source digest, and request digest. |
| Trusted team325340/nicholasgeil/Cortex Memory and exact fresh nonpaid request | PASS. Lines35-42 and90-92; identity/target/budget/purpose mismatches reject. Concrete attempt1 private paths and ownership operation/request cannot satisfy attempt2. |
| Sole verified cloud/dev target | PASS. Lines73-81 and94-111; observed project/team/deployment-kind/type/sole-deployment mismatches deny key or environment completion. Actual new guard rejects all four recorded retired deployment selectors and a target timestamp one millisecond before the new identity. |
| Pre-effect selector, path, ownership, and exclusivity checks | PASS. Lines16-32,88-90,119-129; seven inherited selectors, symlink ancestry, mode, hardlink, ownership, target mismatch, and existing uncertain attempt deny before effects. |
| Account/config/key and transport diagnostic confidentiality | PASS. Lines10,54-69,99-106; malformed JSON, invalid token/key types, control characters, lengths and native Header failures are tested. Private fake message/cause/stack/log sentinels are withheld. Actual Node Headers and parseEnv execute locally. |
| Exact three-entry private environment roundtrip | PASS. Lines103-111; parser-loss cases deny, ordinary and exact8192-byte keys roundtrip into exactly the three intended values. |
| Exclusive fsynced uncertain-create journal and owned-project retention | PASS. Lines19-22 and93-98; unknown/aborted/body-failed POST retains the attempt without guessed ownership and prevents blind retry. Known ownership is fsynced before verification; partial key/target-save failures retain it. |
| Seven calls, 180-second operation deadline, 30-second per-call ceiling | PASS. Lines50-60; positive provision uses6 calls, retirement5. Deadline controls prevent the fourth call; eighth-call probe rejects before dispatch. All captured timeouts remain positive and <=30000. |
| Retirement remains possible after source/deploy/codegen failure | PASS. Lines118-139; preparation failure is injected for ownership-only and actual chained partial-failure retirement cases. Retire never invokes preparationReviewed. |
| Verified physical-delete ordering and honest retirement receipt | PASS in memory. Lines133-139; delete precedes GET404; GET200 cannot produce a success receipt. Exact target preimage is retained and active/retired/deleted state changes only after confirmation. |
| New receipt namespace | PASS. Added controls assert only the new provision/retirement filenames and exact new operation appear. Existing original receipt namespaces are not used by the helper. |
| Scope and original Task03 obligations conserved | PASS for this review scope. Original functional security, background lifecycle, real currentguard service, cleanup, independent foundation, and final Task03 acceptance remain mandatory. |

## Test coverage analysis

176/176 meaningful outcome controls PASS, with zero failing cases. The first162 are the prior cycle3 controls in the same order with the same names and assertions, rerun against the current actual guard and request. Fourteen added controls cover attempt2 namespace/old-attestation separation, concrete old private paths/ownership bindings, four retired selectors, the new identity timestamp boundary, and new output filenames.

The reused harness was adapted only for namespace/request bindings, the actual new public identity timestamp in the mock clock, and added guard exposure/tests. `harness-adaptation.json` records those differences. The mock clock is one hour after the actual public identity timestamp; a separate negative verifies the timestamp fence. Each case asserts descriptor closure. Native Node Headers validates every substituted fetch; actual guard.validateTarget and Node parseEnv execute. The helper source is evaluated without edits except an ephemeral export of `api` for the inherited direct call-limit probe.

All helper filesystem/config/fetch APIs are substituted in memory. PreparationReviewed is an injected pass/fail prerequisite; current sourcePreflight, real filesystem durability/races, API compatibility/availability, project creation/deletion and service/native behavior are not certified. No real private/config file was read. Authorized reviewer evidence persistence is the only actual filesystem mutation.

## Validation

Node `v24.15.0` and npm `12.2.0` verified using the explicit bundled toolchain PATH. VM controls exit0. Node syntax check exit0. Scoped ESLint10 recommended JS/Node/ESM rules exit0: one helper file, zero errors, fatal errors, warnings, suppressed messages, or rule disables. The explicit scoped lint configuration bypasses the repository's deliberate QA-tree exclusion without weakening rules.

Raw controls, harness, adaptation record, stdout/stderr, command receipts and exact input/artifact hashes are retained in this new reviewer-owned directory. Old records and source/private namespaces were not modified.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 5/5 | Every bounded management requirement above verified; original gates preserved. |
| Code Quality | 4/5 | Fail-closed validation, sanitized private failures, awaited bounded operations, exclusive fsynced ownership. |
| Test Quality | 5/5 | All162 prior outcome controls plus14 new boundary controls; actual native parser/Header and guard execution. |
| Pattern Adherence | 4/5 | Shared current guard, matching source/request independent review, private owned receipts and lifecycle conservation. |
| Completeness | 4/5 | Both management paths reachable and verified in memory; syntax/scoped lint pass; enabling attestation remains coordinator-owned. |

Average: **4.4/5**. Every dimension >=4 and Requirement Fulfillment=5.

## Issues and recommendation

No blocking issue found in this bounded management helper. The coordinator may record a management-only release attestation for the exact helper/request above after receiving the separate preparation verdict. Any helper/request/guard change requires a matching fresh review. Native foundation remains incomplete until the reviewed preparation, verified disposable target, original service outcomes, cleanup/retirement evidence and independent foundation acceptance pass.
