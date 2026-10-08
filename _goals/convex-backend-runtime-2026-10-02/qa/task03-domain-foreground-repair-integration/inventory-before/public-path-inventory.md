# Task03A frozen public-path inventory

Classification only; no existing endpoint closure is claimed. JSON records per-path validators, indexes, risk flags, trusted scope/ownership, background checks and extension contracts.

{"modules":34,"registered":259,"public":200,"internal":59,"httpRoutes":0,"registeredBuilderCalls":259,"resolvedExports":259,"guard":200,"internalize":0}

All 259 AST-recognized registered builder calls resolve to exported endpoints. No HTTP routes or callbacks are registered in the configured baseline. Non-HTTP storage-upload completion handlers are included below.

| Endpoint | Builder | Required disposition | Capability | Canonical resource lookup |
|---|---|---|---|---|
| `a2a:send` | mutation | guard | write | conversationId -> canonical tenant and both participating memory spaces; both source and recipient grants |
| `a2a:request` | mutation | guard | write | conversationId -> canonical tenant and both participating memory spaces; both source and recipient grants |
| `a2a:broadcast` | mutation | guard | write | conversationId -> canonical tenant and both participating memory spaces; both source and recipient grants |
| `a2a:getConversation` | query | guard | read | conversationId -> canonical tenant and both participating memory spaces; both source and recipient grants |
| `admin:listTable` | internalQuery | retain-internal | trusted deployment-operator internal invocation | allowlisted Cortex table selector -> deployment-wide rows for trusted operator inspection |
| `admin:deleteRecord` | internalMutation | retain-internal | trusted deployment-operator internal invocation | allowlisted Cortex table and exact record ID -> operator maintenance target and owned references |
| `admin:clearTable` | internalMutation | retain-internal | trusted deployment-operator internal invocation | allowlisted Cortex table selector -> deployment-wide batch maintenance targets and owned references |
| `admin:countTable` | internalQuery | retain-internal | trusted deployment-operator internal invocation | allowlisted Cortex table selector -> deployment-wide count for trusted operator inspection |
| `admin:getAllCounts` | internalQuery | retain-internal | trusted deployment-operator internal invocation | fixed allowlisted Cortex tables -> deployment-wide counts for trusted operator inspection |
| `agents:get` | query | guard | admin | (trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority |
| `agents:exists` | query | guard | admin | (trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority |
| `agents:list` | query | guard | admin | (trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority |
| `agents:count` | query | guard | admin | (trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority |
| `agents:register` | mutation | guard | admin | (trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority |
| `agents:update` | mutation | guard | admin | (trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority |
| `agents:updateMany` | mutation | guard | admin | (trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority |
| `agents:unregister` | mutation | guard | admin | (trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority |
| `agents:unregisterMany` | mutation | guard | admin | (trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority |
| `agents:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | agents deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `agents:computeStats` | query | guard | admin | (trusted tenantId, agentId); immutable deployed configuration version; metadata is not authority |
| `artifacts:create` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:update` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:deleteArtifact` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:undo` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:redo` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:setStreamingState` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:setFileRef` | internalMutation | retain-internal | storage:write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:purgeVersions` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | artifacts deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `artifacts:get` | query | guard | read | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:getByConversation` | query | guard | read | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:list` | query | guard | read | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:count` | query | guard | read | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:getVersion` | query | guard | read | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:getHistory` | query | guard | read | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:startStreaming` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:appendContent` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:pauseStreaming` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:resumeStreaming` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:cancelStreaming` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:finalizeStreaming` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:setStreamingError` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:retryFromError` | mutation | guard | write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:generateArtifactUploadUrl` | internalMutation | retain-internal | storage:write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:completeArtifactUpload` | mutation | guard | storage:write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:getArtifactFileUrl` | internalQuery | retain-internal | storage:read | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `artifacts:detachFile` | mutation | guard | storage:write | (trusted tenantId, memorySpaceId, artifactId); current artifact/version, linked conversation and owned storage receipt |
| `attachments:generateUploadUrl` | internalMutation | retain-internal | storage:write | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `attachments:attach` | mutation | guard | storage:write | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `attachments:remove` | mutation | guard | storage:write | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `attachments:removeMany` | mutation | guard | storage:write | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `attachments:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | attachments deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `attachments:get` | query | guard | read | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `attachments:getUrl` | internalQuery | retain-internal | storage:read | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `attachments:list` | query | guard | read | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `attachments:count` | query | guard | read | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `attachments:getByIds` | query | guard | read | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `attachments:getByConversation` | query | guard | read | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `attachments:getByMessage` | query | guard | read | (trusted tenantId, memorySpaceId, attachmentId); owned upload receipt and every linked resource |
| `contexts:create` | mutation | guard | write | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:update` | mutation | guard | write | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:addParticipant` | mutation | guard | write | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:removeParticipant` | mutation | guard | write | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:grantAccess` | mutation | guard | write | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:deleteContext` | mutation | guard | write | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:updateMany` | mutation | guard | write | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:deleteMany` | mutation | guard | write | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:get` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:list` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:search` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:count` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:getChain` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:getRoot` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:getChildren` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:getByConversation` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:findOrphaned` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:getVersion` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:getHistory` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:getAtTimestamp` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:exportContexts` | query | guard | read | (trusted tenantId, memorySpaceId, contextId); parent/root/children/participants and every cross-space link |
| `contexts:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | contexts deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `conversationShares:create` | mutation | guard | write | shareId -> canonical scoped conversation/source space; grant actor, expiry, revocation and redaction policy |
| `conversationShares:revoke` | mutation | guard | write | shareId -> canonical scoped conversation/source space; grant actor, expiry, revocation and redaction policy |
| `conversationShares:incrementViewCount` | internalMutation | retain-internal | write | shareId -> canonical scoped conversation/source space; grant actor, expiry, revocation and redaction policy |
| `conversationShares:get` | query | guard | read | shareId -> canonical scoped conversation/source space; grant actor, expiry, revocation and redaction policy |
| `conversationShares:listByConversation` | query | guard | read | shareId -> canonical scoped conversation/source space; grant actor, expiry, revocation and redaction policy |
| `conversationShares:listByGranter` | query | guard | read | shareId -> canonical scoped conversation/source space; grant actor, expiry, revocation and redaction policy |
| `conversationShares:checkAccess` | query | guard | read | shareId -> canonical scoped conversation/source space; grant actor, expiry, revocation and redaction policy |
| `conversationSnapshots:create` | mutation | guard | write | snapshotId -> canonical scoped conversation; snapshot creator binding |
| `conversationSnapshots:deleteSnapshot` | mutation | guard | write | snapshotId -> canonical scoped conversation; snapshot creator binding |
| `conversationSnapshots:get` | query | guard | read | snapshotId -> canonical scoped conversation; snapshot creator binding |
| `conversationSnapshots:listByConversation` | query | guard | read | snapshotId -> canonical scoped conversation; snapshot creator binding |
| `conversationSnapshots:listByUser` | query | guard | read | snapshotId -> canonical scoped conversation; snapshot creator binding |
| `conversations:create` | mutation | guard | write | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:setVisibility` | mutation | guard | write | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:setMetadata` | mutation | guard | write | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:checkAccess` | query | guard | read | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:addMessage` | mutation | guard | write | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:approveMessage` | mutation | guard | write | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:rejectMessage` | mutation | guard | write | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:deleteConversation` | mutation | guard | write | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:deleteMany` | mutation | guard | write | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:deleteByIds` | mutation | guard | write | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | conversations deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `conversations:getMessage` | query | guard | read | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:getMessagesByIds` | query | guard | read | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:getOrCreate` | mutation | guard | write | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:findConversation` | query | guard | read | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:get` | query | guard | read | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:list` | query | guard | read | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:count` | query | guard | read | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:getHistory` | query | guard | read | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:search` | query | guard | read | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `conversations:exportConversations` | query | guard | read | (trusted tenantId, memorySpaceId, conversationId); canonical participant/owner + transcript revision |
| `factHistory:logEvent` | internalMutation | retain-internal | write | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `factHistory:deleteByFactId` | internalMutation | retain-internal | write | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `factHistory:deleteByUserId` | internalMutation | retain-internal | write | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `factHistory:deleteByMemorySpace` | internalMutation | retain-internal | write | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `factHistory:purgeOldEvents` | internalMutation | retain-internal | write | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `factHistory:getHistory` | query | guard | read | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `factHistory:getEvent` | query | guard | read | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `factHistory:getChangesByTimeRange` | query | guard | read | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `factHistory:countByAction` | query | guard | read | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `factHistory:getSupersessionChain` | query | guard | read | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `factHistory:getActivitySummary` | query | guard | read | eventId/factId -> canonical fact tenant + space; join authoritative fact/source before historical reads |
| `facts:store` | mutation | guard | write | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:update` | mutation | guard | write | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:deleteFact` | mutation | guard | write | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:supersede` | mutation | guard | write | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:updateInPlace` | mutation | guard | write | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:deleteMany` | mutation | guard | write | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:get` | query | guard | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:list` | query | guard | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:count` | query | guard | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:search` | query | guard | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:fetchFactsByIds` | internalQuery | retain-internal | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:semanticSearch` | action | guard | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:getHistory` | query | guard | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:queryBySubject` | query | guard | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:queryByRelationship` | query | guard | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:exportFacts` | query | guard | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:consolidate` | mutation | guard | write | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:findByStructure` | query | guard | read | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:deleteByIds` | mutation | guard | write | (trusted tenantId, memorySpaceId, factId); supersession peers and source revisions |
| `facts:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | facts deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `governance:setPolicy` | mutation | guard | admin | trusted tenant + scope -> policy/enforcement; add tenant ownership for currently unscoped policy rows |
| `governance:setAgentOverride` | mutation | guard | admin | trusted tenant + scope -> policy/enforcement; add tenant ownership for currently unscoped policy rows |
| `governance:getPolicy` | query | guard | admin | trusted tenant + scope -> policy/enforcement; add tenant ownership for currently unscoped policy rows |
| `governance:getTemplate` | query | guard | admin | trusted tenant + scope -> policy/enforcement; add tenant ownership for currently unscoped policy rows |
| `governance:simulate` | query | guard | admin | trusted tenant + scope -> policy/enforcement; add tenant ownership for currently unscoped policy rows |
| `governance:enforce` | internalMutation | retain-internal | admin | trusted tenant + scope -> policy/enforcement; add tenant ownership for currently unscoped policy rows |
| `governance:getComplianceReport` | query | guard | admin | trusted tenant + scope -> policy/enforcement; add tenant ownership for currently unscoped policy rows |
| `governance:getEnforcementStats` | query | guard | admin | trusted tenant + scope -> policy/enforcement; add tenant ownership for currently unscoped policy rows |
| `governance:purgeAllPolicies` | internalMutation | retain-internal | trusted deployment-operator internal invocation | governance deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `governance:purgeAllEnforcement` | internalMutation | retain-internal | trusted deployment-operator internal invocation | governance deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `graphSync:queueForSync` | internalMutation | retain-internal | tool | queueItem -> canonical tenant/space/source + stored authority reference; authorize worker reads and projection commits |
| `graphSync:markSynced` | internalMutation | retain-internal | tool | queueItem -> canonical tenant/space/source + stored authority reference; authorize worker reads and projection commits |
| `graphSync:markFailed` | internalMutation | retain-internal | tool | queueItem -> canonical tenant/space/source + stored authority reference; authorize worker reads and projection commits |
| `graphSync:deleteSyncItem` | internalMutation | retain-internal | tool | queueItem -> canonical tenant/space/source + stored authority reference; authorize worker reads and projection commits |
| `graphSync:getUnsyncedItems` | internalQuery | retain-internal | tool | queueItem -> canonical tenant/space/source + stored authority reference; authorize worker reads and projection commits |
| `graphSync:getHighPriorityItems` | internalQuery | retain-internal | tool | queueItem -> canonical tenant/space/source + stored authority reference; authorize worker reads and projection commits |
| `graphSync:getFailedItems` | internalQuery | retain-internal | tool | queueItem -> canonical tenant/space/source + stored authority reference; authorize worker reads and projection commits |
| `graphSync:getSyncStats` | internalQuery | retain-internal | tool | queueItem -> canonical tenant/space/source + stored authority reference; authorize worker reads and projection commits |
| `graphSync:clearSyncedItems` | internalMutation | retain-internal | tool | queueItem -> canonical tenant/space/source + stored authority reference; authorize worker reads and projection commits |
| `graphSync:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | graphSync deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `immutable:store` | mutation | guard | write | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:get` | query | guard | read | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:getVersion` | query | guard | read | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:getHistory` | query | guard | read | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:getAtTimestamp` | query | guard | read | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:list` | query | guard | read | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:count` | query | guard | read | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:search` | query | guard | read | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:purge` | mutation | guard | write | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:purgeMany` | mutation | guard | write | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:purgeVersions` | mutation | guard | write | (trusted tenantId, type, id); every requested version uses the same trusted scope |
| `immutable:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | immutable deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `memories:store` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:storePartialMemory` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:updatePartialMemory` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:finalizePartialMemory` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:deleteMemory` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:get` | query | guard | read | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:fetchMemoriesByIds` | internalQuery | retain-internal | read | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:keywordSearchMemories` | internalQuery | retain-internal | read | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:search` | action | guard | read | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:list` | query | guard | read | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:count` | query | guard | read | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:update` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:getVersion` | query | guard | read | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:getHistory` | query | guard | read | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:deleteMany` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:deleteByIds` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | memories deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `memories:exportMemories` | query | guard | read | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:updateMany` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:archive` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:restoreFromArchive` | mutation | guard | write | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memories:getAtTimestamp` | query | guard | read | (trusted tenantId, memorySpaceId, memoryId); source/current version for history/search |
| `memorySpaces:register` | mutation | guard | admin | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:update` | mutation | guard | admin | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:addParticipant` | mutation | guard | admin | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:removeParticipant` | mutation | guard | admin | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:archive` | mutation | guard | admin | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:reactivate` | mutation | guard | admin | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:updateParticipants` | mutation | guard | admin | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:deleteSpace` | mutation | guard | admin | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:get` | query | guard | read | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:list` | query | guard | read | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:count` | query | guard | read | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:findByParticipant` | query | guard | read | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:search` | query | guard | read | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `memorySpaces:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | memorySpaces deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `memorySpaces:getStats` | query | guard | read | (trusted tenantId, memorySpaceId); participant metadata never a membership grant |
| `mutable:set` | mutation | guard | write | (trusted tenantId, namespace, key); every transaction/purge member checked before effect |
| `mutable:update` | mutation | guard | write | (trusted tenantId, namespace, key); every transaction/purge member checked before effect |
| `mutable:get` | query | guard | read | (trusted tenantId, namespace, key); every transaction/purge member checked before effect |
| `mutable:exists` | query | guard | read | (trusted tenantId, namespace, key); every transaction/purge member checked before effect |
| `mutable:list` | query | guard | read | (trusted tenantId, namespace, key); every transaction/purge member checked before effect |
| `mutable:count` | query | guard | read | (trusted tenantId, namespace, key); every transaction/purge member checked before effect |
| `mutable:deleteKey` | mutation | guard | write | (trusted tenantId, namespace, key); every transaction/purge member checked before effect |
| `mutable:purgeMany` | mutation | guard | write | (trusted tenantId, namespace, key); every transaction/purge member checked before effect |
| `mutable:purgeNamespace` | mutation | guard | write | (trusted tenantId, namespace, key); every transaction/purge member checked before effect |
| `mutable:transaction` | mutation | guard | write | (trusted tenantId, namespace, key); every transaction/purge member checked before effect |
| `mutable:purgeAll` | internalMutation | retain-internal | trusted deployment-operator internal invocation | mutable deployment-wide Cortex records and owned references; retain lifecycle/tombstone fences and reference-aware cleanup |
| `runtimeAuth:authorize` | internalQuery | retain-internal | requirement.capability | exact verified issuer/subject -> principal, membership, grant, scope epochs and optional canonical resource |
| `runtimeAuth:recheck` | internalQuery | retain-internal | requirement.capability | exact trusted persisted authority reference -> current control records and optional canonical resource/tombstone |
| `runtimeAuth:provision` | internalMutation | retain-internal | trusted deployment-operator internal invocation | exact operator-supplied issuer/subject -> principal, tenant membership, scope records and immutable grant generation |
| `runtimeAuth:revokeGrant` | internalMutation | retain-internal | trusted deployment-operator internal invocation | exact target grant ID -> retained grant revocation fence, including already revoked/deleted target |
| `runtimeAuth:revokeMembership` | internalMutation | retain-internal | trusted deployment-operator internal invocation | exact target membership ID -> retained membership revocation/version fence, including already revoked/deleted target |
| `runtimeAuth:deletePrincipal` | internalMutation | retain-internal | trusted deployment-operator internal invocation | exact target principal ID -> retained principal deletion/version fence, including already revoked/deleted target |
| `runtimeAuth:deleteScope` | internalMutation | retain-internal | trusted deployment-operator internal invocation | exact tenantId and optional memorySpaceId -> scope epoch/deletion fence and idempotent tombstone, including absent/deleted target |
| `runtimeAuth:tombstoneResource` | internalMutation | retain-internal | trusted deployment-operator internal invocation | exact tenantId, optional memorySpaceId, resourceType and resourceId -> idempotent retained resource tombstone |
| `runtimeMemory:checkAuthority` | internalQuery | retain-internal | validated requested read/write capability | trusted concrete tenant/space; pinned principal/grant source revision/profile; current source/derived lineage |
| `runtimeMemory:readSource` | internalQuery | retain-internal | read | trusted concrete tenant/space; pinned principal/grant source revision/profile; current source/derived lineage |
| `runtimeMemory:writeSource` | internalMutation | retain-internal | write | trusted concrete tenant/space; pinned principal/grant source revision/profile; current source/derived lineage |
| `runtimeMemory:writeDerived` | internalMutation | retain-internal | write | trusted concrete tenant/space; pinned principal/grant source revision/profile; current source/derived lineage |
| `runtimeMemory:readFacts` | internalQuery | retain-internal | read | trusted concrete tenant/space; pinned principal/grant source revision/profile; current source/derived lineage |
| `runtimeMemory:readVectorMatches` | internalQuery | retain-internal | read | trusted concrete tenant/space; pinned principal/grant source revision/profile; current source/derived lineage |
| `runtimeMemory:remember` | action | guard | write | trusted concrete tenant/space; pinned principal/grant source revision/profile; current source/derived lineage |
| `runtimeMemory:recall` | action | guard | read | trusted concrete tenant/space; pinned principal/grant source revision/profile; current source/derived lineage |
| `sessions:create` | mutation | guard | write | sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner |
| `sessions:get` | query | guard | read | sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner |
| `sessions:touch` | mutation | guard | write | sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner |
| `sessions:end` | mutation | guard | write | sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner |
| `sessions:endAll` | mutation | guard | write | sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner |
| `sessions:list` | query | guard | read | sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner |
| `sessions:count` | query | guard | read | sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner |
| `sessions:incrementMessageCount` | internalMutation | retain-internal | write | sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner |
| `sessions:incrementMemoryCount` | internalMutation | retain-internal | write | sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner |
| `sessions:expireIdle` | internalMutation | retain-internal | write | sessionId -> trusted tenant, optional space and bound principal; userId cannot select another owner |
| `users:get` | query | guard | read | (trusted tenantId, immutable type=user, bound metadataUserId); owner binding or explicit cross-principal grant |
| `users:list` | query | guard | read | (trusted tenantId, immutable type=user, bound metadataUserId); owner binding or explicit cross-principal grant |
| `users:count` | query | guard | read | (trusted tenantId, immutable type=user, bound metadataUserId); owner binding or explicit cross-principal grant |
| `users:getVersion` | query | guard | read | (trusted tenantId, immutable type=user, bound metadataUserId); owner binding or explicit cross-principal grant |
| `users:getHistory` | query | guard | read | (trusted tenantId, immutable type=user, bound metadataUserId); owner binding or explicit cross-principal grant |
| `users:getAtTimestamp` | query | guard | read | (trusted tenantId, immutable type=user, bound metadataUserId); owner binding or explicit cross-principal grant |
| `users:exists` | query | guard | read | (trusted tenantId, immutable type=user, bound metadataUserId); owner binding or explicit cross-principal grant |
| `users:deleteUserProfile` | mutation | guard | write | (trusted tenantId, immutable type=user, bound metadataUserId); owner binding or explicit cross-principal grant |
