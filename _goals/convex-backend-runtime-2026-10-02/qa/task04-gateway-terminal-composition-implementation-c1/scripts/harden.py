from pathlib import Path
p=Path('convex-dev/runtimeGateway.ts');s=p.read_text()
a=s.index('function captureAcknowledgment')
s=s[:a]+'''function checkedResolution(input: unknown): GatewayResolution {
  const fields = record(input, ["snapshot", "dispatchEvidence", "storageLimits"]);
  if (Object.keys(fields).length !== 3) fail("CAPABILITY_UNAVAILABLE");
  return detached(fields) as unknown as GatewayResolution;
}
function checkedAdmission(input: unknown): GatewayAdmission {
  const fields = record(input, ["status", "operationId", "attemptId", "snapshot", "requestCanonical", "resultCanonical", "replayAllowed"]);
  if (!stableId(fields.operationId)) fail("ADMITTED_REQUEST_MISMATCH");
  const keys = Reflect.ownKeys(input as object);
  const exact = (allowed: readonly string[], required: readonly string[]) => keys.every((key) => typeof key === "string" && allowed.includes(key)) && required.every((key) => key in fields);
  if (fields.status === "reserved" && exact(["status", "operationId", "attemptId", "snapshot", "requestCanonical"], ["attemptId", "snapshot", "requestCanonical"])
    && stableId(fields.attemptId) && typeof fields.requestCanonical === "string") return detached(fields) as unknown as GatewayAdmission;
  if (fields.status === "replay" && exact(["status", "operationId", "resultCanonical"], ["resultCanonical"]) && typeof fields.resultCanonical === "string") return detached(fields) as unknown as GatewayAdmission;
  if (["uncertain", "inflight"].includes(fields.status as string) && exact(["status", "operationId", "attemptId", "replayAllowed"], ["attemptId"])
    && stableId(fields.attemptId) && (!keys.includes("replayAllowed") || fields.replayAllowed === false)) return detached(fields) as unknown as GatewayAdmission;
  return fail("ADMITTED_REQUEST_MISMATCH");
}
function checkedPermit(input: unknown): Awaited<ReturnType<GatewayLedgerPort["checkpoint"]>> {
  const fields = record(input, ["dispatchPermit", "dispatchIdentity", "snapshot", "requestCanonical", "state", "replayAllowed"]);
  const keys = Reflect.ownKeys(input as object);
  if (fields.dispatchPermit === true && keys.length === 4 && ["dispatchPermit", "dispatchIdentity", "snapshot", "requestCanonical"].every((key) => key in fields)
    && stableId(fields.dispatchIdentity) && typeof fields.requestCanonical === "string") return detached(fields) as unknown as Awaited<ReturnType<GatewayLedgerPort["checkpoint"]>>;
  if (fields.dispatchPermit === false && keys.length === 3 && typeof fields.state === "string" && fields.replayAllowed === false) return { dispatchPermit: false, state: fields.state, replayAllowed: false };
  return fail("CHECKPOINT_MISMATCH");
}
'''+s[a:]
s=s.replace('resolution = await composition.ledger.resolve(resolveArgs(binding));','resolution = checkedResolution(await composition.ledger.resolve(resolveArgs(binding)));')
s=s.replace('const resolution = detached(inputResolution);','const resolution = checkedResolution(inputResolution);')
s=s.replace('const admitted = await authority(() => composition.ledger.admit({ ...binding, requestCanonical: incoming }));','const admitted = checkedAdmission(await authority(() => composition.ledger.admit({ ...binding, requestCanonical: incoming })));')
s=s.replace('const permit = await authority(() => composition.ledger.checkpoint({ reference: binding.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical }));','const permit = checkedPermit(await authority(() => composition.ledger.checkpoint({ reference: binding.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical })));')
s=s.replace('assertDelivery(); await authority(() => composition.ledger.markVisible({ reference: binding.reference, attemptId: attempt.attemptId, outputVisible, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false }), hardDeadline); assertDelivery();','''assertDelivery(); const acknowledgment = record(await authority(() => composition.ledger.markVisible({ reference: binding.reference, attemptId: attempt.attemptId, outputVisible, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false }), hardDeadline), ["recorded"]);
    if (Object.keys(acknowledgment).length !== 1 || acknowledgment.recorded !== true) fail("DELIVERY_AUTHORITY_REVOKED"); assertDelivery();''')
s=s.replace('assertDelivery(); await authority(() => composition.ledger.resolve(resolveArgs(binding)));','assertDelivery(); proofFor(checkedResolution(await authority(() => composition.ledger.resolve(resolveArgs(binding)))), (composition.now ?? Date.now)());')
s=s.replace('if (typeof item.text !== "string" || !item.text) fail("INVALID_REPLAY"); assertDelivery();','if (typeof item.text !== "string" || !item.text) fail("INVALID_REPLAY"); utf8(item.text); assertDelivery();')
s=s.replace('if (Date.now() >= deadline) fail("TERMINAL_RECONCILIATION_PENDING");\n      const flight =', '''if (Date.now() >= deadline) {
        // An unissued tuple cannot become an attachment retry after the output deadline.
        if (!attachmentFlight) { pendingAttachment = undefined; reconciliationPending = false; }
        fail("TERMINAL_RECONCILIATION_PENDING");
      }
      const flight =''')
p.write_text(s)
