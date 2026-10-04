# Task completion report — bounded terminal capture implementation C1

Status: COMPLETE for the approved product-source/offline slice; fresh independent implementation judgment and actual native extension qualification remain pending. Whole Task04/full03/goal and Gateway composition remain incomplete. Accepted DESIGN C2 (4.4) and accepted retired native B C8 (4.2) are prerequisites, not certification of this new code. No commits, Git/service/network/credential/environment-file access, generated bindings, bootstrap, PURE, schema.ts, Gateway or old QA mutations occurred.

## Changes and frozen ownership

Only `convex-dev/runtimePolicySchema.ts`, `convex-dev/runtimeModelPolicy.ts` and appended `tests/unit/runtime/model-policy-admission.test.ts` changed. The schema adds exactly the approved optional `terminalEvidenceHash` and `resultAttachmentState:pending|attached|closed`; five tables and eleven indexes remain exact. Exactly two new exports register internal mutations: `captureTerminalEvidence` and `attachTerminalResult`. No public proxy/table/index/worker was introduced.

`accountKnown` is the shared original-window full-cost transition used by trusted capture and ordinary settle/recover/operator routes. Capture reads native stored attempt/operation/account ownership, immutable historical root, checkpoint and dispatch identity. It accepts strict bounded charge-only terminal evidence, stores no private/raw payload, accounts full known C once or uncertain R, and releases a genuine terminal slot once. Liability capture/refinement does not require current origin/admin/tombstone authority and grants no data privilege.

Captured initial canonical/hash and backend-derived evidenceId remain immutable. Complete supported unknown→known refinement pins initial version/dispatch/receipt/model/interface/outcome/proof and all previously known actualModel/usage fields; only absent compatible facts may be added. Final canonical/hash is persisted once. Initial and final exact duplicate retries return latest accounting without writes; canonical bytes are checked even under forced digest equality. Conflicting known150/151, unknown variants, known fact removal/replacement, unsupported historical monetary truth and invalid charge-only payloads cannot alter liability.

Every existing settlement route retains its original actor/retirement fence. Captured rows discard receipt privateResultCanonical, preserve capture/attachment markers, and use the same accounting helper. writeUnknown is a no-write acknowledgement on captured rows, including already-known liability. The required unknown-closed→grant renewal→ordinary settle known150 with private payload regression passes; admin/operator variants also pass without private hydration. Partial markers fail closed in context, replay and settlement paths. Legacy already-terminal known rows acknowledge only exact existing charge and preserve validated private result with zero writes. Legacy genuine unknown terminal rows acknowledge their exact observation without new marker/attachment privilege; differing capture receipts deny rather than treating an old terminal as a first dispatch transition.

Healthy first-known capture yields pending only under exact current original delivery eligibility. Attachment separately rechecks authority/reference/source/parents/policy/cancel/current qualification/request limits and result profile/byte bounds. It writes validated private result plus monotone output visibility and pending→attached, with no money/slot changes. Pending delivery lost to revocation/retirement/cancellation/current-policy narrowing/qualification expiry closes permanently; renewal cannot reopen it. Attached exact retries require current eligibility and exact bytes; conflicting payload denies and revoked eligibility reports withheld. Both healthy text and single matching1536-dimensional embedding result attachment pass. Capture/refinement never parses, returns or hydrates a private result.

## Outcome evidence

All122 tests pass in one suite, zero failed/skipped/pending/todo. This consists of the original76 unchanged tests and46 appended outcome regressions. `candidate-summary.json` verifies the exact50,546-byte original prefix, SHA256 `51a8a1072ec5d782fcd44fbcd03e1b7010f705568461a30896bbd9a234b39b23`; original64 accepted assertions remain inside that untouched prefix.

Coverage includes live-scope origin-revoked unknown100→known150/full overrun/original windows/zero repeated slot decrement; initial duplicates before/after refinement and exact final retries; route coexistence/privacy; added absent facts and changed/removed known facts; initial/final forced hash collisions; invalid/private/raw/no-checkpoint/wrong-dispatch receipts; source deletion/tenant retirement/space retirement/cancellation; permanent closure after renewal; legacy/private/partial markers; text and embedding attachment; historical root result byte ceiling and expiry; synthetic parent-fault rollback and serialized equal/conflicting candidates. Serialized fake-database candidate and JSON snapshot rollback outcomes are offline only, not actual native OCC/isolation/rollback claims. Provider dispatch count is owned by the later Gateway/native composition, not inferred from an unused mock.

