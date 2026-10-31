# Judgment: latency documentation and packed public-contract delta

## Verdict: PASS

Scoped source/documentation-and-offline-contract PASS under acceptance-policy v2. Exactly six authorized MDX pages changed from website baseline `66661d7`; all six baseline/final hashes match the handoff manifest. The root public-contract script adds meaningful packed ESM/CJS/browser method and public DTO/type checks without removing existing assertions. No blocking documentation or test-delta finding was identified.

This verdict does **not** certify functional live chat or latency. Per the coordinator's current live boundary, the first actual CLI attempt failed before answer delivery, native cause is still under investigation, and no actual UI prompt has been exercised. Those failures/gaps remain unresolved by this review. No publication/deployment, live service call, UI action, paid inference, source edit, GitHub operation, or unrelated repository access occurred. The only write is this report.

## Scope and evidence examined

Core: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion` (`Project-Cortex`). Website: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs` (separate `cortexmemory.dev` checkout, HEAD `66661d7`). The website has no root AGENTS.md/package.json; read its actual docs-site manifest and strict Docusaurus configuration. Its status/diff names only the six authorized MDX files. Applied the previously read workspace/runtime/profile, judge-task role/rubric and practical acceptance-policy v2; read the current documentation report, checks/compile/build/hash receipts, actual MDX diffs, contract-script delta and source references for public SDK shape/Basic/browser clocks. No broad unchanged QA rerun was required.

The user's scope remains reuse of canonical Basic and Vercel demos, investigation/repair of the full delay chain, and submission-to-first-visible-text under one second as a target. These edits explain the accepted source behavior and measurement boundaries; they create no competing app, app-side tool loop or memory writer, and make no observed subsecond claim.

## Requirements review

| Requirement | Finding |
| --- | --- |
| Candidate values and publication status | **Met.** Installation and CLI pages explicitly call SDK/CLI/provider0.39.0 upcoming and instruct matching local tarballs until publication. All changed catalog selections use1.3.1, Basic/Vercel1.4.1 and unchanged Chat1.4.2; missing registry versions do not fall back. Backend guide explicitly says these local candidate versions do not claim registry publication (`installation.mdx:9-20,35-48`; `cli-reference.mdx:9,26-36,90`; `backend-runtime.mdx:88`; `five-minute-quickstart.mdx:14,26,40,49`). |
| Correct combined API/DTO and governed ownership | **Met.** Main example imports only `@cortexmemory/sdk/runtime`, retains caller request ID, calls `submitAndStart` once and consumes `{handle,run,start}` before observation (`runtime-client.mdx:8-73`). It retains authority-error view clearing/observer/client cleanup, explicit approval and supported legacy controls. The three-RPC description correctly excludes authentication/connection/observation/render work. No caller-selected model/context/tool or second application inference/memory loop is instructed. |
| Safe unknown outcome, cancellation and recovery semantics | **Met.** An issued uncertain request may already have run; docs retain exact original intent/ID and inspect original admission instead of new-intent/automatic-start retry (`runtime-client.mdx:75-81,142`). Borrowed client ownership and observer-only disconnect remain explicit (`97`). Basic plain input displays through the same client, `/send` remains later-observation control, and Ctrl+C local observation differs from explicit `/cancel` backend cancellation (`backend-runtime.mdx:84-86`). |
| Response/title/memory/strict barrier distinction | **Met.** Docs separate response finality from asynchronous memory/graph and optional title work, retain strict captured barriers, and instruct first-visible measurement independently of later readiness/title (`performance.mdx:7,18-21`; `runtime-client.mdx:81`). This is source contract documentation, not a claim that the failed live attempt delivered an answer. |
| Trace shape, privacy/default-off and clocks | **Met.** SDK's exact scalar event shape and optional hook are documented with no arguments/results/prompts/output/credentials/error bodies. Callback failures are isolated; fixed native method/RPC IDs are diagnostic, not authority. RPC settlement after a local deadline and watcher wake are explicitly distinguished from permitted/displayed text (`runtime-client.mdx:99-128`). Backend/Basic and quickstart flags are placed in their owning processes; paired events must use the same clock origin. |
| Browser/CLI/provider boundary accuracy | **Met.** Performance page describes first-text layout/DOM commit and double-animation-frame after-paint marker with document visibility metadata; response-status DOM, transport and matching canonical-answer DOM completion are separate. CLI stdout write acknowledgment is a distinct boundary. Official Gateway acquisition/HTTP subphases remain opaque; processed native text is not raw network-first-byte or OpenAI queue timing (`performance.mdx:23-39`). Relevant current marker names agree with source. This source inspection does not certify actual browser rendering or a successful foreground sample. |
| Target only; unavailable video preserved | **Met.** Under one second is explicitly a target without measured success/service guarantee, and fresh installed measurements are required (`performance.mdx:41,47`; `backend-runtime.mdx:94`). Retained asynchronous video types do not imply availability; deferral until official support and real independent acceptance remains unchanged (`runtime-client.mdx:136-140`). No private historical run timing is published. |
| Public packed and browser contract assertions | **Met within test scope.** Script asserts `prototype.submitAndStart` in packed ESM/CJS and browser VM, compiles `RuntimeAdmissionResult` fields/`RuntimeLatencyEvent` from the packed export, and retains all original root/graph/backend hash/URL/browser assertions (`scripts/verify-public-contracts.mjs:25-29,61-94,104-113`). These are export/declaration/browser-safety outcomes, not service execution or semantic authorization proofs. |

