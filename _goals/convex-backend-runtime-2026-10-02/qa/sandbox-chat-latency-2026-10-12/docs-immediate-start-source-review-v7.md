# Task Judgment: immediate-start documentation v7

## Verdict: PASS — bounded documentation/source alignment

Independent non-author review, **4.2/5**, with **no actionable breaking findings**. This accepts the two current documentation files against the already accepted core source hashes. It does not accept native cloud compatibility, OCC, a latency improvement, an under-one-second SLO, publication or the full goal.

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement Fulfillment | 5/5 | Each requested v7 statement matches the accepted source; five retained pages preserve exact v6 hashes; saved build/render evidence reviewed within its limits. |
| Content Quality | 4/5 | Initialization, durable downstream work, returned failure state and status observer ownership are accurate and retain measurement qualifications. |
| Validation | 4/5 | Exit 0 build, current generated HTML markers for both pages, saved actual performance screenshot and coordinator two-page render receipt; no fresh reviewer browser run. |
| Pattern Adherence | 4/5 | Existing MDX layout, API terms, recovery guidance and separate response/memory semantics retained. |
| Completeness | 4/5 | Both targeted pages and saved evidence align; installed candidate qualification and final audit remain separate. |

## Source alignment

The performance page correctly places the original fresh Workflow initialization/context-barrier prefix inside admission through startAsync:false. The unchanged V4 still durably schedules its routing mutation, strict sleep and downstream context/model/tool Actions. Moving guarded work into admission can increase its read set or duration, so the explicit instruction to measure both admission and visible-text latency is appropriate. Historical journal versions remain unchanged.

The runtime-client page correctly warns that an initial failure may already be recorded on return. startExecution returns the actual execution state after Workflow initialization; the combined admission handler reads the current run after start, and the unchanged public parser accepts failed/unknown and other original state variants. The retained recovery guidance prohibits turning uncertainty into a new intent or blind automatic retry.

The performance observation paragraph matches the canonical component's retained continuously authorized finalOnly observer, which now supplies value.run status beside the text transport. It does not imply removal of final authorization or SDK delivery fences. The explicit product-target/installed-measurement/no-guarantee wording remains.

Current core hashes independently match the accepted joint gate:

| Core file | SHA-256 |
| --- | --- |
| convex-dev/runtimeAgent.ts | 1ec557cb9f652dc49ee932677bddf84ec6ea6494eaee78ed66919e18ef242089 |
| packages/vercel-ai-provider/quickstart/components/RuntimeQuickstart.tsx | 1e781488aa1c14b1bde5775766aa977357835045438ea6988993e6297212f528 |
| convex-dev/runtimeClient.ts | 544304c14c4fc69d3a1a9ff94fe561f13da33bbad2a715ec018c0758eb510ae0 |
| src/client-runtime/validation.ts | 2762b6e2f8e85c0871d3f9b5e9b406de35393fab2516ec93b93a0b8af24fcdf4 |

## Accepted documentation hashes

| File | Current SHA-256 | Accepted v6 SHA-256 |
| --- | --- | --- |
| docs-site/docs/architecture/performance.mdx | b13f9f390c286bd5969bf254c33b8e06cd64e2f807ec6575aa066741b6df9cac | ee82def42588418bda9538ee7fddcd30dedc7700c1512254b0d594688c859d15 |
| docs-site/docs/api-reference/runtime-client.mdx | a97b001914b4a0edef368ef532d8a93c051463cd9e6e0e08420c11e2b49769a5 | cd4bc5744bd4e2fda9acd426afb76923823c8e6020ef30ffa84e1b9aa3c5aac9 |

The other five reviewed pages match their v6 hashes exactly: model-policy, backend-runtime, five-minute-quickstart, installation and cli-reference. Removing the two newly added API sentences restores its exact v6 bytes. The performance review examines its current relevant paragraphs and retained qualifications directly; an unavailable prior preimage or inferred inverse is not counted as proof. Full seven-page and evidence hashes are in the companion JSON.

## Validation and limits

The raw v7 Docusaurus build records successful client/server compilation and static generation, and its exit receipt is 0. Its pre-existing stale Browserslist warning and Docusaurus update notice remain visible; successful build does not imply warning-free output. Current generated HTML contains the latest statements for both pages, including the target-is-not-a-guarantee qualification.

The saved actual performance screenshot was independently viewed and shows the new paragraph clearly. The coordinator receipt records actual rendering of both pages and zero warning/error entries in a sample limited to 100. That is scoped sampled browser evidence, not complete console-health proof; no separate saved API screenshot was inspected. No reviewer build, browser interaction, service start, inference, docs/product edit, publication or Git write occurred. Only these two review artifacts were written.

Prior latency failures remain failures. Continue the authorized candidate measurement and final audit; this documentation PASS supplies no native/OCC/SLO acceptance.
