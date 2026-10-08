# Frozen C2 ordinary helper API

All C1 constructors, flat B argument/results, strict charge receipts, capture-only sink and lack of registrations/caller wiring remain unchanged. No new FunctionReference or public route exists. Product source declarations are authoritative for exact types.

New backend-code-only composition: ownedTiming?:{terminalObservationMs:number,terminalPersistenceMs:number,cleanupMs:number}, each safe integer1..1000; defaults100/1000/100. These do not change U/K/native billable options.

Lifecycle adds pendingWork()->Readonly<{authority,capture,settlement,native,reader,cleanup:number}>. Counts distinguish issued unresolved RPCs from finite local owner waits; no receipt/result payload is exposed. cancel() stops local delivery and shortens bounded observation, with no implied B.cancelBudget/remote rollback/refund. complete() joins every issued native hook and later-added drain under finite wait bounds; direct generate/embed failures belong to their hook callers, stream drain failures/pending capture/reconciliation remain explicit. consumeReplay() now has bounded current-resolution and local eligibility fences before/after it. Every stream enqueue, including text-end/finish, has the same local fence.

retryPendingTerminalEvidence() joins a still-running capture, consumes a valid late ack without invoking it again, or retries exact sanitized evidence only after completed failure/invalid ack, under required idempotent sink semantics. It never invokes inference or ordinary settlement. Retained memory is not durable integration.

Terminal order remains capture-only persistence -> pending-state visibility -> ordinary settle -> eligible final output, within a separate finite terminal budget. Required capture-only sink is UNWIRED and must not settle/release slot/change visibility/attach private result before returning. Future atomic capture+accounting requires a separate reviewed current-authority attachTerminalResult port/order change before wiring; structural capture acknowledgment compatibility is insufficient.

No production caller/root/native model/currency/token/cost readiness claim; original full Task04 and all17 criteria remain incomplete.
