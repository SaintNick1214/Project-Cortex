# Task Judgment: disposable target management, cycle 2

## Verdict: NEEDSREVISION

Scope is TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY. This directory is reviewer-owned evidence and does not enable execution.

## Evidence review

Fresh exact-source review of helper d27838fbf4a0c9a4d4dedbcfb94ad453f1a0d3e5e5d00b32b4229abeb3303aba. Request and guard remained byte-identical to cycle1. The two cycle1 defects were fixed and their regression controls pass.

The main offline VM harness executed 112/112 outcome assertions. The additional native account-header harness executed three deliberate failure reproductions against the same exact source. These three reproduction labels are PASS because the diagnostic-reflection assertions succeeded; the helper verdict remains NEEDSREVISION.

## Critical finding

At helper lines 54-58, account accessToken is checked only for string/nonempty before becoming the Authorization header. A JSON-valid token containing CR, LF or NUL passes that check. Node24 native Headers validation then throws an error containing the entire Authorization value, and the helper propagates that rejection without sanitizing it.

All three actual-source VM probes used Node's real Headers constructor inside substituted fetch. Each produced a rejection reflecting the complete fake private account marker, with zero platform requests and zero helper file writes. No real token, actual fetch or network connection was used.

Reject invalid token control characters before dispatch and sanitize errors from fetch and response-body transport without attaching private error causes. Preserve existing request binding, unknown-POST journal, owned-project retirement and time/call bounds.

## Requirements review

| Requirement | Observed result |
|---|---|
| Source/request independent-review binding | PASS, five review and fifteen request negative controls preserved |
| Trusted team/name/slug and fresh sole cloud/dev target | PASS, live-metadata substitutions reject mismatch before key |
| Pre-effect selectors/private paths/ownership | PASS, inherited selectors, symlink/mode/hardlink and receipt mismatches reject |
| Private credential confidentiality | FAIL, native account-header validation can reflect account token bytes |
| Valid key shape and exact-three-entry env roundtrip | PASS, malformed key JSON safe; CR/LF/NUL/ASCII0-32/DEL/U2028/U2029/nonstring/wrong prefix/8193-byte key deny before environment write; 8192-byte key and native parseEnv roundtrip pass |
| Exclusive persisted ownership and uncertain POST | PASS, fsynced attempt survives unknown create; blind retry rejects; ownership fsync precedes verification |
| Partial failure/source-preflight-independent retirement | PASS, actual chained key rejection and target-save failure retain ownership and retire on five calls with preflight failure injected |
| 180 seconds / 30 seconds / seven calls | PASS; eighth call rejects before substituted request; source limits remain intact |
| Physical deletion confirmation | PASS in-memory ordering; missing GET404 cannot create retirement success |
| Scope/assertion preservation | PASS, management only; no native foundation or full Task03 acceptance |

## Scores

| Dimension | Score |
|---|---:|
| Requirement Fulfillment | 2/5 |
| Code Quality | 2/5 |
| Test Quality | 5/5 |
| Pattern Adherence | 3/5 |
| Completeness | 3/5 |

Average: 3.0/5. Required all-dimension threshold is not met.

## Validation

Node syntax check: exit0. Scoped ESLint10 recommended Node/ESM rules: exit0, zero errors/fatals/warnings/suppressed messages. The scoped lint configuration avoids the repository's deliberate QA-tree exclusion and uses no rule disable. Raw results are saved alongside this report.

## Limits

All helper filesystem/config/fetch APIs were substituted in-memory. Actual guard.validateTarget, Node parseEnv and (additional negatives) Node Headers executed. An ephemeral source export exposes api solely for the direct call-limit test; the actual source was unchanged. preparationReviewed is injected pass/fail and does not independently certify sourcePreflight/current native qualification. Public source/request/guard and reviewer artifacts were read; actual private files/credentials were never read. Evidence persistence is the only authorized real filesystem mutation. Live API response compatibility, actual provisioning/retirement, native foundation and full Task03 remain outside this verdict.

