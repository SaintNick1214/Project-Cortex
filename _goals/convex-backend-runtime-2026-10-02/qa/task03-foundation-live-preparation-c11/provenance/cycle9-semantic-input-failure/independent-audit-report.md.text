# Judgment: C9 generated semantic fixtures

## Verdict: NEEDS FIXES

Technical fixture audit only. This is not the fresh C10 preparation judge, a live authorization gate, or Task03 completion.

## Evidence Review

Read repository AGENTS.md, .agents/CODEX-RUNTIME.md, PROJECT-PROFILE.md, pessimistic-judge role, approved Task03 requirements and authoritative decisions. Inspected all 200 public registrations from the C9 frozen ledger across 18 source modules and executed their actual current-source native `_handler` functions with original generic generated arguments. The context returns null verified identity and traps every DB/storage/scheduler/write/vector operation. The four actions may forward only `runtimeAuth:authorize` into its actual internal handler. There is no network, credential, signing, deployment, source change, or assertion relaxation.

Reproduce from repository root: `node work/resume/semantic-fixture-audit/probe.mjs`. `nojwt-results.json` contains all 400 outcomes and current handler source hashes.

Original C9 arguments: 199/200 reached verified identity and returned typed authorization denial; governance:setPolicy alone returned INVALID_INPUT without reaching identity. Change only `policy.conversations.retention.deleteAfter` to `30d`: all 200 reached verified identity and returned typed authorization denial. Both passes observed zero protected/effect trap invocations. Assertions independently require these exact outcomes.

## Issues Found

### Critical (must fix)

- `convex-dev/governance.ts:236` requires `conversations.retention.deleteAfter` as a string. At :258, `validatePolicy` rejects duration keys ending After/TTL/Timeout/Duration/Expiry unless the string matches `^[1-9]\d*(?:s|m|h|d|w|y)$`. `setPolicy` calls validation at :318 before its authorization at :319. C9 `scripts/argument-candidates.mjs:10` gives unfixed string keys `ctx.run + ':arg-' + key`; therefore `:arg-deleteAfter` is validator-shaped but semantically invalid. Recommendation: supply an exact source-grounded valid policy, or narrowly bind this required field to `30d`. Keep INVALID_INPUT outside accepted authorization outcomes.

### Important (should fix)

- No further pre-authorization semantic mismatch was found in the actual generated arguments across all 200 source handlers. Optional durations, sessions policy, byImportance entries and version records are absent/empty in the generic generator. If C10 uses a full policy template, validate every included duration and ordered [0,100] range against `governance.ts:254-278`; that constitutes a new candidate requiring its own verification.

### Minor (consider fixing)

- Generic shapes are not generally valid authorized operation fixtures; this audit only certifies they reach missing-identity authorization after the one duration repair. Do not generalize this into positive-operation acceptance.

## Post-authorization validation distinctions

- `sessions.ts:18-23`: creationLifetime is AFTER awaited authority and actor check. Generic startedAt=1 is finite and expiresAt is omitted, so it also satisfies this particular check. Optional expiry mutations would require expiry > now and > startedAt. All seven public session handlers deny missing identity first.
- `users.ts:8,12,17,33`: every user lookup/mutation resolves authority first. getVersion pagination occurs after scoped row resolution. All eight public user paths deny missing identity first.
- `agents.ts:69-70`: unregisterMany requires agentIds or status only AFTER RegistryAccess.open. Omitted generic filters are a positive-operation issue, not a pre-auth mismatch.
- `memorySpaces.ts:52-54`: cascade=false fails deleteSpace semantic confirmation only AFTER RegistryAccess.open. Do not alter it merely to make missing-identity assertions pass; they already reach the auth boundary.
- `governance.ts:334,370`: partial override/simulate validation is pre-auth, but all optional components are omitted by the original generator except scoped memorySpaceId. Original shapes therefore pass it. :405 report-period semantics and :434 enforcement-period semantics occur after publicAdmin.
- graph worker jobs and maintenance/scheduler-style functions are internal registrations. `graphSync.ts:39,43-47` checks worker authority before expectedVersion/sourceRevision validations. `sessions.ts:82-102` background increments/expiry are internal. There are no jobs.ts or schedulers.ts source modules and no public registrations for those internal paths in the 200-row ledger. Internal-only capability behavior remains separate from public noJWT fixture validity.

## Dimension Scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Original semantic fixture validity | 2/5 | One demonstrated pre-auth duration failure blocks exhaustive live run. |
| Audit coverage | 4/5 | All200 actual source handlers, strict auth/effect probes; offline ID placeholders, no native wire validation. |
| Repair specificity | 5/5 | One-field duration correction independently restores auth reachability across all200. |

**Average**: 3.7/5

## Recommendation

Producer should supply a source-grounded semantically valid governance fixture and keep every original deny classification, no-effect assertion and independent gate. Require fresh C10 candidate verification before a new live run. Offline placeholders are shape-only; actual native wire ID encoding, service behavior, JWT variants, owner fixtures and no-effect snapshots remain the authorized live runner's obligations.
