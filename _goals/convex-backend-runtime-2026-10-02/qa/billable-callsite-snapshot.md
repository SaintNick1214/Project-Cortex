# Pending application inference paths

Read-only text-search snapshot of active source paths before the text/client/product
conversion. This is not an exhaustive AST call graph or a policy-coverage PASS.
Task04 defines admission; Tasks09/14/15 replace these application model loops with
governed backend operations. Task17 must verify the final reachable call graph.

| Active path | Observed inference | Required operation coverage |
|---|---|---|
| packages/vercel-ai-provider/quickstart/app/api/chat/route.ts | embed;streamText | Query/source embeddings and remote chat |
| packages/vercel-ai-provider/quickstart/app/api/chat-v6/route.ts | embed;streamText | Every reachable demo route must obey the same backend boundary |
| packages/cortex-cli/templates/chat-sdk-quickstart/lib/cortex-memory-config.ts | embed | Profile-pinned governed embeddings |
| packages/cortex-cli/templates/chat-sdk-quickstart/lib/ai/tools/request-suggestions.ts | streamText | Suggestion child operations |
| packages/cortex-cli/templates/chat-sdk-quickstart/artifacts/text/server.ts | Two streamText calls | Text artifact creation/update |
| packages/cortex-cli/templates/chat-sdk-quickstart/artifacts/sheet/server.ts | Two streamObject calls | Sheet artifact creation/update |
| packages/cortex-cli/templates/chat-sdk-quickstart/artifacts/code/server.ts | Two streamObject calls | Code artifact creation/update |
| packages/cortex-cli/templates/chat-sdk-quickstart/app/(chat)/api/chat/route.ts | streamText | Remote chat/tool execution |
| packages/cortex-cli/templates/chat-sdk-quickstart/app/(chat)/actions.ts | generateText | Conversation title |

The search found14 invocation sites across these files. Documentation examples,
interface declarations, tests, builds and generated mirrors are excluded from that
count. Provider low-level doGenerate/doStream delegation, SDK inference callbacks,
new backend calls and generated template mirrors still require the final call-graph
review. No provider call is grandfathered in by this snapshot.

Observed command: rg over src/, provider src/react/quickstart and the chat template,
matching generateText/streamText/generateObject/streamObject/embed/embedMany/image/video
invocations, with package locks/tests/builds/docs excluded from the classified count.
All classified paths remain pending implementation; no model was invoked by the search.
