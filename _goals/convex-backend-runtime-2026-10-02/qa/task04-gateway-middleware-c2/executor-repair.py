from pathlib import Path
p=Path('convex-dev/runtimeGateway.ts');s=p.read_text()
s=s.replace('export interface GatewayComposition { ledger: GatewayLedgerPort; terminalSink: DurableTerminalEvidenceSink; now?: () => number }','''/** Finite server-code composition bounds, independent of model price/token qualifications. */
export interface GatewayOwnedTiming { terminalObservationMs: number; terminalPersistenceMs: number; cleanupMs: number }
export const DEFAULT_GATEWAY_OWNED_TIMING: Readonly<GatewayOwnedTiming> = Object.freeze({ terminalObservationMs: 100, terminalPersistenceMs: 1000, cleanupMs: 100 });
export interface GatewayComposition { ledger: GatewayLedgerPort; terminalSink: DurableTerminalEvidenceSink; now?: () => number; ownedTiming?: GatewayOwnedTiming }''')
s=s.replace('  readonly signal: AbortSignal;','''  readonly signal: AbortSignal;
  /** Already-issued noncancelable RPCs remain owned/observed; late results never enable delivery.
   * Pending is not proof of rollback, failed persistence, uncharged inference or completed RPC. */
  pendingWork(): Readonly<{ authority: number; capture: number; settlement: number; native: number; reader: number; cleanup: number }>;''')
