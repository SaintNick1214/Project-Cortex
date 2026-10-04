from pathlib import Path
p=Path('convex-dev/runtimePolicySchema.ts');s=p.read_text();s=s.replace('terminalEvidenceCanonical: v.optional(v.string()), createdAt:', 'terminalEvidenceCanonical: v.optional(v.string()), terminalEvidenceHash: v.optional(v.string()),\n    resultAttachmentState: v.optional(v.union(v.literal("pending"), v.literal("attached"), v.literal("closed"))), createdAt:');p.write_text(s)
p=Path('convex-dev/runtimeModelPolicy.ts');s=p.read_text()
s=s.replace('  const { attempt, operation, tenant, run } = state;\n  if (attempt.state === "settled"', '  const { attempt, operation, tenant, run } = state;\n  if (capturedAttempt(attempt)) return { state: attempt.state, replayAllowed: false as const };\n  if (attempt.state === "settled"',1)
start=s.index('async function settleAttempt(')
end=s.index('/** Positive canonical retirement evidence',start)
old=s[start:end]
# preserve native arithmetic code and turn it into shared transition
account=old[old.index('  const fromUnknown ='):old.index('\n/**') if '\n/**' in old else len(old)]
account=account.replace('    ...(receipt.actualModel ? { actualModel: receipt.actualModel } : {}), ...(deliverResult ? { privateResultCanonical: privateResult } : {}) });','    ...(receipt.actualModel ? { actualModel: receipt.actualModel } : {}), ...(deliverResult ? { privateResultCanonical: privateResult } : {}) });')
prefix='''type TerminalReceipt = z.infer<typeof receiptSchema>;
type AttemptContext = Awaited<ReturnType<typeof attemptContext>>;
/** A partial capture marker is corruption, never a legacy privilege bypass. */
function capturedAttempt(attempt: Attempt): boolean {
  const hashPresent = attempt.terminalEvidenceHash !== undefined;
  const statePresent = attempt.resultAttachmentState !== undefined;
  if (hashPresent !== statePresent || (hashPresent && (!attempt.terminalEvidenceCanonical || !digest.test(attempt.terminalEvidenceHash!)))) fail("POLICY_DENIED", "uncertain");
  return hashPresent;
}
function knownCost(receipt: TerminalReceipt, proof: QualifiedDispatchEvidence): number | undefined {
  if (proof.terminalCost !== "gateway-aggregate-usd-v1" || receipt.costSource !== proof.terminalCost || receipt.aggregateCostUsd === undefined) return undefined;
  try { return costMicroUnits(receipt.aggregateCostUsd); } catch { return undefined; }
}
function chargeOnly(receipt: TerminalReceipt): string {
  const { privateResultCanonical: _privateResult, ...charge } = receipt;
  return canonical(charge);
}
/** Initial nonmoney facts are immutable; only absent facts may be supplied with complete money. */
function compatibleRefinement(initialCanonical: string, receipt: TerminalReceipt, proof: QualifiedDispatchEvidence) {
  const initial = receiptSchema.safeParse(decode(initialCanonical));
  if (!initial.success || knownCost(initial.data, proof) !== undefined || knownCost(receipt, proof) === undefined) fail("IDEMPOTENCY_CONFLICT", "uncertain");
  for (const key of ["version", "dispatchIdentity", "receiptId", "modelId", "nativeInterface", "outcome", "proof"] as const) {
    if (initial.data[key] !== receipt[key]) fail("IDEMPOTENCY_CONFLICT", "uncertain");
  }
  if (initial.data.actualModel !== undefined && receipt.actualModel !== initial.data.actualModel) fail("IDEMPOTENCY_CONFLICT", "uncertain");
  for (const key of ["inputTokens", "outputTokens", "totalTokens", "cachedInputTokens", "reasoningTokens"] as const) {
    if (initial.data.usage?.[key] !== undefined && receipt.usage?.[key] !== initial.data.usage[key]) fail("IDEMPOTENCY_CONFLICT", "uncertain");
  }
}
async function captureIdentity(attempt: Attempt): Promise<string> {
  return await semanticHash(canonical(["native-terminal-evidence-v1", attempt._id, attempt.dispatchIdentity, attempt.terminalEvidenceCanonical, attempt.terminalEvidenceHash]));
}
async function capturedDuplicate(attempt: Attempt, chargeCanonical: string, receiptHash: string): Promise<boolean> {
  if (!capturedAttempt(attempt)) return false;
  if (chargeCanonical === attempt.terminalEvidenceCanonical) {
    assertModelRequestIdentity({ canonical: attempt.terminalEvidenceCanonical!, hash: attempt.terminalEvidenceHash! }, { canonical: chargeCanonical, hash: receiptHash }, "uncertain");
    return true;
  }
  if (attempt.receiptCanonical) {
    assertModelRequestIdentity({ canonical: attempt.receiptCanonical, hash: attempt.receiptHash! }, { canonical: chargeCanonical, hash: receiptHash }, "uncertain");
    return true;
  }
  return false;
}
/** Every route uses the same original-window, full-cost, once-only transition. */
async function accountKnown(ctx: WriteCtx, state: AttemptContext, receipt: TerminalReceipt, chargeCanonical: string, receiptHash: string,
  cost: number, privateResult?: string) {
  const { attempt, operation, snapshot, proof, tenant, run } = state;
  const deliverResult = privateResult !== undefined;
'''
prefix+=account
# account already ends }
prefix+='''async function settleAttempt(ctx: WriteCtx, reference: RuntimeAuthorityReference, attemptId: Id<"runtimeModelAttempts">, receiptCanonical: string, liabilityOnly: boolean, deploymentRetirement = false) {
  const state = await attemptContext(ctx, attemptId); const { attempt, operation, snapshot, proof } = state;
  const captured = capturedAttempt(attempt);
  if (deploymentRetirement) await retiredScope(ctx, operation);
  else if (liabilityOnly) await liabilityAuthority(ctx, reference, operation);
  else if (!sameAuthority(reference, operation.reference)) fail("FORBIDDEN");
  const canDeliver = !liabilityOnly && await permittedResult(ctx, reference, operation);
  if (!liabilityOnly) await currentAuthority(ctx, reference, operation.operationKey);
  const parsed = receiptSchema.safeParse(decode(receiptCanonical));
  if (!parsed.success) return await writeUnknown(ctx, state);
  const receipt = parsed.data;
  if (receipt.dispatchIdentity !== attempt.dispatchIdentity || receipt.modelId !== snapshot.modelId || receipt.nativeInterface !== snapshot.nativeInterface
    || (captured && receipt.actualModel !== undefined && receipt.actualModel !== snapshot.modelId)) fail("IDEMPOTENCY_CONFLICT", "uncertain");
  const chargeCanonical = chargeOnly(receipt); const receiptHash = await semanticHash(chargeCanonical);
  if (captured) {
    if (await capturedDuplicate(attempt, chargeCanonical, receiptHash)) return { state: attempt.state, settledCostUnits: attempt.settledCostUnits, resultWithheld: attempt.resultWithheld || !canDeliver };
    if (attempt.state !== "uncertain") fail("IDEMPOTENCY_CONFLICT", "uncertain");
    compatibleRefinement(attempt.terminalEvidenceCanonical!, receipt, proof);
  } else if (attempt.receiptCanonical) {
    assertModelRequestIdentity({ canonical: attempt.receiptCanonical, hash: attempt.receiptHash! }, { canonical: chargeCanonical, hash: receiptHash }, "uncertain");
    const candidateResult = canDeliver ? validatedPrivateResult(snapshot, attempt, receipt.privateResultCanonical) : undefined;
    if (attempt.privateResultCanonical && candidateResult && attempt.privateResultCanonical !== candidateResult) fail("IDEMPOTENCY_CONFLICT");
    return { state: attempt.state, settledCostUnits: attempt.settledCostUnits, resultWithheld: attempt.resultWithheld || !canDeliver };
  }
  if (attempt.state !== "dispatch_pending" && attempt.state !== "uncertain") fail("POLICY_DENIED");
  const cost = knownCost(receipt, proof);
  if (cost === undefined) return await writeUnknown(ctx, state, chargeCanonical);
  const privateResult = !captured && canDeliver && receipt.outcome === "confirmed" ? validatedPrivateResult(snapshot, attempt, receipt.privateResultCanonical) : undefined;
  return await accountKnown(ctx, state, receipt, chargeCanonical, receiptHash, cost, privateResult);
}
/** Trusted compiled terminal producers only. This authority accounts liability, never grants data access. */
export const captureTerminalEvidence = internalMutation({ args: { attemptId: v.id("runtimeModelAttempts"), dispatchIdentity: v.string(), receiptCanonical: v.string() }, handler: async (ctx, args) => {
  const state = await attemptContext(ctx, args.attemptId); const { attempt, operation, snapshot, proof } = state;
  const captured = capturedAttempt(attempt);
  if (attempt.checkpointAt === undefined || args.dispatchIdentity !== attempt.dispatchIdentity) fail("POLICY_DENIED", "uncertain");
  const parsed = receiptSchema.omit({ privateResultCanonical: true }).safeParse(decode(args.receiptCanonical));
  if (!parsed.success) fail("INVALID_INPUT", "uncertain");
  const receipt = parsed.data;
  if (receipt.dispatchIdentity !== attempt.dispatchIdentity || receipt.modelId !== snapshot.modelId || receipt.nativeInterface !== snapshot.nativeInterface
    || receipt.proof !== proof.terminalProof || (receipt.actualModel !== undefined && receipt.actualModel !== snapshot.modelId)) fail("IDEMPOTENCY_CONFLICT", "uncertain");
  const chargeCanonical = canonical(receipt); const receiptHash = await semanticHash(chargeCanonical);
  const result = async () => ({ evidenceId: await captureIdentity(attempt), state: attempt.state as "settled" | "confirmed_rejected" | "uncertain",
    ...(attempt.settledCostUnits !== undefined ? { settledCostUnits: attempt.settledCostUnits } : {}), overrun: operation.overrun });
  if (captured) {
    if (await capturedDuplicate(attempt, chargeCanonical, receiptHash)) return await result();
    if (attempt.state !== "uncertain") fail("IDEMPOTENCY_CONFLICT", "uncertain");
    compatibleRefinement(attempt.terminalEvidenceCanonical!, receipt, proof);
  } else if (attempt.state !== "dispatch_pending" && attempt.state !== "uncertain") {
    // Legacy terminal rows can acknowledge exact stored charge only; no attachment privilege is created.
    if (!attempt.receiptCanonical || (attempt.state !== "settled" && attempt.state !== "confirmed_rejected")) fail("POLICY_DENIED", "uncertain");
    assertModelRequestIdentity({ canonical: attempt.receiptCanonical, hash: attempt.receiptHash! }, { canonical: chargeCanonical, hash: receiptHash }, "uncertain");
    return { evidenceId: await semanticHash(canonical(["legacy-terminal-evidence-v1", attempt._id, chargeCanonical])), state: attempt.state,
      settledCostUnits: attempt.settledCostUnits, overrun: operation.overrun };
  }
  const cost = knownCost(receipt, proof);
  if (captured && cost === undefined) fail("IDEMPOTENCY_CONFLICT", "uncertain");
  const deliverable = !captured && cost !== undefined && cost <= attempt.reservationUnits && receipt.outcome === "confirmed"
    && (receipt.usage?.inputTokens === undefined || receipt.usage.inputTokens <= attempt.measuredInputTokens)
    && (receipt.usage?.outputTokens === undefined || receipt.usage.outputTokens <= attempt.maximumOutputTokens)
    && await permittedResult(ctx, operation.reference, operation);
  const accounted = cost === undefined ? await writeUnknown(ctx, state, chargeCanonical)
    : await accountKnown(ctx, state, receipt, chargeCanonical, receiptHash, cost);
  if (!captured) await ctx.db.patch("runtimeModelAttempts", attempt._id, {
    terminalEvidenceCanonical: chargeCanonical, terminalEvidenceHash: receiptHash, resultAttachmentState: deliverable ? "pending" : "closed" });
  const latest = await attemptContext(ctx, args.attemptId);
  return { evidenceId: await captureIdentity(latest.attempt), state: accounted.state as "settled" | "confirmed_rejected" | "uncertain",
    ...(latest.attempt.settledCostUnits !== undefined ? { settledCostUnits: latest.attempt.settledCostUnits } : {}), overrun: latest.operation.overrun };
} });
/** Private delivery is independently fenced by exact current original authority. Closed never reopens. */
export const attachTerminalResult = internalMutation({ args: { ...attemptArgs, evidenceId: v.string(), privateResultCanonical: v.string() }, handler: async (ctx, args) => {
  const { attempt, operation, snapshot } = await attemptContext(ctx, args.attemptId);
  if (!capturedAttempt(attempt)) return { attached: false, resultWithheld: true };
  if (args.evidenceId !== await captureIdentity(attempt)) fail("IDEMPOTENCY_CONFLICT", "uncertain");
  if (attempt.resultAttachmentState === "closed") return { attached: false, resultWithheld: true };
  if (attempt.state !== "settled" || attempt.settledCostUnits === undefined || operation.overrun) return { attached: false, resultWithheld: true };
  if (!await permittedResult(ctx, args.reference, operation)) return { attached: false, resultWithheld: true };
  await finalActor(ctx, args.reference, operation.operationKey);
  const privateResult = validatedPrivateResult(snapshot, attempt, args.privateResultCanonical);
  if (privateResult === undefined) return { attached: false, resultWithheld: true };
  if (attempt.resultAttachmentState === "attached") {
    if (attempt.privateResultCanonical !== privateResult) fail("IDEMPOTENCY_CONFLICT", "uncertain");
    return { attached: true, resultWithheld: false };
  }
  await ctx.db.patch("runtimeModelAttempts", attempt._id, { privateResultCanonical: privateResult, resultWithheld: false, resultAttachmentState: "attached", outputVisible: true });
  return { attached: true, resultWithheld: false };
} });
'''
s=s[:start]+prefix+s[end:]
p.write_text(s)
