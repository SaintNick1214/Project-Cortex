import fs from 'node:fs';
const file='convex-dev/runtimeAgent.ts';let source=fs.readFileSync(file,'utf8');
function once(old,next){if(source.split(old).length!==2)throw Error('Expected unique edit anchor');source=source.replace(old,next);}
once('"runtimeAgent:executeTurnV4");','"runtimeAgent:executeTurnV5");');
once('  contextInputs: ref<"query",',`  prepareTurnModel: ref<"mutation", Attempt, Awaited<ReturnType<typeof prepareTurnModelHandler>>>("mutation", "runtimeAgent:prepareTurnModel"),
  prepareResolvedModelOperation: ref<"mutation", Attempt & { ordinal: number }, Awaited<ReturnType<typeof prepareResolvedModelOperationHandler>>>("mutation", "runtimeAgent:prepareResolvedModelOperation"),
  admitPreparedModelOperation: ref<"mutation", Attempt & { operationId: string; ordinal: number; requestCanonical: string; snapshotCanonical: string; bindingCanonical: string }, GatewayAdmissionCheckpoint>("mutation", "runtimeAgent:admitPreparedModelOperation"),
  turn: ref<"action", Attempt & { ordinal: number }, StepResult>("action", "runtimeAgent:turnStepV5"),
  contextInputs: ref<"query",`);
const v4Start=source.indexOf('export const executeTurnV4 ='),v4End=source.indexOf('\nasync function saveContextHandler',v4Start),v4=source.slice(v4Start,v4End);
const prefix=v4.slice(0,v4.indexOf('  traceRuntimePhase(args.runId, args.attemptNumber, "context.begin");'));
let loop=v4.slice(v4.indexOf('  for (let ordinal = 0; ordinal < 33; ordinal++)'));
loop=loop.replace('step.runAction(refs.model,','step.runAction(refs.turn,').replace('name: `model ${ordinal}`','name: `context and model turn ${ordinal}`');
const finalStart=loop.indexOf('    if (result.final) {'),finalEnd=loop.indexOf('\n    if (!result.calls.length',finalStart);
loop=loop.slice(0,finalStart)+'    if (result.final) return null;'+loop.slice(finalEnd);
const v5=prefix.replace('executeTurnV4','executeTurnV5')+loop;
source=source.slice(0,v4End)+`\n/** Fresh ordinary turns use one durable, retry-disabled Action after explicit stage barriers.
 * Tools/approval waits remain Workflow-owned; V1–V4 journals retain their layouts. */\n${v5}`+source.slice(v4End);