a=s.index('function stateFor(');b=s.index('/** Native test seams',a)
s=s[:a]+'''function stateFor(composition: GatewayComposition, inputBinding: GatewayBinding, inputResolution: GatewayResolution) {
  requireSink(composition); const binding = detached(inputBinding); const resolution = detached(inputResolution);
  proofFor(resolution, (composition.now ?? Date.now)());
  if (!count(binding.ordinal) || !binding.semanticId || binding.semanticId.length > 256) fail("INVALID_BINDING");
  const timing = detached(composition.ownedTiming ?? DEFAULT_GATEWAY_OWNED_TIMING);
  for (const value of [timing.terminalObservationMs, timing.terminalPersistenceMs, timing.cleanupMs]) if (!count(value) || value < 1 || value > 1000) fail("INVALID_OWNED_TIMING");
  const controller = new AbortController(); const tasks: Promise<unknown>[] = []; let replay: string | undefined;
  let deliveryDeadline = Infinity; let observationDeadline = Infinity; let lifetimeTimer: ReturnType<typeof setTimeout> | undefined;
  type WorkKind = "authority" | "capture" | "settlement" | "native" | "reader" | "cleanup";
  const pendingRPCs = new Set<{ kind: WorkKind; promise: Promise<unknown> }>();
  // Every issued operation has a retained promise and BOTH late completion handlers. A finite
  // wait does not cancel/rollback a Convex RPC; pendingWork exposes that unresolved boundary.
  // Handlers only retire observation slots: they cannot enqueue, settle again or attach output.
  function track<T>(kind: WorkKind, invoke: () => PromiseLike<T>): Promise<T> {
    let promise: Promise<T>; try { promise = Promise.resolve(invoke()); } catch (error) { promise = Promise.reject(error); }
    const slot = { kind, promise }; pendingRPCs.add(slot);
    promise.then(() => { pendingRPCs.delete(slot); }, () => { pendingRPCs.delete(slot); }); return promise;
  }
  function own<T>(invoke: () => Promise<T>): Promise<T> {
    const task = invoke(); task.catch(() => undefined); tasks.push(task); return task;
  }
  controller.signal.addEventListener("abort", () => { observationDeadline = Math.min(observationDeadline, Date.now() + timing.terminalObservationMs); });
  function startLifetime(timeoutMs: number): void {
    assertDelivery(); deliveryDeadline = Date.now() + timeoutMs; observationDeadline = deliveryDeadline + timing.terminalObservationMs;
    lifetimeTimer = setTimeout(() => controller.abort(), timeoutMs);
  }
  function endLifetime(): void { if (lifetimeTimer) clearTimeout(lifetimeTimer); }
  function canDeliver(): boolean {
    if (Date.now() >= deliveryDeadline && !controller.signal.aborted) controller.abort();
    return !controller.signal.aborted;
  }
  function assertDelivery(): void { if (!canDeliver()) fail("RUN_CANCELLED"); }
  /** Bounded wait with handled late outcome. Observation waits shorten their deadline on abort;
   * delivery waits fail on abort; persistence ignores delivery abort to retain known charges. */
  function wait<T>(promise: Promise<T>, deadline: () => number, code: string, mode: "delivery" | "observation" | "persistence"): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let finished = false; let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (value?: T, error?: unknown) => {
        if (finished) return; finished = true; if (timer) clearTimeout(timer); controller.signal.removeEventListener("abort", aborted);
        if (error !== undefined) reject(error); else resolve(value!);
      };
      const schedule = () => {
        if (timer) clearTimeout(timer); const remaining = deadline() - Date.now();
        if (remaining <= 0) { if (mode === "delivery") controller.abort(); finish(undefined, new GatewayDispatchError(code)); }
        else timer = setTimeout(() => { if (mode === "delivery") controller.abort(); finish(undefined, new GatewayDispatchError(code)); }, remaining);
      };
      const aborted = () => { if (mode === "delivery") finish(undefined, new GatewayDispatchError(code)); else if (mode === "observation") schedule(); };
      promise.then((value) => finish(value), (error: unknown) => finish(undefined, error));
      if (mode !== "persistence") controller.signal.addEventListener("abort", aborted);
      if (mode === "delivery" && controller.signal.aborted) aborted(); else schedule();
    });
  }
  async function authority<T>(invoke: () => PromiseLike<T>): Promise<T> {
    assertDelivery(); const deadline = Number.isFinite(deliveryDeadline) ? deliveryDeadline : Date.now() + resolution.snapshot.limits.timeoutMs;
    const result = await wait(track("authority", invoke), () => deadline, "RUN_CANCELLED", "delivery"); assertDelivery(); return result;
  }
  async function observe<T>(kind: "native" | "reader", invoke: () => PromiseLike<T>): Promise<T> {
    if (Date.now() >= observationDeadline) fail("MODEL_INTERRUPTED");
    return await wait(track(kind, invoke), () => observationDeadline, "MODEL_INTERRUPTED", "observation");
  }
  async function persist<T>(kind: "capture" | "settlement", invoke: () => PromiseLike<T>, deadline: number, code: string): Promise<T> {
    if (Date.now() >= deadline) fail(code);
    try { return await wait(track(kind, invoke), () => deadline, code, "persistence"); }
    catch { controller.abort(); return fail(code); }
  }
  async function cleanup(invoke: () => PromiseLike<unknown>): Promise<void> {
    try { await wait(track("cleanup", invoke), () => Date.now() + timing.cleanupMs, "CLEANUP_PENDING", "persistence"); }
    catch { /* Exposed pending RPC remains handled; no rollback/termination inference. */ }
  }
  const capture = composition.terminalSink.capture.bind(composition.terminalSink);
  let pendingEvidence: Parameters<DurableTerminalEvidenceSink["capture"]>[0] | undefined;
  type CaptureOutcome = { confirmed: true; evidenceId: string } | { confirmed: false };
  let captureFlight: { evidenceCanonical: string; outcome: "pending" | "confirmed" | "failed"; promise: Promise<CaptureOutcome> } | undefined;
  async function capturePending(deadline = Date.now() + timing.terminalPersistenceMs): Promise<boolean> {
    if (!pendingEvidence) return false;
    const evidenceCanonical = canonicalModelJson(pendingEvidence);
    if (captureFlight && captureFlight.evidenceCanonical !== evidenceCanonical) fail("TERMINAL_EVIDENCE_CONFLICT");
    if (!captureFlight || captureFlight.outcome === "failed") {
      if (Date.now() >= deadline) fail("TERMINAL_CAPTURE_PENDING");
      const flight = { evidenceCanonical, outcome: "pending" as "pending" | "confirmed" | "failed", promise: Promise.resolve<CaptureOutcome>({ confirmed: false }) };
      // Keep one capture flight across timeout/retry. Rejected/invalid acknowledgments alone
      // permit an exact idempotent persistence retry; a merely slow flight never duplicates it.
      flight.promise = track("capture", () => capture(pendingEvidence!)).then((ack): CaptureOutcome => {
        if (typeof ack.evidenceId !== "string" || !ack.evidenceId || ack.evidenceId.length > 256) { flight.outcome = "failed"; return { confirmed: false }; }
        flight.outcome = "confirmed"; return { confirmed: true, evidenceId: ack.evidenceId };
      }, (): CaptureOutcome => { flight.outcome = "failed"; return { confirmed: false }; });
      captureFlight = flight;
    }
    let outcome: CaptureOutcome;
    try { outcome = await wait(captureFlight.promise, () => deadline, "TERMINAL_CAPTURE_PENDING", "persistence"); }
    catch { controller.abort(); return fail("TERMINAL_CAPTURE_PENDING"); }
    if (!outcome.confirmed) { controller.abort(); fail("TERMINAL_CAPTURE_PENDING"); }
    pendingEvidence = undefined; return true;
  }
  const lifecycle: GatewayLifecycle = { signal: controller.signal, pendingWork: () => {
    const counts = { authority: 0, capture: 0, settlement: 0, native: 0, reader: 0, cleanup: 0 };
    pendingRPCs.forEach((slot) => { counts[slot.kind]++; }); return Object.freeze(counts);
  }, cancel: () => controller.abort(), complete: async () => { await Promise.all(tasks); if (pendingEvidence) fail("TERMINAL_CAPTURE_PENDING"); },
  retryPendingTerminalEvidence: () => capturePending(), consumeReplay: async () => {
    if (!replay) return undefined; assertDelivery(); await authority(() => composition.ledger.resolve(resolveArgs(binding)));
    const result = providerJSON(exactJSON(replay, resolution.storageLimits.privateResultBytes));
    if (!result) fail("INVALID_REPLAY");
    if (resolution.snapshot.nativeInterface === "chat") { const item = record(result, ["text"]); if (typeof item.text !== "string" || !item.text) fail("INVALID_REPLAY"); assertDelivery(); return { text: item.text }; }
    const item = record(result, ["profile", "vectors"]); assertProfileMatches(item.profile as typeof DEFAULT_EMBEDDING_PROFILE);
    if (!Array.isArray(item.vectors) || item.vectors.length !== 1) fail("INVALID_REPLAY"); item.vectors.forEach((v: number[]) => assertEmbeddingVector(v));
    assertDelivery(); return { profile: DEFAULT_EMBEDDING_PROFILE, vectors: item.vectors as number[][] };
  } };
  async function admit(request: ModelCallRequest): Promise<Reserved & { dispatchIdentity: string }> {
    proofFor(resolution, (composition.now ?? Date.now)()); assertDelivery();
    const incoming = json(request, resolution.storageLimits.canonicalBytes);
    const admitted = await authority(() => composition.ledger.admit({ ...binding, requestCanonical: incoming }));
    if (admitted.status !== "reserved") { if (admitted.status === "replay") replay = admitted.resultCanonical; fail(admitted.status === "replay" ? "REPLAY_AVAILABLE" : "UNCERTAIN_OR_INFLIGHT"); }
    const flat = exactJSON(admitted.requestCanonical, resolution.storageLimits.canonicalBytes);
    const validated = validateModelRequest(admitted.snapshot, flat).request;
    const comparable = { ...validated, semanticId: request.semanticId, childCallId: request.childCallId };
    if (canonicalModelJson(comparable) !== canonicalModelJson(request) || canonicalModelJson(admitted.snapshot) !== canonicalModelJson(resolution.snapshot)) fail("ADMITTED_REQUEST_MISMATCH");
    const permit = await authority(() => composition.ledger.checkpoint({ reference: binding.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical }));
    if (!permit.dispatchPermit) fail("DISPATCH_NOT_PERMITTED");
    if (permit.requestCanonical !== admitted.requestCanonical || canonicalModelJson(permit.snapshot) !== canonicalModelJson(admitted.snapshot)) fail("CHECKPOINT_MISMATCH");
    assertDelivery(); return { ...admitted, dispatchIdentity: permit.dispatchIdentity };
  }
  const visible = async (attempt: Reserved, outputVisible = false) => {
    assertDelivery(); await authority(() => composition.ledger.markVisible({ reference: binding.reference, attemptId: attempt.attemptId, outputVisible, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false })); assertDelivery();
  };
  async function terminal(attempt: Reserved & { dispatchIdentity: string }, raw: Record<string, unknown>, privateResult?: string): Promise<void> {
    const deadline = Date.now() + timing.terminalPersistenceMs;
    const id = raw.id; const actual = raw.model; const usage = providerJSON(raw.usage);
    if (typeof id !== "string" || !id || id.length > 256 || typeof actual !== "string" || !actual || actual.length > 256) fail("UNQUALIFIED_TERMINAL");
    utf8(id); utf8(actual);
    const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, resolution.storageLimits.canonicalBytes)).request;
    const observed = usage ? usageOf(usage) : {};
    const nativeBoundViolation = actual !== resolution.snapshot.modelId
      || (observed.inputTokens !== undefined && observed.inputTokens > admitted.inputTokens)
      || (observed.outputTokens !== undefined && observed.outputTokens > admitted.outputTokens);
    if (nativeBoundViolation || !canDeliver()) privateResult = undefined;
    const cost = resolution.dispatchEvidence.terminalCost === "gateway-aggregate-usd-v1" && usage ? conservativeUsdDecimal(usage.cost) : undefined;
    const receipt = { version: 1, dispatchIdentity: attempt.dispatchIdentity, receiptId: id, modelId: resolution.snapshot.modelId, nativeInterface: resolution.snapshot.nativeInterface,
      outcome: "confirmed", proof: "provider-terminal-v1", costSource: cost === undefined ? "unavailable" : "gateway-aggregate-usd-v1",
      ...(cost !== undefined ? { aggregateCostUsd: cost } : {}), ...(usage ? { usage: usageOf(usage) } : {}), actualModel: actual };
    const receiptCanonical = json(receipt, resolution.storageLimits.canonicalBytes);
    pendingEvidence = { attemptId: attempt.attemptId, dispatchIdentity: attempt.dispatchIdentity, receiptCanonical };
    await capturePending(deadline);
    // Capture-only port: B visibility still precedes settlement. Cancellation/expiry suppress
    // result work while known charge continues within its separate finite persistence budget.
    let deliveryRevoked = false;
    if (privateResult && canDeliver()) { try { await visible(attempt, resolution.snapshot.nativeInterface === "chat"); } catch { deliveryRevoked = true; } }
    if (!canDeliver()) privateResult = undefined;
    const settled = await persist("settlement", () => composition.ledger.settle({ reference: binding.reference, attemptId: attempt.attemptId,
      receiptCanonical: json({ ...receipt, ...(privateResult && !deliveryRevoked ? { privateResultCanonical: privateResult } : {}) }, resolution.storageLimits.canonicalBytes) }), deadline, "TERMINAL_RECONCILIATION_PENDING");
    if (deliveryRevoked) fail("DELIVERY_AUTHORITY_REVOKED");
    if (settled.overrun || nativeBoundViolation) fail("QUALIFICATION_OVERRUN");
    if (settled.state !== "settled" || settled.resultWithheld !== false) fail("TERMINAL_RESULT_WITHHELD");
    assertDelivery();
  }
  return { binding, resolution, controller, lifecycle, tasks, admit, visible, terminal, startLifetime, endLifetime, assertDelivery, canDeliver, observe, cleanup, own };
}
''' +s[b:]
# Track entire generation and embedding hooks, including finite terminal work.
s=s.replace('wrapGenerate: async ({ params, doGenerate }) => {', 'wrapGenerate: ({ params, doGenerate }) => state.own(async () => {')
s=s.replace('''      const timer = setTimeout(() => state.controller.abort(), request.timeoutMs);
      try { result = await doGenerate(); } catch { return fail("MODEL_INTERRUPTED"); } finally { clearTimeout(timer); }''','''      state.startLifetime(request.timeoutMs);
      try { result = await state.observe("native", doGenerate); } catch { state.endLifetime(); return fail("MODEL_INTERRUPTED"); }''')
