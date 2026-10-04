from pathlib import Path
p=Path('convex-dev/runtimeGateway.ts');s=p.read_text()
s=s.replace('import { convexGateway }','import { ConvexError } from "convex/values";\nimport { convexGateway }',1)
a=s.index('  settle(args:');b=s.index('/** Finite server-code',a)
s=s[:a]+'''  attachTerminalResult(args: { reference: RuntimeAuthorityReference; attemptId: AttemptId; evidenceId: string; privateResultCanonical: string }): Promise<TerminalAttachmentAcknowledgment>;
}
export interface TerminalAttachmentAcknowledgment { attached: boolean; resultWithheld: boolean }
export type TerminalCaptureAcknowledgment = { evidenceId: string } | { evidenceId: string; state: "settled" | "confirmed_rejected" | "uncertain"; settledCostUnits?: number; overrun: boolean };
/** Trusted server composition only, currently UNWIRED. Capture atomically records charge-only
 * evidence and accounts known/uncertain liability independently of delivery rights. It never
 * carries private output. Required current attachment atomically fences private result/visibility.
 * A minimum evidenceId acknowledgment is structural compatibility, never accounting truth. */
export interface DurableTerminalEvidenceSink {
  capture(evidence: { attemptId: AttemptId; dispatchIdentity: string; receiptCanonical: string }): Promise<TerminalCaptureAcknowledgment>;
}
'''+s[b:]
s=s.replace('  retryPendingTerminalEvidence(): Promise<boolean>;','''  retryPendingTerminalEvidence(): Promise<boolean>;
  /** Only an already-issued exact attachment tuple may be retried/joined. Bookkeeping only:
   * no new private payload, inference, token lookup or revival of failed output. */
  retryPendingTerminalAttachment(): Promise<TerminalAttachmentAcknowledgment | undefined>;''')
