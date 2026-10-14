# Disposable Cortex sandbox

From the Proofs root, with Docker Desktop running:

```sh
./start-sandbox.sh
```

Each run creates a new Convex development database in **cortex-sandboxes**, project3200658/team325340, and a new Docker container. The host needs its existing Convex login; GitHub access is unnecessary. The launcher uses Node24.15.0/npm12.2.0 and the accepted local SDK/CLI/provider0.39.0 candidates. It installs the canonical Basic demo1.4.2 and Vercel quickstart1.4.2 from catalog1.3.3.

Wait for the session ID and demo URL. Open that URL, paste the owner token into **Connect**, and choose **New chat**. The default launch copies only that session's token to the local clipboard; it prints no token. Use `--no-copy` to preserve the clipboard. Host account credentials and the signing key stay outside Docker.

**Press Ctrl-C in the launcher terminal to exit and delete that container and disposable database.** Setup failure, normal completion and SIGTERM also enter owned cleanup. Hard termination or an unavailable service can prevent immediate cleanup; the exact recovery record remains until absence is verified. The shared project and accepted kit are retained. No global prune or unrelated project cleanup runs.

```sh
./start-sandbox.sh --help
./start-sandbox.sh --dry-run
./start-sandbox.sh --no-copy
./start-sandbox.sh --smoke
./start-sandbox.sh cleanup SESSION_ID
```

Every setup makes eight fixed real Gateway qualification requests for text, streaming, tools, embedding, JSON extraction and images. There are no automatic paid retries. Its maximum retained unknown-liability ceiling is **$2.70**, which is not actual charges. Ordinary manual requests use the existing **$3/run,$10/tenant,concurrency2** controls. Unsupported or changed contracts stop setup and trigger cleanup. Video is deferred because the official Gateway does not support asynchronous generation.

For the Basic demo, use the exact container name printed by the launcher in another terminal:

```sh
docker exec -it --workdir /work/basic NAME npm start
docker exec --workdir /work/basic NAME cortex --help
```

Try these scenarios:

1. Ask it to remember a distinctive preference. Display the answer while memory indexing finishes; then check facts and vector readiness.
2. Choose **New chat** and ask for that preference after indexing completes.
3. Explicitly request `memory_remember`. Observe **Approve memory_remember**, disconnect/reconnect the same run, then approve the recorded tool once.
4. Refresh credentials, disconnect/reconnect an observer, sign out, test reader write denial and outsider scope denial. Retain the same request/run identity when an outcome is unknown.
5. Upload a small private file, compare authenticated downloaded bytes, test outsider denial and rejection above20,000,000 bytes.
6. Explicitly request one image with the qualified fixed1024×1024 low-quality PNG contract and inspect its retained private result. Unsupported options must refuse.

Token commands use the printed session UUID:

```sh
./start-sandbox.sh refresh-tokens SESSION_ID
./start-sandbox.sh copy-token SESSION_ID owner
./start-sandbox.sh copy-token SESSION_ID reader
./start-sandbox.sh copy-token SESSION_ID outsider
```

Tokens last at most one hour and refresh while the launcher runs. Paste a refreshed token into **Refresh token**. Private scoped keys are removed after successful cleanup; redacted receipts remain in the ignored `.sandbox-env-runs/SESSION_ID/receipts` directory. Union Arena resources are outside this workflow.

The preceding K20 kit was `manual-sandbox-latency-whole-path-2026-10-14`, from Project-Cortex commit `53421e78165fb12a16a11faa19db9372fa8ddfd4`, with159 verified backend outputs and exact image/archive pins. Ordinary V6 turns use direct scheduling; fresh tool continuation uses WorkflowV7, while strict barriers and historical workflows retain their original versions. The source, packages, image and108launcher tests passed; its historical hosted failures remain below. Fresh authorization, transcript/source checks, per-call model budgets, UNKNOWN liability and independent post-response session checks remain. Source review and immutable packaging passed. The previous K19 hosted V6 ordinary replies and eight-event native memory proof passed; all four latency samples and the supplemental final tool answer failed. This historical result does not qualify the new kit. In scenario3 the memory effect succeeded, but the final answer received a bounded-request policy denial before model admission. Preserve its failed run rather than retrying the same paid operation.

Hosted Convex submission-to-first-visible-text below1,000ms remains the target. The K19 candidate measured browser **4.88/5.90seconds** and Basic **8.58/9.47seconds**; all four failed the target. All four replies completed under the original30second deadline and the eight-event native memory proof passed. The separate approved tool scenario failed its final answer. The database, container and private credential directories were freshly verified absent. The earlier K18 browser **5.91/4.71seconds** and Basic **10.43/9.92seconds** failures remain historical evidence. Historical failures and raw timing/usage/cleanup receipts remain under the Project-Cortex goal's `qa/sandbox-chat-latency-2026-10-12/`; no historical result is relabeled by a later candidate.

For prospective client timing, start with `CORTEX_RUNTIME_LATENCY_TRACE=1 ./start-sandbox.sh`. Backend tracing is enabled separately only after that exact disposable target is READY. Browser paint, CLI stdout, canonical completion, memory readiness and title completion are separate clocks/states. Setup success does not certify that every manual scenario, graph integration, backup restore or full core gate was run.

