# Task Completion Report

## Status: COMPLETE — implementation and scoped offline checks

Source acceptance awaits the parent's fresh non-author review and combined root checks. Actual startup qualification and changed-candidate behavior remain pending. No services, keys, model calls, deployments, mutations, commits, or observed qualification records were used or created here. The prior four compaction files are hash-identical to their freeze.

## Changes Made

- `src/domain/extraction.ts`: additive `FACTS_NATIVE_JSON_SCHEMA_V1`, equivalent to unchanged facts-v1. Optional entity fullValue uses nested anyOf with two fully required closed object variants; omission or string remains valid, null/unknown fields remain invalid.
- `src/domain/model-policy.ts`: immutable `MEMORY_JSON_SCHEMA_CONTRACT.responseFormat`, exact official-wire body and whole-body UTF-8 input-bound helpers, closed request schema and strict contract validation. Every schema/name byte participates in canonical admission and the input bound.
- `convex-dev/runtimeGateway.ts`: exact new proof/interface/limits/native-format guards, native request reconstruction, strict format retained through reservation/checkpoint identity, and no streaming under the new lane.
- `convex-dev/runtimeModelPolicy.ts`: exact new manifest and independently recomputed native input-bound contract. Financial capture/attachment, current authority/source fences, UNKNOWN liabilities, limits, retries and settlement code are unchanged.
- `convex-dev/runtimeMemoryGateway.ts`: producer chooses the strict format only under its separately pinned bound. It reuses the exact v5 source framing; explicitly selected old v5 keeps its JSON-object format/body/replay. facts.resolve retains its separate conflicts-v1/plain contract and cannot borrow strict extraction pins.
- `convex-dev/runtimeModelPolicyBootstrap.ts`: additive envelope/rule type members only. No actual-manifest registry entry or fake version19 qualification.
- `tests/unit/runtime/memory-gateway.test.ts`: actual governed V4 middleware with controlled ledger/native ports and official injected fetch verifies producer/admission/wire/body/bounds, UNKNOWN capture before separate attachment, exact empty facts, unknown-root rejection and replay without another native call, usage failures, stale/revoked source/authority, proof expiry/mismatch, native format drift and mutated reserved bytes.
- `tests/unit/runtime/strict-json-schema.test.ts`: AJV verifies semantic/native equivalence and required closed objects, strict parser remains authoritative; installed official compatible provider wire equality, body byte bound, new/old pin separation, schema/name/body/options/caps/interface/operation mutation rejection and descriptor-safe getter/Unicode denial.

## Requirements Checklist

- [x] Additive strict native route; existing facts schema/parser and v5 prompt unchanged.
- [x] Exact native V4 `{type:"json",schema:FACTS_NATIVE_JSON_SCHEMA_V1,name:"cortex_facts_v1"}`; official installed adapter emits `json_schema` with `strict:true`.
- [x] Separate feature `memory-extract-json-schema-v1`, rule `memory-json-schema-chat-utf8-v1`, bound `memory-json-schema-8192-512-v1`; same GPT4o-mini / facts-v1 / none-v1 / v5 prompt.
- [x] Same ceilings8192 input /16384 context /512 output /60000 private bytes /60000ms /100000 UNKNOWN micro-USD /retries0, every secondary call still governed.
- [x] No normalization, null coercion, paid retry, source or accounting relaxation.
- [x] Current unsupported/hybrid/expired bindings fail closed; original observed V18 and historical routes remain registered unchanged.
- [x] Coordinate installed startup consumer separately with backend owner; exported exact contract and both body/bound helpers. Fresh actual eight-call qualification remains necessary and was not fabricated.

## Files Modified

Six product files and two tests listed above. Exact hashes: `memory-effort-strict-schema-hashes.json`. Review patch: `memory-effort-strict-schema-source.patch`. No sources.ts, generated lib/runtimeDomain, qualification observation, or P/W edits by this executor.

## Verification

- [x] Affected regression run:701/701 tests,7/7 suites,0 skipped/pending, natural exit0 in20.193s. Includes strict/memory adapter, genuine observed V18 ledger, domain policy, native admission, dispatch and terminal composition suites. Exact flags/environment/raw stdout/stderr: `memory-effort-strict-schema-affected-1792035407355.exit.json`.
- [x] Strict owned8-file lint exit0,0warnings in8.115s: `memory-effort-strict-schema-lint2-1792035408391.exit.json`.
- [x] Pinned Node24.15.0/npm12.2.0/tsx local module load, wire contract/bound assertions exit0: `memory-effort-strict-schema-tsx-local-1792035443894.exit.json`.
- [x] `git diff --check` exit0; original passing receipts match the prior8 hashes; the later test-only fixture correction below has focused matching-hash receipts.
- [ ] Combined root tsc/build/public-contract rerun: parent-owned after this freeze.
- [ ] Fresh independent coherent source review and actual qualification/outcomes: pending parent workflow.

## Notes for Reviewer

The initial test1 receipt is preserved:123tests,14failures arose because the new negative-test fixture used Node structuredClone objects from a different Jest realm, which descriptor-safe canonicalization correctly rejected before the intended assertion. Fixture now passes through explicit JSON bytes; product validation was not weakened. Final701 test run supersedes that fixture failure while preserving its raw record.

This successor can reduce malformed question extraction, but native schema does not guarantee factual correctness or prevent provider refusals/incomplete output. The strict parser and usage/accounting fences continue to reject such failures without repair/retry. Live compatibility must be established on a fresh target through the approved actual eight-call startup corpus, including a real question returning exactly facts:[]. Old064/f87 artifacts and receipts stay frozen.

Semantic schema SHA256 `f001b837c01ca4da1a329296ce8435331de6dd97bbe2309561847ec81593a564`; native schema SHA256 `f90bfcfd39f9bbc818029b22466d49554665ace18408a629f73d8eb52cb8bdd3`; native response-format SHA256 `d3655a02550f1e050ab9bf4a79892a4f7f4242122c6ae7ebf08cbab717759148` (canonical JSON). Baseline HEAD `064e21be15f1fb27fc8952e1c75d4265fa50ef72`. This report is an implementation handoff, not an independent judge verdict or full-goal PASS.

## Narrow fixture correction after combined root tsc

The parent retained the combined root tsc exit2 for one readonly FACTS_JSON_SCHEMA fixture assigned to native mutable JSONSchema7. Only memory-gateway.test.ts changed: actual JSON serialize/parse into unknown, object guard, then mutable JSONSchema7 annotation. No cast or product edits. Canonical equality additionally proves the wrong-format bytes stay exact; rejection/call-count assertions remain.

Focused final memory-adapter suite120/120,1suite,zero skips/pending,natural exit0/5.183s; one-file strict lint0/0warnings4.439s; diffcheck0. Raw matching-hash receipts and the original test hash are retained in memory-effort-strict-schema-fixture-repair.json. Final hash is `aa744c3a68481a701a6e625881c68850aceb6d2b93144a69231623fbacbc782f`. The earlier701-test7-suite result plus this affected120 rerun are composed evidence, not one final701 invocation. The other7 owned files and all4 compaction files remain unchanged. Parent reruns failed combined tsc and lint.
