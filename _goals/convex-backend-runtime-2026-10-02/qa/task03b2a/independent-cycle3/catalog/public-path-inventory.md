# Task03A frozen public-path inventory

Classification only; no existing endpoint closure is claimed. JSON records per-path validators, indexes, risk flags, trusted scope/ownership, background checks and extension contracts.

{"modules":5,"registered":41,"public":36,"internal":5,"httpRoutes":0,"registeredBuilderCalls":41,"resolvedExports":41,"guard":36,"internalize":0}

All 41 AST-recognized registered builder calls resolve to exported endpoints. No HTTP routes or callbacks are registered in the configured baseline. Non-HTTP storage-upload completion handlers are included below.

| Endpoint | Builder | Required disposition | Capability | Canonical resource lookup |
|---|---|---|---|---|
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
