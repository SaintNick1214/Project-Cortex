# Task05 implemented contract and approved C3 refinement

This is the functional Task05 implementation contract under acceptance-policy v2. It does not approve the goal or a later paid execution path. The accepted C3 flat TextSubmitV1, canonical scoped identity, exact budget composition and selected message pins remain mandatory.

## Canonical storage and admission

`runtimeTranscript` maps a stable scoped Cortex conversation to one private Agent component thread. Cortex stores metadata, exact native message/source/revision pins and rebuildable outbox records. It does not persist a second executable message history. Legacy managed `conversations`, `conversationShares` and `conversationSnapshots` calls route through the same mapping; old legacy rows are not migrated or silently adopted.

`runs.submit` accepts exactly `{version:1, agentId, agentVersion, conversationId?, clientRequestId, parts:[{type:'text',text}]}`. It validates the complete graph and Unicode before resolving scope or writes. Same scoped request identity and canonical input replay one run. A changed input conflicts. The parent mutation checks current authority/definition/conversation, invokes the existing `bindTrustedBudget` for `agent.respond`, saves one native user message with ordered text parts, registers its source/outbox and durable serialized queue, then schedules recovery. No model dispatch occurs in Task05.

Definitions are immutable scoped backend-owned versions in `runtimeAgentDefinitions`, separate from discovery. Current executable reads validate canonical hash, scope, ownership, revocation, registered tools/context and policy narrowing. The existing native policy hook reads this exact definition. It does not alter the existing budget signature or provider accounting/qualification.

## Approved correction of conservative C3 history fencing

The original C3 design used every change to conversation `historyRevision` as a conservative final fence, including future queued admission. Native evidence at `native-actual/queue-race-3-complete.stderr` and `native-actual/contextqueue-race-context.json` showed that claim A, submit B, then complete A fails `STALE_TRANSCRIPT` although A's exact selected prefix is unchanged. Root explicitly approved the functional refinement after that actual red.

Public `historyRevision` and read cursors still track every canonical change. A separate internal `executionRevision` tracks execution-invalidating manual/policy changes. The existing CutoffV1 `historyRevision` slot now binds this execution revision. On existing rows, it defaults to their current public revision until first updated; no legacy history is reconstructed.

Trusted queued submission and approval of a waiting run do not advance this internal fence. Waiting run inputs cannot already belong to an earlier claimed prefix. Approval still materializes the exact current source/revision and is pinned at its own later claim. Manual append/edit/delete, manual approval, visibility/policy changes and selected message revision/content changes still invalidate active work. Hydration rechecks every selected native ID, thread, role, position, approval, source event/revision and canonical hash; current grant/definition/epoch/attempt/lease are unchanged. Later B never widens A's cutoff. Completion registers A's exact same-order later native output once; B subsequently claims the complete eligible prefix containing A's registered output.

`runs.claimNext` uses three bounded indexed queue-head probes, rather than collecting retained completed history. Context overflow becomes observable `failed`/`CONTEXT_LIMIT_EXCEEDED`, retires its outbox and schedules recovery. Cancelled or expired attempts retire their queue/attempt records and cannot attach later outputs. Expiry is `LEASE_EXPIRED_REQUIRES_RECONCILIATION`, not automatic retry of potentially paid work. Task07 must preserve this distinction when adding execution.

## Manual writes, source eligibility and privacy

Conversations default locked. Scoped administration changes the lock/policy; reads remain authorized. Unlocked append/edit/remove uses the same native store and tracks the actor/source revision. Source-origin fences check the current managed conversation, exact bridge and approval/revision/hash across repository reads, fact/vector hydration, source witness and derived commit paths. Deletion/retention/revocation excludes data immediately, before paged physical cleanup.

Conversation deletion tombstones scope/epoch now and schedules bounded native/Cortex pages. It records the authorized deletion actor reference so later grant revocation cannot resurrect or strand already authorized cleanup. Returned `cleanup:'scheduled'` and zero immediate `messagesDeleted` are honest physical progress, not a false atomic delete claim.

Explicit fork creates a different scoped conversation/thread and its own registered sources. Multi-page reads, cutoff, fork and projection rebuild traverse beyond 100 native rows. Missing/deleted anchors or same-order later steps never broaden dispatch context. Public results/export/snapshots allowlist text, status, parts and permitted metadata, excluding instructions, provider fields, private reasoning and credentials. Snapshots persist exact metadata pins only and hydrate current native messages; tracked edits/deletion make those pins stale.

## Sharing and supported options

Sharing narrows existing current JWT/scope/resource authority. Supported paths are authenticated user/same-space shares, exact permissions, expiry and revocation. Snapshot text delivery applies the same current `canExport` permission as transcript export, including snapshots created earlier by the owner. A read-only share cannot obtain text through an existing owner's snapshot.

Requested `maxViews` is explicitly unsupported: `conversationShares.create` returns static `CAPABILITY_UNAVAILABLE` before persisting a share because query reads cannot atomically consume a view session. Anonymous links/domain shares/custom share redaction and snapshot facts/memories/custom regex options also remain explicit unavailable boundaries. No view-limited-sharing completion is claimed. These optional selectors do not replace the implemented ordinary sharing paths.

Manual system/tool messages are denied; ordinary assistant text remains `assistant_claim`. Task07 owns actual trusted tool/model execution integration and must not promote arbitrary text to verified tool or durable factual authority. Task08 owns later ingestion/index barriers. These are the original task boundaries, not new controller prerequisites.

## Preserved failure observations

The native initial deploy typecheck found ES2022 helpers incompatible with the host ES2021 configuration. Narrow `hasOwnProperty.call` and array-index equivalents repaired those uses; host tsconfig was preserved. An intermediate private copy combined mismatched source/schema files and was recopied coherently. The ordinary queue `STALE_TRANSCRIPT` red above is preserved.

Independent snapshot export-permission and unenforced view-limit reds remain in `task05-product-independent-review1`; their original unchanged oracles now pass. Author affected1 recorded two legitimate old fixtures: compiled-only agent specialization lacked a current executable definition, and a schema-total assertion omitted nine new tables. The updated fixture validates an owned definition and retains exact original 31 table names plus the nine additions and index uniqueness. The affected2 run used three nonexistent file names (setup failure); affected3 reran the exact affected1 path set. Prior controlled-fixture/typing failures remain in their original raw logs. Native fixture-specific assertion corrections, including a deleted event not creating an additional eligible outbox, are kept by the native executor.

Final implementation acceptance depends on the coherent current native outcomes, owned target retirement and the single non-author review. Source/custody/controller certification is retired under policy v2.