s=s.replace('''      await state.terminal(attempt, raw, state.controller.signal.aborted ? undefined : privateResult);''','''      try { await state.terminal(attempt, raw, state.canDeliver() ? privateResult : undefined); } finally { state.endLifetime(); }
      state.assertDelivery();''')
s=s.replace('''    },
    wrapStream:''','''    }),
    wrapStream:''',1)
s=s.replace('''      const startedAt = Date.now(); const timeoutMs = input.get(params)!.timeoutMs;
      const connectionTimer = setTimeout(() => state.controller.abort(), timeoutMs);
      try { result = await doStream(); } catch { return fail("MODEL_INTERRUPTED"); } finally { clearTimeout(connectionTimer); }''','''      state.startLifetime(input.get(params)!.timeoutMs);
      try { result = await state.observe("native", doStream); } catch { state.endLifetime(); return fail("MODEL_INTERRUPTED"); }''')
s=s.replace('''        let cancelTask: Promise<unknown> | undefined;
        const timer = setTimeout(() => { state.controller.abort(); cancelTask = reader.cancel().catch(() => undefined); }, Math.max(0, timeoutMs - (Date.now() - startedAt)));''','''        const interrupted = () => { deliveryError ??= new GatewayDispatchError("STREAM_INTERRUPTED"); if (!observerClosed) { observerClosed = true; observer!.error(deliveryError); } };
        const emit = (part: LanguageModelV4StreamPart) => {
          // EVERY enqueue is fenced, including start/end/finish, independently of provider abort.
          if (!state.canDeliver()) { interrupted(); return; } if (observerClosed || deliveryError) return;
          if ((observer!.desiredSize ?? 0) <= 0) { observerClosed = true; observer!.error(new GatewayDispatchError("OBSERVER_BUFFER_LIMIT")); return; }
          state.assertDelivery(); observer!.enqueue(part);
        };
        state.controller.signal.addEventListener("abort", interrupted);
        if (state.controller.signal.aborted) interrupted();''')