a=s.index('function detached<T>')
s=s[:a]+'''function stableId(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256 || value.trim() !== value) return false;
  utf8(value); return true;
}
/** Source is detached before any await; never normalized or inferred from prompt/model claims. */
function detachedBinding(input: GatewayBinding): GatewayBinding {
  const fields = record(input, ["reference", "operationKey", "runBudgetId", "semanticId", "ordinal", "source", "parentOperationId"]);
  if ("source" in fields) {
    const source = record(fields.source, ["sourceId", "sourceEventId", "sourceRevision", "contentHash"]);
    if (Object.keys(source).length !== 4 || !stableId(source.sourceId) || !stableId(source.sourceEventId)
      || !count(source.sourceRevision) || source.sourceRevision < 1 || typeof source.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(source.contentHash)) fail("INVALID_SOURCE");
  }
  return detached(fields) as unknown as GatewayBinding;
}
function captureAcknowledgment(input: unknown): TerminalCaptureAcknowledgment {
  const ack = record(input, ["evidenceId", "state", "settledCostUnits", "overrun"]);
  if (!stableId(ack.evidenceId)) fail("TERMINAL_CAPTURE_PENDING");
  // Missing accounting fields are not projected to a fabricated settled state.
  if (Reflect.ownKeys(input as object).length === 1) return { evidenceId: ack.evidenceId };
  if (!["settled", "confirmed_rejected", "uncertain"].includes(ack.state as string) || typeof ack.overrun !== "boolean"
    || ("settledCostUnits" in ack && !count(ack.settledCostUnits))) fail("TERMINAL_CAPTURE_PENDING");
  // Explicit undefined is not a valid optional native accounting value.
  if (Object.getOwnPropertyDescriptor(input, "settledCostUnits") && !count(ack.settledCostUnits)) fail("TERMINAL_CAPTURE_PENDING");
  return ack as unknown as TerminalCaptureAcknowledgment;
}
function attachmentAcknowledgment(input: unknown): TerminalAttachmentAcknowledgment {
  const ack = record(input, ["attached", "resultWithheld"]);
  if (Reflect.ownKeys(input as object).length !== 2 || typeof ack.attached !== "boolean" || typeof ack.resultWithheld !== "boolean"
    || (!ack.attached && !ack.resultWithheld)) fail("TERMINAL_RECONCILIATION_PENDING");
  return { attached: ack.attached, resultWithheld: ack.resultWithheld };
}
/** Only the exact native structured conflict is definitive, never remote message text. */
function attachmentConflict(error: unknown): boolean {
  try {
    if (!(error instanceof ConvexError) || Object.getPrototypeOf(error) !== ConvexError.prototype) return false;
    const descriptor = Object.getOwnPropertyDescriptor(error, "data");
    if (!descriptor || !("value" in descriptor)) return false;
    const data = record(descriptor.value, ["version", "code", "message", "retryable", "outcome"]);
    return data.version === 1 && data.code === "IDEMPOTENCY_CONFLICT" && data.retryable === false;
  } catch { return false; }
}
'''+s[a:]
s=s.replace('const binding = detached(inputBinding)', 'const binding = detachedBinding(inputBinding)')
s=s.replace('function requireSink(composition: GatewayComposition): void { if (!composition.terminalSink || typeof composition.terminalSink.capture !== "function") fail("DURABLE_TERMINAL_SINK_REQUIRED"); }','''function requireSink(composition: GatewayComposition): void {
  if (!composition.terminalSink || typeof composition.terminalSink.capture !== "function") fail("DURABLE_TERMINAL_SINK_REQUIRED");
  if (!composition.ledger || typeof composition.ledger.attachTerminalResult !== "function") fail("TERMINAL_ATTACHMENT_REQUIRED");
}''')
a=s.index('  async function persist<T>');b=s.index('  async function cleanup',a);s=s[:a]+s[b:]
a=s.index('  type CaptureOutcome');b=s.index('  const lifecycle:',a)
s=s[:a]+'''  type CaptureOutcome = { confirmed: true; acknowledgment: TerminalCaptureAcknowledgment } | { confirmed: false };
  let capturedAcknowledgment: TerminalCaptureAcknowledgment | undefined;
  let captureFlight: { evidenceCanonical: string; outcome: "pending" | "confirmed" | "failed"; promise: Promise<CaptureOutcome> } | undefined;
  async function capturePending(deadline = Date.now() + timing.terminalPersistenceMs): Promise<boolean> {
    if (!pendingEvidence) return false;
    const evidenceCanonical = canonicalModelJson(pendingEvidence);
    if (captureFlight && captureFlight.evidenceCanonical !== evidenceCanonical) fail("TERMINAL_EVIDENCE_CONFLICT");
    if (!captureFlight || captureFlight.outcome === "failed") {
      if (Date.now() >= deadline) fail("TERMINAL_CAPTURE_PENDING");
      const evidence = pendingEvidence;
      const flight = { evidenceCanonical, outcome: "pending" as "pending" | "confirmed" | "failed", promise: Promise.resolve<CaptureOutcome>({ confirmed: false }) };
      // Both branches are total: hostile late acknowledgments never create an unobserved rejection.
      flight.promise = track("capture", () => capture(detached(evidence))).then((input): CaptureOutcome => {
        try {
          const acknowledgment = captureAcknowledgment(input); flight.outcome = "confirmed";
          capturedAcknowledgment = acknowledgment;
          if (pendingEvidence === evidence) pendingEvidence = undefined;
          return { confirmed: true, acknowledgment };
        } catch { flight.outcome = "failed"; return { confirmed: false }; }
      }, (): CaptureOutcome => { flight.outcome = "failed"; return { confirmed: false }; });
      captureFlight = flight;
    }
    let outcome: CaptureOutcome;
    try { outcome = await wait(captureFlight.promise, () => deadline, "TERMINAL_CAPTURE_PENDING", "persistence"); }
    catch { return fail("TERMINAL_CAPTURE_PENDING"); }
    if (!outcome.confirmed) fail("TERMINAL_CAPTURE_PENDING");
    return true;
  }
  type AttachmentTuple = Parameters<GatewayLedgerPort["attachTerminalResult"]>[0];
  type AttachmentOutcome = { acknowledgment: TerminalAttachmentAcknowledgment } | { failed: true; conflict: boolean };
  let pendingAttachment: AttachmentTuple | undefined;
  let attachmentFlight: { canonical: string; outcome: "pending" | "confirmed" | "failed"; promise: Promise<AttachmentOutcome> } | undefined;
  async function attachPending(deadline = Date.now() + timing.terminalPersistenceMs): Promise<TerminalAttachmentAcknowledgment | undefined> {
    if (!pendingAttachment) return undefined;
    const tuple = pendingAttachment; const canonical = canonicalModelJson(tuple);
    if (attachmentFlight && attachmentFlight.canonical !== canonical) fail("TERMINAL_RESULT_WITHHELD");
    if (!attachmentFlight || attachmentFlight.outcome === "failed") {
      if (Date.now() >= deadline) fail("TERMINAL_RECONCILIATION_PENDING");
      const flight = { canonical, outcome: "pending" as "pending" | "confirmed" | "failed", promise: Promise.resolve<AttachmentOutcome>({ failed: true, conflict: false }) };
      // Settlement counter now denotes atomic-lane attachment RPCs, not ordinary settlement.
      flight.promise = track("settlement", () => composition.ledger.attachTerminalResult(detached(tuple))).then((input): AttachmentOutcome => {
        try {
          const acknowledgment = attachmentAcknowledgment(input); flight.outcome = "confirmed";
          if (pendingAttachment === tuple) { pendingAttachment = undefined; reconciliationPending = false; }
          return { acknowledgment };
        } catch { flight.outcome = "failed"; reconciliationPending = true; return { failed: true, conflict: false }; }
      }, (error: unknown): AttachmentOutcome => {
        const conflict = attachmentConflict(error); flight.outcome = "failed";
        if (conflict && pendingAttachment === tuple) pendingAttachment = undefined;
        reconciliationPending = !conflict; return { failed: true, conflict };
      });
      attachmentFlight = flight;
    }
    let outcome: AttachmentOutcome;
    try { outcome = await wait(attachmentFlight.promise, () => deadline, "TERMINAL_RECONCILIATION_PENDING", "persistence"); }
    catch { reconciliationPending = pendingAttachment !== undefined; return fail("TERMINAL_RECONCILIATION_PENDING"); }
    if ("failed" in outcome) fail(outcome.conflict ? "TERMINAL_RESULT_WITHHELD" : "TERMINAL_RECONCILIATION_PENDING");
    return outcome.acknowledgment;
  }
'''+s[b:]
s=s.replace('retryPendingTerminalEvidence: () => capturePending(), consumeReplay:', 'retryPendingTerminalEvidence: () => own(() => capturePending()), retryPendingTerminalAttachment: () => own(() => attachPending()), consumeReplay:')
a=s.index('    // Capture-only port:');b=s.index('    assertDelivery();\n  }',a)
s=s[:a]+'''    const ack = capturedAcknowledgment!;
    if (nativeBoundViolation || ("overrun" in ack && ack.overrun)) fail("QUALIFICATION_OVERRUN");
    if (!canDeliver()) assertDelivery();
    if (!privateResult || ("state" in ack && ack.state !== "settled")) fail("TERMINAL_RESULT_WITHHELD");
    // Retain private bytes only when attachment is actually issued within the ORIGINAL deadline.
    if (Date.now() >= deadline) fail("TERMINAL_RECONCILIATION_PENDING");
    pendingAttachment = detached({ reference: binding.reference, attemptId: attempt.attemptId, evidenceId: ack.evidenceId, privateResultCanonical: privateResult });
    reconciliationPending = true;
    const attached = await attachPending(deadline);
    if (!attached || !attached.attached || attached.resultWithheld) fail("TERMINAL_RESULT_WITHHELD");
'''+s[b:]
# Preserve genuine terminal even without a usage chunk; absent money stays unavailable.
s=s.replace('terminalReason = (choices[0] as { finish_reason: string }).finish_reason;', 'terminalReason = (choices[0] as { finish_reason: string }).finish_reason;')
s=s.replace('              if (providerJSON(raw.usage)) rawTerminal = { id, model: actualModel, usage: raw.usage };','''              if (terminalReason || providerJSON(raw.usage)) rawTerminal = { id, model: actualModel, ...(rawTerminal?.usage ? { usage: rawTerminal.usage } : {}), ...(providerJSON(raw.usage) ? { usage: raw.usage } : {}) };''')
s=s.replace('state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes) : undefined)', 'Math.min(state.resolution.storageLimits.privateResultBytes, state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes)) : undefined)')
s=s.replace('vectors: result.embeddings }, state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes)', 'vectors: result.embeddings }, Math.min(state.resolution.storageLimits.privateResultBytes, state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes))')
p.write_text(s)
