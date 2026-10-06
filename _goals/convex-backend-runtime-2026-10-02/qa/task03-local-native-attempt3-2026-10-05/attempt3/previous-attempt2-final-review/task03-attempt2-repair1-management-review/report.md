# Task Judgment: Task03 attempt2 repair1 disposable target management

## Verdict: PASS

Scope is **TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY**. This fresh independent review certifies the bounded management helper against the current guard. It does not certify preparation, native foundation, all of Task03, or goal completion. No enabling attestation was written.

## Evidence and exact bindings

- Management helper SHA256: `213739458a90078a164cb4b87a583364109d43c2e2ee6687b8a2c97a0600a457`.
- Parsed request SHA256, computed by Node SHA256(JSON.stringify(parsedRequest)): `e085a6822de67476645f04d89f5ca6b8951ab845ae1b0663382abfbef95a13c2`.
- Current guard SHA256: `8c99c99ff562d7c8cdc23a8870dd0461774b2aeeae92b1fc789e4dc8a1dcc9b5`.
- Current repair freeze SHA256: `cd5e0c71e1839f079906becb9c5e0a90aba2261890ec4fb7997bc2981db966f5`; 833 listed files. This is a custody binding, not a preparation verdict.
- Fixed request operation: `511363b3-8cec-4e98-95d8-ecd4865457a8`; fixed project name/slug: `cortex-foundation-delta-cd358019d808`.

The prior management PASS binds guard `754be31a4eedddc1bcdb07061ba51de54754f5a1dc357677362374bc082c9d65` and cannot release the current guard. This reviewer read the helper, request, current guard, original Task03, project/runtime rules, and the complete inherited 162+14 harness. The harness was copied byte-for-byte, SHA256 `3e4c5a35bb41cf0f898a3126ffef9c34dd155d1447a428675426324f991c97c1`, and freshly executed against the current source. Inversely replacing the current freeze filename with candidate-freeze-attempt2.json produces the exact prior guard hash. The only guard source delta is its three freeze references (guard lines20,37,50). Reviewed source hashes were checked again and public source preimages retained.

## Requirements review

| Bounded management requirement | Result and evidence |
|---|---|
| Independent exact-source/request approval before effects | PASS. Helper lines44-48 verify independent management-only PASS, exact helper digest and exact parsed request digest. Invalid review fields and old enabling filename/source/request controls reject before network/open/write/rename. |
| Team325340, nicholasgeil, Cortex Memory; exact fixed request; dev/cloud and zero paid calls | PASS. Helper lines35-42 and90-92. All fifteen invalid request field controls fail before effects; exact operation/slug/digest are retained above. Old attempt1 paths and ownership bindings cannot satisfy attempt2. The independent attestation digest supplies the exact request binding in addition to shape checks. |
| Sole verified disposable cloud development deployment | PASS. Helper lines73-81,94-111. Project team, deployment kind/type and multiple-deployment controls reject before environment completion. Actual current validateTarget rejects all four recorded retired selectors and a target created one millisecond before fresh identity. |
| Private path ownership, modes, symlink/hardlink and exclusive output gates | PASS. Helper lines16-32,88-90,119-129. Scratch mode/ancestor alias, owned-record hardlink, ownership/target mismatch and existing uncertain attempt reject before relevant effects. Every VM case checks descriptor closure. |
| Private-safe JSON, token/key control characters, native Headers and error paths | PASS. Helper lines10,54-69,99-106. Malformed account/key JSON, nonstring/empty values, codepoints0-32/127/2028/2029, overlength values, native Header Latin1 failures and transport/body exceptions produce fixed private-safe diagnostics. Error messages, causes, stacks and console output do not reflect fake secret sentinels. |
| Exactly three intended environment entries with actual parseEnv roundtrip | PASS. Helper lines103-111. Ordinary and exact8192-byte key positives assert only CONVEX_DEPLOY_KEY, CONVEX_DEPLOYMENT and CONVEX_URL with exact values. Control injection is denied; parser-loss values either fail before environment write or preserve exact value according to native parser output. |
| Fsynced uncertain-create journal, no guessed ownership or blind POST retry | PASS. Helper lines19-22,93-98. Unknown/aborted/body-failed POST keeps the exclusive fsynced journal without created ownership; retry rejects before dispatch. Known ownership is durable before verification. Key and target-save partial failures retain ownership. |
| Seven-call ceiling, 180-second deadline, 30-second per-call ceiling | PASS. Helper lines50-60. Provision positive uses6 calls; retirement positive uses5. Deadline control prevents the fourth dispatch; direct API probe rejects the eighth before dispatch. All captured timeout values are positive and <=30000. |
| Retirement independent of source/deploy/codegen preparation failure | PASS. Helper lines118-139 never invoke preparationReviewed. Ownership-only and chained key/body/transport/target-save failure cases still retire with injected source-preflight failure. |
| Physical delete followed by GET404; honest state/receipt ordering | PASS in memory. Helper lines133-139. Delete precedes GET404; GET200 cannot create a success receipt. Exact target preimage and hash are retained; active/retired/deleted state changes follow confirmed absence. |
| Attempt2 receipt namespace | PASS. New provision/retirement namespace controls assert the new filenames and exact operation; old output filenames are absent. |
| Separate preparation and original Task03 obligations remain required | PASS for scope conservation. Management does not certify sourcePreflight, candidate freeze validity, service/native authorization negatives, all public paths, background revocation/deletion, scoped subscriptions/private bytes/callbacks, graph later-write closure, cleanup or final Task03 acceptance. Original Task03 remains in progress. |