s=s.replace('''const item = await reader.read();''','''const item = await state.observe("reader", () => reader.read());''')
s=s.replace('''catch { deliveryError = new GatewayDispatchError("DELIVERY_AUTHORITY_REVOKED"); observerClosed = true; observer!.error(deliveryError); }''','''catch { deliveryError ??= new GatewayDispatchError(state.controller.signal.aborted ? "STREAM_INTERRUPTED" : "DELIVERY_AUTHORITY_REVOKED"); if (!observerClosed) { observerClosed = true; observer!.error(deliveryError); } }''')
old='''              if (!observerClosed) { if ((observer!.desiredSize ?? 0) <= 0) { observerClosed = true; observer!.error(new GatewayDispatchError("OBSERVER_BUFFER_LIMIT")); } else { if (!textStarted) { observer!.enqueue({ type: "text-start", id: "governed-text" }); textStarted = true; } observer!.enqueue({ type: "text-delta", id: "governed-text", delta: part.delta }); } }'''
new='''              if (!state.canDeliver()) interrupted();
              if (!observerClosed && !deliveryError) { if (!textStarted) { emit({ type: "text-start", id: "governed-text" }); textStarted = true; } emit({ type: "text-delta", id: "governed-text", delta: part.delta }); }'''
assert old in s;s=s.replace(old,new)
old='''          if (!observerClosed) { if (textStarted) observer!.enqueue({ type: "text-end", id: "governed-text" }); observer!.enqueue({ type: "finish", finishReason: { unified: terminalReason === "length" ? "length" : terminalReason === "content_filter" ? "content-filter" : "stop", raw: terminalReason }, usage: nativeUsage(providerJSON(rawTerminal.usage)) }); observer!.close(); observerClosed = true; }'''
new='''          if (!state.canDeliver()) interrupted();
          if (!observerClosed && !deliveryError) { if (textStarted) emit({ type: "text-end", id: "governed-text" }); emit({ type: "finish", finishReason: { unified: terminalReason === "length" ? "length" : terminalReason === "content_filter" ? "content-filter" : "stop", raw: terminalReason }, usage: nativeUsage(providerJSON(rawTerminal.usage)) }); if (!observerClosed) { state.assertDelivery(); observer!.close(); observerClosed = true; } }'''
