# Task09A browser SDK and remote transport

Implemented `@cortexmemory/sdk/runtime` and `@cortexmemory/vercel-ai-provider/remote`. The browser client uses the official Convex auth callback, verified session selectors and immutable server run identities. Every asynchronous result checks the captured principal, scope and auth generation before delivery.

The AI SDK7 transport submits only the last ordered user text with a stable request ID. It reconstructs attempt-scoped cursor output, replaces partial text with canonical final text, and withholds cached text until current evidence authorization. Disconnect closes only the local observer; stop cancels the server run. Input/tool approvals are explicit server operations and public data chunks; there is no app-side model/tool/remember loop.

**Validation:**51 unique controlled Jest cases passed (SDK30/provider21);4 browser/package conditions passed. The8-case affected typing replay adds no unique assertions. SDK/provider types, scoped lint, ordinary ESM/CJS/declaration builds, backend distribution and established packed public contracts passed. Six lint warnings remain, zero errors. Two independent delivery-race oracles passed unchanged after repair.

`command-receipts1.json`, raw Jest outputs and `coherent-build-handoff1.json` contain the exact checks and build pins. Early setup/typing/oracle failures remain separate. No author model/service effects occurred.

OriginalTask09 acceptance still depends on the shared live JWT/browser/native batch: governed recall/tool/final, observers/reconnect, delayed indexing and strict/pending context behavior. This report makes no full-task or functional-goal acceptance claim. Product source writers in this lane are stopped pending concrete findings; Root owns trackers and final integration.