## Test coverage

**176/176 cases PASS, zero failed cases.** All162 inherited controls and14 attempt2 controls retain the same names, order and outcome assertions. Fresh raw output is equal to prior raw output apart from the changed current guard hash. The suite exercised 486 native Node Headers constructions, actual node:util parseEnv and the current guard validateTarget. Both provisioning and retirement execute the actual helper source with in-memory filesystem/config/fetch substitutes. The only source addition inside the VM is an ephemeral api export for the inherited call-ceiling probe; real source was not edited.

| Function/path | Meaningful outcome coverage |
|---|---|
| parseJson/request/reviewedHelper | Malformed JSON; invalid request/review fields; old namespace and exact bindings; no effects on rejection. |
| ownedPrivate/absent/save | Mode/alias/hardlink/ownership/exclusivity denial; descriptor closure; journal and ownership fsync ordering. |
| api/verify | Native Header validation; deadlines/call limit; private-safe failures; response/metadata mismatch; exact dispatch counts. |
| provision/validateTarget | Verified owned dev/cloud target; exact environment parser output; retired selector and timestamp denial; partial ownership retained. |
| retire | Ownership-only and partial-failure cleanup; no preparation preflight; delete/GET404 order; no false receipt on GET200; target preimage/state changes. |

PreparationReviewed is only an injected pass/fail prerequisite. Actual sourcePreflight and preparation approval remain the separately assigned review's responsibility. This suite does not certify live API compatibility/availability, real filesystem durability or races, service project creation/deletion, actual native foundation cases or real currentguard service outcomes.

## Validation and custody

Node v24.15.0 and npm12.2.0 were verified with the supplied toolchain PATH. Fresh VM execution exit0; helper and guard syntax checks exit0. Scoped ESLint10 recommended JavaScript/Node/ESM rules pass for both source files: two files, zero errors/fatals/warnings/suppressed messages, no rule disables. The scope explicitly bypasses the QA-tree exclusion for analysis without changing rules or source.

An initial metadata comparison used the unverified historical filename candidate-freeze.json and exited1 after all176 VM cases had already passed. Correcting that metadata assumption to candidate-freeze-attempt2.json matched the prior guard digest. The failed comparison is retained; no assertions, tests, expected outcomes or candidate code changed.

Only this new reviewer-owned directory was written. No real fetch, private account/config/token/key read, helper/private mutation, Docker command, deploy or paid call occurred. Source preimages, all176 raw results, stderr, lint/syntax output, command receipts, adaptation record and artifact hashes are retained here. No prior review artifact was overwritten.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 5/5 | Every explicitly bounded management requirement above has fresh outcome evidence; broader gates conserved. |
| Code Quality | 4/5 | Fail-closed validation, sanitized private failures, awaited bounded requests and exclusive ownership journaling. |
| Test Quality | 5/5 | All176 conserved controls rerun against current source; actual native Header/parser/current validateTarget; meaningful failures and lifecycle outcomes. |
| Pattern Adherence | 4/5 | Shared current guard, exact independent source/request bindings, owned fixtures/receipts and lifecycle cleanup. |
| Completeness | 4/5 | Both management paths verified locally; helper+guard syntax/lint pass; runtime release prerequisites remain coordinator-owned. |

Average: **4.4/5**. All dimensions >=4 and Requirement Fulfillment=5.

## Issues and recommendation

No blocking defect found in the bounded management helper. The coordinator must inspect this fresh management PASS and the separately bound fresh preparation PASS before writing any enabling attestation. Changes to the helper/request/guard/freeze require matching fresh review. This management verdict supplies no live/native/full Task03 acceptance.
