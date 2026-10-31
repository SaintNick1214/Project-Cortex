# K20 whole-path packaging

Packaging is complete for accepted local source `53421e78165fb12a16a11faa19db9372fa8ddfd4`. Three isolated builds, four archive packs, all four actual packed-consumer groups and one Linux/arm64 image build each ran once and exited 0 under Node 24.15.0 / npm 12.2.0. No runtime container, cloud target or inference call was started.

The fresh kit is `/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-whole-path-2026-10-14`. It was created from only the four K19 controls. Historical kits, archives and receipts were preserved. The original preparation receipt remains unchanged; the explicit committed pin substitutions are recorded in `packaging-input-pins.json`.

Actual SDK root/runtime/graph and provider core/react/remote ESM, CJS, declarations and browser execution passed. Packed CLI version/help passed with Commander 15. The packed backend checked 159 paths, 73 tables, two components and 16 purposeful source/export roots, including fresh V7 and private recall registrations while retaining historical registrations. All 2,216 build inputs match the accepted Git commit, current source and staging; all 159 backend output hashes and both copies of all four archives match. All owned consumer scratch was removed.

Catalog 1.3.2 contains the verified 74-file Vercel 1.4.2 payload and retains all 13 prior immutable catalog tuples. Basic remains 1.4.1; SDK, CLI and provider remain 0.39.0. The consumer catalog check establishes package bytes and wiring; it does not establish a new live browser deployment.

| Pin | SHA-256 |
| --- | --- |
| Image (`cortex-sandbox-whole-path:20261014`) | `sha256:77a412842714f4ce2e4d44a2b4abe5472185c9bd0be87d1707ec947708c9199d` |
| Backend manifest | `b876e82f260092d7c1413159c150b6df3a5aa7a3e1312953b4b03b52f3eb1dea` |
| Archive/artifact manifest | `9e9fac124a65281e261b1d973ee2aa64a328d1f7d9a502cf7a39924da3605af2` |
| cortexmemory-sdk-0.39.0.tgz | `772a220599591477e9e1ab2c28b446b99f95ee0ad56a443d99b436547552559a` |
| cortexmemory-cli-0.39.0.tgz | `2fef802c7662cf4e32df3d146505a02cee3614a966655a71ae3ee9627a9d72e5` |
| cortexmemory-vercel-ai-provider-0.39.0.tgz | `8580c09b900454a505e408512d367c3b048eb2ede68bb43797019a0225d74f53` |
| cortexmemory-templates-1.3.2.tgz | `f34185052f71305fc9c308b67bcb36ea600002d036293d1b2091dc72c0407c97` |

Fresh Docker inspection confirms Linux/arm64, user `sandbox`, UID 501 / GID 20 kit identity, `/work`, the original Node entrypoint and exact source/path/UUID labels. Identity UUID: `67f43551-df25-4fbf-9d4d-8b28807ef10e`.

Evidence: `prepare-v1.log` / `prepare-v1-exit.json`, four `*-v1.log` / `*-exit.json` consumer pairs, `docker-build-v1.log` / `docker-build-exit.json`, `docker-image-identity.json`, `final-source-artifact-verification.json` and `packaging-final-receipt.json`. All commands succeeded on their first invocation; no failed command was retried.

This is packaging evidence. Fresh hosted qualification, functional continuation evidence and the one-second latency goal remain unaccepted by this packet. Root owns prospective launcher sealing and the next disposable qualification.
