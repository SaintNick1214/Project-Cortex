# C2 native interface freeze

C1 native-api.md remains authoritative for exact Args/Result/receipt/storage shapes: no validator, registration, schema, bootstrap, exported interface or byte limit changed. Current registration inventory remains fourteen internal functions. This repair strengthens admission/checkpoint behavior only. Hash authority is final-source-evidence.json.

Fresh fallback admission and checkFallback require safe stored proof AND explicit compatible fallback permission under both pinned and current resolved policy. checkpoint of an already reserved fallback rechecks its exact prior attempt, operation and child identity, safe stored proof, and current compatible fallback authorization. Generally allowed model membership does not confer fallback permission.

Fresh fallback cumulative operation liability including new K must fit min(pinned,current) operation cap. Dispatch checkpoint compares already-held aggregate reserved+uncertain+settled operation/run/tenant money and active concurrency against min(pinned,current,persisted-account) bounds, without adding held K/slot again. A narrower policy never releases/erases old liability; denial precedes writes/token/provider activity. Existing source/parent/authority/cancellation/overrun/window fences remain required.

Production root stays EMPTY. Current default Chat/embedding bound recipes remain qualification candidates, not actual tokenizer/price/provider readiness. Dynamic Task05 agent-version composition, actual native isolation/OCC/publication/codegen and Gateway callsite/secondary-call qualification remain deferred exactly as in C1.