## Actual package/declaration linkage and receipts

Independently read the actual K2 SDK archive bytes/manifest at `Project-Cortex-Proofs/manual-sandbox-latency-2026-10-12/image/archives`. Source commit is `431213cd12e4b01efe88b8380ea9024f9e3ee8bd`; `cortexmemory-sdk-0.39.0.tgz` hashes to **`7b25f40df7a7313f357b3c4a52ff29d24f6ded39be562479ae1d31668dc11a70`**. Read its public runtime declaration directly from tar without extracting files. It declares `submitAndStart`, `RuntimeAdmissionResult` and `RuntimeLatencyEvent`, and hashes to **`8981871e0e091e0f23428b60825877d4f9cef0354fc8a78a14fc260fa44dc374`**, identical to the refreshed core declaration compiled by the docs snippets. This establishes concrete candidate linkage for the documented public surface.

Reviewed `latency-docs-checks.json` and individual result records: examples against built public declarations exit0; website TypeScript exit0; strict MDX/static build exit0; whitespace check exit0; Node24.15.0/npm12.2.0/Docusaurus3.9.2. The site config retains throw-level broken URL/anchor/Markdown checks; the actual build log ends with successful client/server compilation and generated static files. Its stale Browserslist/update notices are not functional proof or a task blocker. Compiler skipLibCheck applies to dependency declaration internals; examples still compile their strict public usage. No live render is inferred.

`packed-browser-contracts.log` preserves the initial K2-stage consumer error accessing nonexistent `RuntimeStartResult.status`; the absolute compiler path identifies the isolated K2 stage. The current script correctly accesses `combined.start.state`, matching the actual DTO/public declaration. This is correction of a mistaken test property, not removal of a product assertion. `packed-browser-contracts-corrected.log` records the final packed ESM/CJS/backend/declaration/browser checks passed. No independent rerun was performed; actual packed declaration bytes were independently matched as above. A signature/export PASS does not repair or certify the ongoing native live failure.

## Exact reviewed hashes

All website baseline hashes independently recomputed from `git show 66661d7:path`; all final hashes independently computed from current bytes and matched `latency-docs-source-hashes.json`.

| Website path | Baseline SHA256 | Final SHA256 |
| --- | --- | --- |
| `docs-site/docs/api-reference/runtime-client.mdx` | `ad7113fb6a390e349fb7e2a262c4d80a653bb92afa4658418a508672ae24a6d8` | `8639f7b4debc0b6bc2bec6d24b5c0f626cf1b5f6a99c090210ce70509accd90d` |
| `docs-site/docs/getting-started/backend-runtime.mdx` | `d457f822b5e1ed464d52f217063fa1a7c4a6645f7fc4616ad93cbbe49ad4aa3d` | `6246cf77d233d2efb726a3063139cd3b54a1d73eaf911623c58043f4cd3445cd` |
| `docs-site/docs/architecture/performance.mdx` | `1eb8ba3e200b7a9faab9217089d25d64a147593c37d6a56c32a5901928128b2b` | `cb5bcd4a4ea3f1b7daedefe7af52fcd88ecb60d2a597022b0d6e1e47675a6408` |
| `docs-site/docs/getting-started/installation.mdx` | `ce4289a10c0e9b7e11e28204c119479ba1f81eb2fa179799ea775441d414f186` | `2b5a235a74544a83ce14fe5d778b246a069bcc58874b4912bd8d734140a655b2` |
| `docs-site/docs/getting-started/five-minute-quickstart.mdx` | `06ffb05cbdcbca4bf7abd3ba2a45c56f72c9f95be034deb9eff16dedf2a42c8a` | `ce0e2d2eb082e019cbdc8a9f01a2cba86ab740ce77f495082e425d38d86053db` |
| `docs-site/docs/tools/cli-reference.mdx` | `6a7f998dd64ec376c97a4841ff2a7c728fa2ba6f5c0b77b2add4997678885ca2` | `2e222740350cfa5551d37725c291df8755a761d3d7168fcbae7c3f06192e49ec` |

Core script reviewed SHA256: **`scripts/verify-public-contracts.mjs` = `3cf8a88386f53595460db5c105522fdbd765a350e1d125d26f6b7eb50a50f0db`**. Public core/K2 declaration SHA256 is the shared value above. The script remains an uncommitted root delta; no Git write is authorized or performed by this judgment.

## Dimension scores and findings

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement fulfillment | 4/5 | Current prospective versions, canonical caller reuse, API/trace/recovery behavior and honest target/video limits documented. |
| Code/content quality | 4/5 | Connected examples with owned cleanup and exact metadata/time-domain qualifications; additive contract assertions preserve existing checks. |
| Test quality | 4/5 | Strict actual public declaration examples and docs build; packed method/type/export/backend/browser checks with preserved initial error and corrected result. |
| Pattern adherence | 4/5 | Runtime-only application client, backend governor/async memory ownership, stable identity/replay, separate docs checkout and explicit unpublished handoff. |
| Completeness | 4/5 | Six authorized pages consistent/buildable and concrete K2 public declaration linkage; publication/live behavior deliberately outside this source gate. |

Average: **4.0/5**. **No unresolved blocking finding in this scoped docs/contract delta.** Do not publish these candidate docs as a verified live latency result. Continue the actual native failure repair, fresh installed CLI/browser positive/negative acceptance, submission-to-first-visible measurements, final audit and cleanup; no source/package/doc review can substitute for those outcomes.
