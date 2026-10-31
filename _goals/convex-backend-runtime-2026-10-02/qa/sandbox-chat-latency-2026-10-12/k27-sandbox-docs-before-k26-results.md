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

The current launcher uses local commit `9fb9687536af0b7abfcb7280e0aa26ef450051ea` from **SaintNick1214/Project-Cortex**, kit `manual-sandbox-managed-source-2026-10-14`, with170 installed backend files and78 tables. Source review, isolated packages, actual package consumers, Docker image,119 launcher tests and dry run passed. Its invocation-scoped raw ancestry reader preserves the original access/source predicates and fresh final fences. Hosted behavior and its latency improvement still require qualification.

The assembled request selects at most **4 recent messages,4 relevant memories,4 relevant facts and4 pending entries**, with a **16-entry ceiling**. Required input/tool groups and qualified model/budget limits can narrow it further. Pending overflow is explicit. Complete canonical history remains stored as individual message rows with lineage metadata; request bounds do not delete history. Existing Agent definitions keep their versioned contracts.

The latest completed hosted baseline, K25, returned all four ordinary replies, but first visible text took **6.22/3.88 seconds** in the browser and **7.25/10.24 seconds** in Basic CLI: **0/4** met the below1,000ms target. Native memory/candidate bindings, repeated capture/replay/public recall/isolation, expired/invalid-token denial and one tool approval/reconnect/final answer passed; strict facts/vectors reached11of11. A separate native capture exercised unequal same-slot candidates. Newly created in-plan UPDATE/SUPERSEDE remains an unqualified refusal. These are K25 results, not acceptance of the new candidate or full goal.

For timing, start with `CORTEX_RUNTIME_LATENCY_TRACE=1 ./start-sandbox.sh`. Enable backend tracing separately only after verifying that exact disposable target is READY. Browser paint, CLI stdout, canonical completion, memory readiness and title completion are distinct measurements. Source/packaging/setup success does not certify manual scenarios or the full core gate.

New databases request `aws-us-east-1` after checking availability in the approved Cortex sandbox team. The creation response does not establish their physical location. Every execution creates a fresh environment; preserve request IDs and successful tool receipts instead of automatically retrying an unknown or failed answer.

Historical failures, measurements, cleanup and remaining coverage are preserved under **Project-Cortex** `_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/`. K25's exact database/container/private directories were independently verified absent; its launcher child exit remains UNKNOWN despite pipeline0. New runs record their own cleanup and process outcomes. Actual charges remain UNKNOWN; reservation ceilings are not charges. Optional graph and other unexecuted coverage must be reported separately.
