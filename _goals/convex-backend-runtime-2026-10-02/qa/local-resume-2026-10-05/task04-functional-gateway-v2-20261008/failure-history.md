# Preserved scoped failures

- Initial manifest builder inline await inside a non-async map caused SyntaxError before writes; prepare-fixture then lacked manifest. Corrected saved build-manifest.mjs.
- deploy1 used provisioning adminKey instead of scoped deployKey; denied before deploy. deploy2 fixture query generic TypeScript failed. deploy3/4 later completed with typecheck enabled.
- chat-replay called consumeReplay before replay admission and returned an error; corrected replay2 did not repeat paid dispatch.
- embedding1 observed unqualified exact wire model, charged1microUSD, withheld all private bytes and permanently marked its own budget overrun. Fresh repair2 authority did not reset it.
- extract1 omitted fixed semantic output schema and denied before admission. Trusted operation/schema mapping repaired this actual path.
- First dedup-a/b fixture reused a semanticId across runs and both returned IDEMPOTENCY_CONFLICT without effects. Fresh dedup3 scope showed one winner.
- Initial duplicate-terminal inline Node TS import could not resolve profile.js before duplicate effects. Canonical JSON helper subsequently exercised two native terminal submissions.
- verify-live first oracle assumed unknown attempts expose a receipt; actual persisted uncertain state has null receipt. Preserved29/30 result; corrected assertion2 checks actual operation/attempt/account state,30/30.
- First closing-report inline builder repeated await/non-async-map SyntaxError before writes; corrected saved close-batch.mjs.

C7 FULL REJECT2.8 and recorder STATIC ONLY PASS4.25 remain historical scoped verdicts; no captured missing C7 content was recovered by this batch.
