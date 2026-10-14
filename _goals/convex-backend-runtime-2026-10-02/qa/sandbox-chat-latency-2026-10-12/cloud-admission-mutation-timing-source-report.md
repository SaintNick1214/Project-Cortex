# Mutation admission timing source report

Status: COMPLETE for this source-and-controlled-test substep; prospective native timing and the independent joint review remain pending. Repository: SaintNick1214/Project-Cortex, checkout /Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion. No repository visibility is inferred. Source baseline is 6156ea97aa8776accee52879176cdcd12e802d89; current QA HEAD is cce2b7aa435d8c2cfc082c38e635833bf13aaed4. The product candidate remains uncommitted.

## Change and preserved behavior

Added traceRuntimeMutationSpan in runtimeLatencyTrace.ts and wrapped only the original submitHandler, startHandler and getHandler calls in runtimeClient.submitAndStartHandler. The original traceRuntimePhase body is byte-identical. Removing only the added import and three diagnostic wrappers restores the entire original runtimeClient.ts byte-for-byte. Endpoint validators, original inputs, helper order, every existing authority/tuple predicate, DB/component writes and returned DTO remain unchanged.

The helper calls its callback exactly once. With tracing disabled or process absent it accesses neither performance nor console. With exact opt-in it emits begin/end or failed phases through the existing scalar allowlist. Missing, throwing, nonfinite, regressing or overflowed clocks omit durationMs. Timings never choose a guard, budget, deadline, persisted value or response. Callback errors retain their identity; enabled trace-output failures continue to propagate, as the original trace function requires. The pre-submit correlation is a fixed hashed label; later stages use the original returned run/attempt. Native log request IDs provide the admission join.

[Convex runtime documentation](https://docs.convex.dev/functions/runtimes) states that performance.now advances during mutations and remains fixed during queries. These new callback spans are opt-in native-mutation diagnostics only. Existing Date.now phase stamps are retained; no historical child span was reconstructed from a fixed clock. [Convex log-stream documentation](https://docs.convex.dev/production/integrations/log-streams) distinguishes execution time from user execution time, which excludes system overhead. A callback span is inclusive of awaited work and must not be added to an overlapping native completion or nested child span.

The backend author separately wrapped native startExecution claimNext and Workflow start using this same helper, after preserving original arguments and order. Those changes and the three raw-read entry scopes belong to the sibling source packet, not this implementation ownership. All eight joint source/test hashes stayed identical through the final shared type/build/contracts checks.

## Checks and scope

- Node 24.15.0 and npm 12.2.0, pinned PATH for all npm child scripts.
- Final affected trace/client/start/context regressions: 379 passed, 13 suites, 0 skips or todos. Original 56-test predecessor receipt remains preserved.
- Fresh joint root and backend types, own lint types and scoped ESLint: exit 0. Backend author owns the one final full root lint.
- One normal npm run build: exit 0, including root/runtime/graph declarations and the 157-file backend distribution. All 157 manifest output hashes verified.
- One actual packed contract check: exit 0 for root/runtime/graph ESM+CJS, consumer declarations, backend digest closure and root/runtime browser VM. The verifier removes its owned scratch in finally.
- Source equivalence and whitespace checks passed. Controlled registered admission tests compare exact output and transactional effects with tracing off/on and prove a real failed start rolls back every parent effect. Helper tests cover clock opt-out/process absence, elapsed duration with fixed Date.now, unavailable clocks, exact rejection identity and enabled console failures without logging callback/error payload. Existing functional assertions remain.

The 32 GiB machine had 64 GiB filesystem space available before the normal build. No resource failure occurred, no command was blindly retried, and no service, inference, target, credential, launcher, pin, docs, package-release or Git mutation was performed by this substep. Prior broad source coverage and the sibling's preserved failed tool-suite/isolated outcomes remain separately scoped.

## Frozen files

| Path | SHA256 |
|---|---|
| `convex-dev/runtimeLatencyTrace.ts` | `8fee2317e14653d54da71dd914a0d2befc42629af9e554f9cfc652119c60ac49` |
| `convex-dev/runtimeClient.ts` | `a6fd5c2f00c13cb439c82674540da07dc00cfc8e72f7c82be1b7318109a0f743` |
| `tests/unit/runtime/latency-trace.test.ts` | `3f5f4979983fe14685131c7ea5b628927542eaf7976b694572e3a1ae355381fa` |
| `tests/unit/client-runtime/admission-native.test.ts` | `3e40635a16587d5d752c944f0777c4875aacb2e4dbb9c61e99d1920a43324574` |
| `convex-dev/runtimeAgent.ts` | `6cbde575a009d9ed1368e2fd6fd0791092e6c2ba2eb24447c8403be2ce3508aa` |
| `convex-dev/runtimeModelPolicy.ts` | `c36e9328c9e592e286fecc91c7f44b4f0c92ab67487ee111a206e81fe91e01e9` |
| `tests/unit/runtimeAgent/endpoint-raw-read-scopes.test.ts` | `4a6f10080afb0efcbd28f7967e010c43252ea153312d1f7546ba79d2535f48db` |
| `tests/unit/runtimeAgent/start-native.test.ts` | `97a80efa8fc00ce3ec4639d7ac2f49ea802c82a8bb7c901bf707c31ea56acfff` |

The final receipt records commands' raw log hashes, exit files, one candidate digest, the backend manifest and original freeze digest. Owned source/test implementation milestone: 100%. Native optional span measurement: UNAVAILABLE. K17 remains 0/4 below 1,000 ms; the parent's latency goal remains 50%. No speedup or SLO success is inferred from this source batch.