Observed candidate commands, cwd `/workspace/Project-Cortex`, with `/workspace/Project-Cortex/work/resume/toolchain-bin` prepended to PATH:

- `node --experimental-vm-modules node_modules/jest/bin/jest.js --config work/resume/foundation-jest.config.mjs --runInBand --runTestsByPath tests/unit/runtime/model-policy-admission.test.ts --json --outputFile <packet>/tests-candidate.results.json`: exit0,122/122.
- Same scoped Jest argv with `--showConfig` and `--listTests`: exit0; exactly the intended suite discovered; empty setupFiles/setupFilesAfterEnv and default reporter; no dotenv/service setup.
- `node node_modules/typescript/bin/tsc --project tsconfig.lint.json --noEmit`: exit0.
- `node node_modules/eslint/bin/eslint.js convex-dev/runtimePolicySchema.ts convex-dev/runtimeModelPolicy.ts tests/unit/runtime/model-policy-admission.test.ts --report-unused-disable-directives`: exit0, no warnings/errors.
- Observed runtime Node24.19.0/npm12.2.0.

Each command has contemporary exact argv/cwd/UTC, raw stdout/stderr, source/config preimages and pre/post hashes. Final tests/typecheck/lint all have stable matching pre/post snapshots. The test runner supplies TypeScript diagnostics for the appended fixture; lint tsconfig separately checks affected production code. Required native/codegen/actual public/internal inventory/Gateway outcomes are NOT_RUN here and belong to the coordinator's later frozen extension gate.

## Immutable failure history

Earlier receipts remain unchanged: tests-c1 FAIL110/111 (Jest crossrealm structuredClone fixture snapshots failed PURE plain-object validation after the simulated rollback); tests-c2 FAIL117/118 (appended helper's default argument unintentionally created known rather than unknown evidence); tests-c3 PASS119/119; tests-final PASS121/121; tests-freeze FAIL121/122 (new embedding fixture omitted its mandatory profile/stable batch); tests-candidate PASS122/122 after those fixture repairs. No original assertion was edited or weakened. The corrected offline rollback helper uses JSON snapshots of synthetic DB rows and is explicitly labeled non-native. Earlier successful receipts whose pre/post source changed during ongoing edits are historical observations, not the final candidate certificate. All raw receipts and source/config snapshots are preserved.

## Requirements checklist and limits

- [x] Exactly two optional attempt fields/two internal mutations and no wider structural change.
- [x] Trusted checkpoint/root/original-window accounting, full C once, genuine-terminal uncertain slot release once.
- [x] Strict immutable initial facts/identity and once-only final refinement, with exact-byte collision defenses.
- [x] Origin-revoked live-scope refinement150 on reserve100 without data/retirement/admin privilege or reopening.
- [x] Coexistence, legacy/partial markers and only-new-attach captured private-result writes.
- [x] Current eligibility text/embedding attachment; permanently closed outcomes; current exact attached retries.
- [x] Original76 exact prefix and meaningful46 appended outcomes; final affected offline lint/typecheck pass.
- [ ] Fresh independent product review, actual nonpaid native OCC/concurrent refinements/attachment/real rollback/visibility inventory and parent process persistence faults — coordinator gate, NOT_RUN here.
- [ ] Gateway wiring/order/peer dispatch count — separately owned, HELD.
- [ ] Actual provider token/price/interface readiness, remaining Task04, full03 and goal — incomplete.

Production qualification root is unchanged and empty. All costs in these handler tests are expressly synthetic immutable fixture truth. No paid outcome, native transaction safety or whole-task acceptance is claimed.

Frozen source SHA256: runtimeModelPolicy `7a21d64328b7b0f08f91199cf6a714c78432e0db68eb340713d208763871f64b`; runtimePolicySchema `4467a4d4e424fa57cd07de95bce702108765747cfb6afa8a0756fea253926534`; test file `be5b87c1c1bb744222c4ca9f4a274279890dcca9443fcfd93bbd6b1177134489`. Full command/results bindings, original preimages and owned-source diffs are in this packet. Shared runtime-policy ownership can pass back to the coordinator after this report.
