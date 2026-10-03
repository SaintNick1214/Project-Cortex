# Bounded memories/facts closure catalog

39 baseline public paths +3 existing internal helpers;37 public remain and2 operator purges become internal.42 actual AST registrations,42 resolved exports,0 unresolved.

| Path | Visibility | Guard | Scoped helpers |
|---|---|---|---|
| memories:store | public | requireDataAuthority | rejectUnqualifiedEmbedding, assertDataLinks, manualDataSource, memoryMutationResult |
| memories:storePartialMemory | public | requireDataAuthority | assertDataLinks, manualDataSource, getScopedMemory |
| memories:updatePartialMemory | public | requireDataAuthority | getScopedMemory, reviseDataSource |
| memories:finalizePartialMemory | public | requireDataAuthority | rejectUnqualifiedEmbedding, getScopedMemory, reviseDataSource |
| memories:deleteMemory | public | requireDataAuthority | getScopedMemory, tombstoneDataRow |
| memories:get | public | requireDataAuthority | getScopedMemory |
| memories:fetchMemoriesByIds | internal | recheckDataAuthority | getScopedMemoryDocument, finalizeDataRead |
| memories:keywordSearchMemories | internal | recheckDataAuthority | searchScopedMemories |
| memories:search | public | requireActionDataAuthority | rejectUnqualifiedEmbedding, recheckActionDataAuthority |
| memories:list | public | requireDataAuthority | listScopedMemories |
| memories:count | public | requireDataAuthority | listScopedMemories |
| memories:update | public | requireDataAuthority | rejectUnqualifiedEmbedding, getScopedMemory, reviseDataSource, memoryMutationResult |
| memories:getVersion | public | requireDataAuthority | getScopedMemory |
| memories:getHistory | public | requireDataAuthority | getScopedMemory |
| memories:deleteMany | public | requireDataAuthority | listScopedMemories, canReadMutationRows, tombstoneDataRow, finalizeMutationRowsRead |
| memories:deleteByIds | public | requireDataAuthority | getScopedMemory, prepareMutationRowsWrite, tombstoneDataRow, finalizeMutationRowsRead |
| memories:purgeAll | internal | deployment-operator internal invocation |  |
| memories:exportMemories | public | requireDataAuthority | listScopedMemories |
| memories:updateMany | public | requireDataAuthority | listScopedMemories, canReadMutationRows |
| memories:archive | public | requireDataAuthority | getScopedMemory |
| memories:restoreFromArchive | public | requireDataAuthority | getScopedMemory, memoryMutationResult |
| memories:getAtTimestamp | public | requireDataAuthority | getScopedMemory |
| facts:store | public | requireDataAuthority | rejectUnqualifiedEmbedding, assertDataLinks, manualDataSource, factMutationResult |
| facts:update | public | requireDataAuthority | rejectUnqualifiedEmbedding, getScopedFact, reviseDataSource, factMutationResult |
| facts:deleteFact | public | requireDataAuthority | getScopedFact, tombstoneDataRow |
| facts:supersede | public | requireDataAuthority | getScopedFact, recheckSourceWitnesses, assertDataRow |
| facts:updateInPlace | public | requireDataAuthority | getScopedFact, reviseDataSource, factMutationResult |
| facts:deleteMany | public | requireDataAuthority | listScopedFacts, prepareMutationRowsWrite, tombstoneDataRow, finalizeMutationRowsRead |
| facts:get | public | requireDataAuthority | getScopedFact |
| facts:list | public | requireDataAuthority | listScopedFacts |
| facts:count | public | requireDataAuthority | listScopedFacts |
| facts:search | public | requireDataAuthority | searchScopedFacts |
| facts:fetchFactsByIds | internal | recheckDataAuthority | getScopedFactDocument, finalizeDataRead |
| facts:semanticSearch | public | requireActionDataAuthority | recheckActionDataAuthority, rejectUnqualifiedEmbedding |
| facts:getHistory | public | requireDataAuthority | getHistoricalScopedFact, finalizeDataRead |
| facts:queryBySubject | public | requireDataAuthority | listScopedFacts |
| facts:queryByRelationship | public | requireDataAuthority | listScopedFacts |
| facts:exportFacts | public | requireDataAuthority | listScopedFacts |
| facts:consolidate | public | requireDataAuthority | getScopedFact, recheckSourceWitnesses, assertDataRow |
| facts:findByStructure | public | requireDataAuthority | listScopedFacts |
| facts:deleteByIds | public | requireDataAuthority | getScopedFact, prepareMutationRowsWrite, tombstoneDataRow, finalizeMutationRowsRead |
| facts:purgeAll | internal | deployment-operator internal invocation |  |