The current launcher candidate uses accepted local source `6f5d31fc920c3ac06512348ebe79d955ccd92e92` from **SaintNick1214/Project-Cortex**, kit `manual-sandbox-candidate-bound-2026-10-14`, with170installed backend files and78tables. Its fresh Agent definition selects4recent messages,4relevant memories,4relevant facts and4pending entries, with a16-entry assembled ceiling and explicit incompleteness if pending coverage overflows. Qualified input/budget/tool limits can narrow that further; complete canonical history remains stored permessage. Registry3 is additive; existing definitions retain their contracts. Source, package and independent review checks passed. Its latest K25 hosted run completed four replies and passed the fixed four-run memory qualification, while all four first-visible-text samples still missed the one-second target. Source acceptance does not establish full goal completion.

The preceding K22 candidate returned four ordinary replies, but browser first-visible text took7.76/9.21seconds and CLI first stdout12.07/11.74seconds, all above one second. One approved memory tool and its final answer completed, including observer disconnect/reconnect. A separate repeated-capture scenario passed221native provenance checks, contiguous facts/vectors through4messages, public recall and the original access/lock/deletion/revocation negatives. Public recall took2.79seconds. Two chat user events failed validation (duplicatedfactslot/invalidtags), leaving honest contiguous watermark holes. Those historical failures remain preserved. The subsequent K23 candidate passed all four ordinary memory outcomes without paid retries or weakening strict parsing. K22 database/container/privatecredentials were independently verified absent. Every launcher run creates its own environment. Preserve request IDs and successful tool receipts rather than automatically retrying a failed answer. Detailed original receipts and cleanup are in the Project-Cortex goal QA directory.

The preceding K23 sandbox completed four ordinary replies: browser **3.93/8.50 seconds**, Basic CLI **9.30/9.72 seconds**, so **0/4** passed the subsecond target. Native evidence passed4attributed userfacts/8current-profile vectors and contiguous indexing through8events. Repeated external capture, replay/body conflict, public recall (**2.71 seconds**) and scoped reader/outsider/lock/deletion/revocation negatives passed. An approved memory tool and final answer passed after one approval and observer reconnect, with strict facts/vectors through11of11. Expired/invalid signed SDK tokens refused in133/89ms with0protected payload and unchanged inventories. All47native attempts released their slots; actual charges remain UNKNOWN. Fresh independent verification found the exact disposable database, container and private credentials absent. Optional graph was not qualified in that run.

New disposable databases explicitly request `aws-us-east-1` after checking current availability in the approved Cortex sandbox team. This is a requested region; the creation response does not verify physical location. Older environments retain their original cleanup bindings and do not require a regions lookup. The next source candidate's terminal read retention and same-run ingestion scheduling delay require their own installed cloud qualification.

The preceding K24 candidate returned browser first-visible text in **3.67/3.26 seconds** and CLI first stdout in **7.15/9.54 seconds**: **0/4** met the one-second target. Warm-chat fact resolution failed with `AMBIGUOUS_EXTRACTION_SLOT`, leaving contiguous facts/vectors through event2; the strict barrier correctly returned `CONTEXT_INCOMPLETE`. Separate ordinary capture/replay/public recall/isolation checks, SDK authentication denial, and one approved tool with reconnect/final answer passed. All45native attempts released slots; actual charges remain UNKNOWN. Independent verification found the exact disposable database/container/private credentials absent. K25 source work binds each unequal extracted fact to its own original resolution call, composes two original read parents, and reuses the interactive Basic connection with fresh per-command session checks. Those changes, Basic1.4.2 and catalog1.3.3 are installed in the K25 kit; the scoped outcomes follow.

The K25 installed candidate returned first visible text in **6.22/3.88 seconds** in the browser and first stdout in **7.25/10.24 seconds** in the CLI: **0/4** passed the target. Its fixed four-run proof passed four attributed user facts, eight current-profile source vectors, candidate bindings and contiguous facts/vectors through8. Separate capture/replay/public recall/isolation checks passed; public recall took2.54seconds. One tool approval, observer disconnect/reconnect, the tool effect and final answer passed, with strict facts/vectors through11of11. Expired and invalid signed tokens refused in134/105ms with0protected payload. These live extractions each retained one candidate, so two-unequal-candidate service coverage is separate from the controlled handler tests. The warm CLI trace spends8.27seconds before main dispatch: recall4.48seconds, including3.74seconds after embedding, followed by947ms of save/candidate preparation. Two guarded regions read899/905documents despite onlynine unique sources in the later proof inventory. Repeated recursive source validation is the next source repair; its speed benefit is unmeasured.

The separate K25 one-shot multi-preference capture also passed: three retained candidates included two unequal same-slot values, all exact bindings and stages completed, and the original deterministic/one-paid-resolver plan remained governed. No model output was forced and no retry occurred. The final snapshot records52native attempts,0active slots,allslotsreleased and7.1millionUNKNOWNreservation-ceiling units; those are not actual monetary charges. Newly created in-plan UPDATE/SUPERSEDE remains an explicit unqualified refusal.

Fresh independent K25 cleanup verified the exact database, container, issuer, secret, workspace and backend directories absent. The recorded launcher pipeline status0 does not establish its child exit; the child status remainsUNKNOWN. Cleanup is established independently. The root launcher script remains ready to create a fresh environment on every execution.
