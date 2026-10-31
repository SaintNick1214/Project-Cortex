# Task Judgment: disposable target management, cycle 1

## Verdict: NEEDSREVISION

Scope is TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY. This directory is reviewer-owned evidence and does not enable execution.

## Evidence provenance

The first review executed 49 assertion-bearing in-memory cases in the tool stream. Those raw files were not persisted during the initial no-write review. After the parent authorized reviewer evidence persistence, the same harness was rerun against the parent's byte-exact failed-source preimage. The saved harness/results are explicitly reconstructed rerun evidence, not the original wall-clock transcript.

The replay produced exactly 49 cases and the same helper/request/guard hashes as the original review. There are 47 expected-control cases and two assertions that deliberately reproduce unsafe outcomes; a PASS case label in that raw file means the reproduction assertion succeeded, not that the helper was safe.

## Critical findings

- Failed helper lines 9/52/61 parse account/management JSON without sanitizing exceptions. An injected private malformed response emitted its complete fake private sentinel in the rejection message.
- Failed helper lines 91-99, with actual guard.validateTarget, accepted a newline-bearing deploy key. Provisioning wrote four private environment entries, including an injected self-hosted selector, and reported success.

## Scores

| Dimension | Score |
|---|---:|
| Requirement Fulfillment | 2/5 |
| Code Quality | 2/5 |
| Test Quality | 4/5 |
| Pattern Adherence | 3/5 |
| Completeness | 3/5 |

Average: 2.8/5. Required all-dimension threshold is not met.

## Verified controls and limits

Exact review/request binding, trusted team325340/nicholasgeil/Cortex Memory, sole cloud/dev metadata, seven inherited selectors, private path/mode/hardlink guards, persisted exclusive uncertain-create attempt, refusal of blind retry, partial ownership retention, actual native guard target checks, retirement independently of source preflight, GET404, 180-second deadline, 30-second per-call cap and seven-call cap all behaved as asserted. Positive provisioning used six management calls; retirement used five.

Node v24.15.0 executed the exact source with in-memory filesystem/config/fetch substitutions. An ephemeral api export enabled the direct seven-call probe. Actual guard.validateTarget executed; preparationReviewed was an injected pass/fail prerequisite. No credentials, actual fetches, project/native/paid effects or helper filesystem effects occurred. Authorized writes only persisted this evidence directory. No native foundation/full Task03 acceptance is supplied.

