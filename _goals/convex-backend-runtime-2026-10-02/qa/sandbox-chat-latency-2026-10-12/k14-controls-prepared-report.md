# K14 native controls prepared; no service calls

Three new controls were copied from the accepted K13 controls without overwriting their source or receipts:

- `verify-k14-four-run-memory-readonly.mjs`: one strict proof for browser-first, browser-warm, CLI-first and CLI-warm, in that order.
- `capture-k14-financial-metadata.mjs`: one bounded financial snapshot when separately authorized.
- `verify-k14-cleanup.mjs`: fresh exact management/container/private-directory ABSENT checks after separately authorized cleanup.

Only generation/session/image/output labels and deliberately unready target/run pins were substituted. The same original fact/vector/native complete-usage/profile/current-authority/provenance assertions and contiguous sequence checks through 2/4/6/8 remain. Native table pages are fixed at 256, must be complete in one page, and retain the 30,000ms timeout. The memory helper freshly verifies the exact owned target before and after each bounded read, keeps private prompts/results/facts/vectors/credentials in memory, and closes the native client. Financial ceilings remain UNKNOWN ceilings rather than actual charges. None of these collectors performs inference or a paid retry.

Prepared identity: session `e07fd8cd-4f0b-4ceb-833c-15b167bda97f`, source `8917f3250fc50aa7f30f5cd727aaf279709a2ef2`, image `sha256:f1b4bb13bf023ed2851f0bca5c9da2a18eca1e7010daee7eeaef730978d56406`, team 325340/project 3200658, reference `dev/cortex-sandbox-e07fd8cd-4f0b-4ceb-833c-15b167bda97f`.

Before invocation, root must supply the READY exact deployment name, ID, expiry and image confirmation. Four distinct exact run IDs must replace the deliberate `UNREADY_K14_*` run interlocks. The memory command requires `SESSION NAME ID BROWSER_FIRST BROWSER_WARM CLI_FIRST CLI_WARM` and `CORTEX_K14_MEMORY_TURN_COMPLETE_CONFIRMED=1`, set only after root explicitly reports all-four COMPLETE/GO. Root owns READY34/WARM34/CLI34/CLW34 submission/timing. Finance takes `SESSION RUN_ID NAME ID`; cleanup takes no arguments and refuses unless the exact session is CLEANED. Finance and cleanup each require their own root authorization.

Use pinned Node24.15.0 with the existing root tsx loader for the memory helper; the other two helpers are plain ESM. All three `node --check` invocations exit 0 with no output. Original K13 helper hashes are unchanged. Service calls, mutations and inference calls during preparation: **0**. Exact original/prepared hashes and input requirements are in `k14-controls-prepared.json`. The unready placeholders intentionally refuse operation; no runtime PASS or SLO claim is made.
