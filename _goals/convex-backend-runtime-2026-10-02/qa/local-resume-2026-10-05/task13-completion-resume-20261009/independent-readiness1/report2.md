# Continuing async source review — closure

**Verdict: PASS for the bounded source-and-controlled-test repair batch.** No known reachable breaking finding remains in the reviewed changes. This grants no original Task13/14 functional criterion and does not declare the full goal complete.

This is the same non-author review under acceptance-policy v2. Initial findings and their original source basis remain preserved in [report1.md](report1.md) and [handoff1.json](handoff1.json). Current candidate is the six-file batch [candidate1.json](../candidate1.json), digest `5dbbf14a3cb31e9f256519b447c92bd1b30b74ffc934d39fe1f7e9e4f5d4c255`, against HEAD `352cb9245f3a9ea73b676b925ec0cd0c47419d5f`. The reviewer independently read the final diff, relevant registered handlers/tests and raw affected outcomes, and verified all six file hashes against the candidate. Product source outside this material delta retains its prior scoped applicability.

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Requirement fulfillment | 4/5 | Four independently repairable source findings closed; genuine async capability remains separately ungranted. |
| Test quality | 4/5 | Meaningful crash, atomic rollback, stale action, expiry, authority, accounting and replay outcomes; original failures retained. |
| Completeness | 4/5 | Scheduled internal recovery is reachable and bounded; SDK/UI contracts remain equivalent where unchanged. |
| Code quality | 4/5 | Small existing-handler changes, optional schema fields, shared decimal and ledger accounting functions. |
| Pattern adherence | 4/5 | Current authority/proof fences, Convex transaction scheduling and trusted internal producer boundaries retained. |

Mean: **4.0/5**. These scores apply to this source repair, not to incomplete full-task acceptance.

## Findings closed

- **Download loss:** `runtimeMediaJobs.ts:205` commits the lease and saved-operation recovery action together. Active leases precede the three-attempt exhaustion guard. Existing stored-output recovery remains first, so a hard interruption or saved-output acknowledgment gap produces one owned artifact version without another generation. Early/older wakes, final active attempt, scheduling rollback, cancellation, revocation and expiry are covered.
- **Poll loss and stale terminal action:** `runtimeMediaJobs.ts:160–201` commits a token-fenced watchdog with each poll claim. Normal completion clears its token and schedules one backoff successor; old or terminal wakes cannot compete. `runtimeMediaGateway.ts:153` propagates the claimed token. Failed-status evidence is now constructed from the saved job and captured inside `providerTerminal` after its token guard, in the same transaction as the terminal state. This closes both stale-action ledger mutation and the separate-RPC acknowledgment gap. Pinned Convex `registration.ts:145–154` documents mutation `runMutation` as transactional; focused controls prove nested-capture rollback and committed acknowledgment loss without a second capture/poll chain.
- **Native cost:** `runtimeMediaGateway.ts:50` preserves finite nonnegative official numeric cost through existing conservative decimal normalization. `captureOutput:102` selects aggregate cost only when the exact dispatch proof authorizes `gateway-aggregate-usd-v1`. The qualified controlled positive settles exact20 units on the attempt and every account, clears reserved/uncertain/concurrency counters, and preserves one version/no new generation on replay. Unavailable proof cannot be upgraded by reported metadata. Serving identity and token usage are not fabricated.
- **Configuration reason:** `runtimeMediaGateway.ts:80` maps the exact documented refusal to `MEDIA_CAPABILITY_UNAVAILABLE`, preserving `submission_unknown`, full unknown liability and held slot where submission was issued. Reconciliation does not submit again.

The added `expirePoll` endpoint is **internal**, with validated job/token arguments, state/token/time checks, then current saved-reference write/storage authority, context/input/source and retention fences before rescheduling. It adds an internal recovery effect class, not a public authority bypass or new billable admission. Optional poll-lease fields preserve the current stored-row contract. Qualification arrays, policy dates, budget roots/windows and historical financial rows were not changed.

## Verification and limits

[Final checks](../lease-recovery1/checks1.json) and [raw affected run](../lease-recovery1/affected-green4.log) show **10 suites,182/182 tests,0 skipped**, explicit `--forceExit=false --watchman=false`, exit0 and natural process close in9.134s. This includes the native-cost9 once and36 recovery cases:14 original cases retained plus22 new cases. Backend types, full root types and scoped lint exit0. [Author source manifest](../lease-recovery1/source-manifest1.json) matches the reviewed bytes. Earlier setup, semantic, fixture and stale-action failures remain history; the synthetic media proof was extended only in recovery setup before admission, with a separate expired-proof refusal test. Production proof freshness was not relaxed.

Official provider0.2.1 tests use controlled fetch and a service-token seam; registered-handler fixtures use controlled native ports. They are **not actual async service evidence**. Earlier native-cost green3 inherited forced Jest exit and supplies semantic evidence only; the final affected run supplies natural-close evidence. No reviewer tests, credential reads, service queries/mutations, model calls, browser or Git actions occurred.

Root [offline quality and packed contracts](../root-quality1/handoff1.json) also closed with natural exit0: full lint34.362s (0 errors,234 disclosed existing warnings), full build26.806s and packed ESM/CJS/backend/declaration/browser contracts2.620s. Source postimages remain unchanged.

Nonbreaking retained behavior: after-ready duplicate signed callbacks return409 and cannot change the output; rejected/oversize output retains full conservative unknown cost even when metadata exists. This review does not broaden output delivery or promise refund/upstream cancellation. Next current-head Linux CI/cleanup/native after-read remain pending applicability evidence, not another preparation judge.

Original **13A1,13A2,13A4,14A1 remain ungranted** pending genuine governed async submission/status/download, callback/missed-callback and ordering recovery, one owned immutable result/private delivery, linked-local behavior and full TS/UI parity. The [official async documentation](https://docs.convex.dev/ai-gateway/images-and-videos) directs unconfigured deployments to Convex support. No new qualification is inferred from this repair. Original16A3/17A2 likewise remain ungranted; counts remain **13/17 tasks,55/61 criteria**, all12 goal criteria retained, full goal false. Prior failed intervals, exclusions and missing C7 historical backing/custody remain unchanged.