assert old in s;s=s.replace(old,new)
s=s.replace('''} finally { clearTimeout(timer); if (cancelTask) await cancelTask; try { await reader.cancel(); } catch { /* Checkpoint liability remains. */ } reader.releaseLock(); }''','''} finally { state.endLifetime(); state.controller.signal.removeEventListener("abort", interrupted); await state.cleanup(() => reader.cancel()); reader.releaseLock(); }''')
s=s.replace('''wrapEmbed: async ({ params, doEmbed }) => {''','''wrapEmbed: ({ params, doEmbed }) => state.own(async () => {''')
s=s.replace('''      let result: EmbeddingModelV4Result; const timer = setTimeout(() => state.controller.abort(), request.timeoutMs);
      try { result = await doEmbed(); } catch { return fail("MODEL_INTERRUPTED"); } finally { clearTimeout(timer); }''','''      let result: EmbeddingModelV4Result; state.startLifetime(request.timeoutMs);
      try { result = await state.observe("native", doEmbed); } catch { state.endLifetime(); return fail("MODEL_INTERRUPTED"); }''')
s=s.replace('''      await state.terminal(attempt, raw, state.controller.signal.aborted ? undefined : payload);''','''      try { await state.terminal(attempt, raw, state.canDeliver() ? payload : undefined); } finally { state.endLifetime(); }
      state.assertDelivery();''')
s=s.replace('''      const safe: EmbeddingModelV4Result = { embeddings: detached(result.embeddings), warnings: [], ...(tokens !== undefined ? { usage: { tokens } } : {}) }; return safe;
    },''','''      const safe: EmbeddingModelV4Result = { embeddings: detached(result.embeddings), warnings: [], ...(tokens !== undefined ? { usage: { tokens } } : {}) }; state.assertDelivery(); return safe;
    }),''')
p.write_text(s)