once('export const prepareContext = internalAction({ args: agentAttempt, handler: async (ctx, args): Promise<null> => {','export async function prepareContextHandler(ctx: ActionCtx, args: Attempt): Promise<null> {');
const prepareEnd=source.indexOf('\ntype EmptyContextResult');source=source.slice(0,prepareEnd).replace(/\n\} \}\);$/,'\n}\nexport const prepareContext = internalAction({ args: agentAttempt, handler: prepareContextHandler });')+source.slice(prepareEnd);
once('export const prepareRoutedContext = internalMutation({ args: agentAttempt, handler: async (ctx, args): Promise<EmptyContextResult> => {','async function prepareRoutedContextHandler(ctx: MutationCtx, args: Attempt): Promise<EmptyContextResult> {');
const routedEnd=source.indexOf('\n\nasync function beginOperationHandler');source=source.slice(0,routedEnd).replace(/\n\} \}\);$/,'\n}\nexport const prepareRoutedContext = internalMutation({ args: agentAttempt, handler: prepareRoutedContextHandler });')+source.slice(routedEnd);
const preparation=source.indexOf('\nexport const finishOperation =');
source=source.slice(0,preparation)+`
/** These resolutions propose pinned model inputs only. Fresh admission/checkpoint
 * still execute every original current policy/authority/source/budget predicate. */
async function prepareResolvedModelOperationHandler(ctx: MutationCtx, args: Attempt & { ordinal: number }) {
  const prepared = await prepareModelOperationHandler(ctx, args);
  if (prepared.state === "completed") return prepared;
  const resolutionArgs = { ...attemptArgs(args), runBudgetId: prepared.current.run.runBudgetId };
  const initialResolution = await resolveModelOperationHandler(ctx, resolutionArgs);
  const governedResolution = await resolveModelOperationHandler(ctx, resolutionArgs);
  return { ...prepared, initialResolution, governedResolution };
}
export const prepareResolvedModelOperation = internalMutation({ args: { ...agentAttempt, ordinal: v.number() },
  handler: (ctx, args) => prepareResolvedModelOperationHandler(createAuthorityReadScope(ctx), args) });
async function prepareTurnModelHandler(ctx: MutationCtx, args: Attempt) {
  const context = await prepareRoutedContextHandler(ctx, args);
  if (context.state === "FAILED") return { state: "failed_context" as const, failureCode: context.failureCode };
  if (context.state === "NEEDS_ACTION") return { state: "needs_context" as const };
  return await prepareResolvedModelOperationHandler(createAuthorityReadScope(ctx), { ...args, ordinal: 0 });
}
export const prepareTurnModel = internalMutation({ args: agentAttempt, handler: prepareTurnModelHandler });
`+source.slice(preparation);
const admission=source.indexOf('\nexport const recordOutput =');
source=source.slice(0,admission)+`
/** Original outer hydration and request-binding checks precede the unchanged
 * atomic admit/bind/checkpoint parent. Caller input cannot select another lane. */
async function admitPreparedModelOperationHandler(ctx: MutationCtx, args: Attempt & {
  operationId: string; ordinal: number; requestCanonical: string; snapshotCanonical: string; bindingCanonical: string;
}): Promise<GatewayAdmissionCheckpoint> {
  const current = await executionContext(ctx, attemptArgs(args));
  const semanticId = await semanticHash(canonicalModelJson([args.runId, args.attemptNumber, "model", args.ordinal, null]));
  if (args.bindingCanonical !== canonicalModelJson({ reference: args.reference, operationKey: "agent.respond", runBudgetId: current.run.runBudgetId,
    semanticId, ordinal: args.ordinal })) transcriptDenied("POLICY_DENIED");
  return await admitModelOperationHandler(ctx, args);
}
export const admitPreparedModelOperation = internalMutation({ args: { ...agentAttempt, operationId: v.string(), ordinal: v.number(),
  requestCanonical: v.string(), snapshotCanonical: v.string(), bindingCanonical: v.string() },
  handler: (ctx, args) => admitPreparedModelOperationHandler(createAuthorityReadScope(ctx), args) });
`+source.slice(admission);
const modelStart=source.indexOf('export async function modelStepHandler('),modelEnd=source.indexOf('\nexport const modelStep =',modelStart);
const oldModel=source.slice(modelStart,modelEnd), firstTail=oldModel.indexOf('  if (prepared.state === "completed")');
let common=oldModel.slice(firstTail);
common=common.replace('    await guard();\n    if (canonicalModelJson(request.reference)', '    if (!proposal) await guard();\n    if (!proposal && (canonicalModelJson(request.reference)');
common=common.replace('request.source !== undefined || request.parentOperationId !== undefined) transcriptDenied("POLICY_DENIED");\n    return await ctx.runMutation', 'request.source !== undefined || request.parentOperationId !== undefined)) transcriptDenied("POLICY_DENIED");\n    if (proposal) return await ctx.runMutation(refs.admitPreparedModelOperation, { ...attempt, operationId: op.operationId, ordinal: args.ordinal,\n      requestCanonical: request.requestCanonical, snapshotCanonical: request.snapshotCanonical,\n      bindingCanonical: canonicalModelJson({ reference: request.reference, operationKey: request.operationKey, runBudgetId: request.runBudgetId,\n        semanticId: request.semanticId, ordinal: request.ordinal, ...(request.source !== undefined ? { source: request.source } : {}),\n        ...(request.parentOperationId !== undefined ? { parentOperationId: request.parentOperationId } : {}) }) });\n    return await ctx.runMutation');
common=common.replace('  const resolve: GatewayLedgerPort["resolve"] = async request => {\n    const result = await ctx.runQuery', '  const proposals = proposal ? [proposal.initialResolution, proposal.governedResolution] : [];\n  const resolve: GatewayLedgerPort["resolve"] = async request => {\n    // Two original native checks were executed sequentially in preparation.\n    // Consume their model proposals only here; replay resolves freshly again.\n    const result = proposals.shift() ?? await ctx.runQuery');
const wrapper=oldModel.slice(0,firstTail)+'  return await executePreparedModelStep(ctx, args, prepared);\n}';
source=source.slice(0,modelStart)+wrapper+`
async function executePreparedModelStep(ctx: ActionCtx, args: Attempt & { ordinal: number }, prepared: Awaited<ReturnType<typeof prepareModelOperationHandler>>,
  proposal?: { initialResolution: Awaited<ReturnType<typeof resolveModelOperationHandler>>; governedResolution: Awaited<ReturnType<typeof resolveModelOperationHandler>> }): Promise<StepResult> {
  const attempt = attemptArgs(args);
`+common+source.slice(modelEnd);
const turnAt=source.indexOf('\nexport async function toolStepHandler');
source=source.slice(0,turnAt)+`
/** No Action retry: partial/unknown effects remain owned by the original native
 * operation ledger and explicit reconciliation, never replayed automatically. */
export async function turnStepV5Handler(ctx: ActionCtx, args: Attempt & { ordinal: number }): Promise<StepResult> {
  const attempt = attemptArgs(args);
  let prepared = args.ordinal === 0
    ? await ctx.runMutation(refs.prepareTurnModel, attempt)
    : await ctx.runMutation(refs.prepareResolvedModelOperation, { ...attempt, ordinal: args.ordinal });
  if (prepared.state === "failed_context") {
    await ctx.runMutation(ref<"mutation", Attempt & { failureCode: "CONTEXT_OVERFLOW" }, null>("mutation", "runtimeAgent:failContext"), { ...attempt, failureCode: prepared.failureCode });
    transcriptDenied(prepared.failureCode);
  }
  if (prepared.state === "needs_context") {
    await prepareContextHandler(ctx, attempt);
    prepared = await ctx.runMutation(refs.prepareResolvedModelOperation, { ...attempt, ordinal: args.ordinal });
  }
  const result = await executePreparedModelStep(ctx, args, prepared, prepared.state === "started" ? prepared : undefined);
  if (result.final) {
    await ctx.runMutation(refs.finalize, { ...attempt, finalMessageIds: result.savedMessageIds });
    try {
      traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.begin");
      await ctx.runMutation(ref<"mutation", { reference: RuntimeAuthorityReference; runId: string }, string | null>("mutation", "runtimeContentJobs:enqueueParentTitle"), { reference: args.reference, runId: args.runId });
    } catch { /* Optional title failure cannot roll back the canonical answer. */ }
    finally { traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.end"); }
  }
  return result;
}
export const turnStepV5 = internalAction({ args: { ...agentAttempt, ordinal: v.number() }, handler: turnStepV5Handler });
`+source.slice(turnAt);
fs.writeFileSync(file,source);
