/** Disposable operator-only commissioning. No public callable or provider bypass. */
import { internalAction, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
import type { EmbeddingModelV4 } from '@ai-sdk/provider';
import { runtimeAuthorityReference } from './runtimeAuthSchema';
import { createBackendGatewayComposition, ensureBackendGatewayBudget } from './runtimeGatewayBackend';
import { createGovernedGatewayModel, GatewayDispatchError } from './runtimeGateway';
import { canonicalModelJson } from './_cortex/shared/domain/model_policy';
import { LARGE_EMBEDDING_PROFILE, semanticHash } from './_cortex/shared/domain/profile';

const FIXED_VALUE = 'The observatory project codeword is MARIGOLD_3072. The research team meets beside the cedar telescope.';
const EXPECTED_TENANT = 'task10-fe3a2599-d6fd-41f1-984e-141c8373423e';
export const state = internalQuery({ args: { reference: runtimeAuthorityReference }, handler: async (ctx, args) => {
  if (args.reference.tenantId !== EXPECTED_TENANT) throw Error('FIXTURE_SCOPE_DENIED');
  const accounts = (await ctx.db.query('runtimeBudgetAccounts').collect()).filter(row => row.tenantId === EXPECTED_TENANT);
  const operations = (await ctx.db.query('runtimeModelOperations').collect()).filter(row => row.tenantId === EXPECTED_TENANT);
  const ids = new Set(operations.map(row => row._id));
  const attempts = (await ctx.db.query('runtimeModelAttempts').collect()).filter(row => ids.has(row.operationDocumentId));
  return { accounts: accounts.map(({ _id, kind, runBudgetId, limitUnits, reservedUnits, settledUnits, uncertainUnits, activeConcurrency, concurrencyLimit, cancelled, overrun }) =>
    ({ _id, kind, runBudgetId, limitUnits, reservedUnits, settledUnits, uncertainUnits, activeConcurrency, concurrencyLimit, cancelled, overrun })),
    operations: operations.map(({ _id, semanticId, operationKey, snapshotCanonical, reservedUnits, uncertainUnits, settledUnits }) =>
      ({ _id, semanticId, operationKey, snapshot: JSON.parse(snapshotCanonical), reservedUnits, uncertainUnits, settledUnits })),
    attempts: attempts.map(({ _id, operationDocumentId, ordinal, state, dispatchIdentity, reservationUnits, settledCostUnits, slotReleased, resultWithheld, receiptCanonical, privateResultCanonical }) => {
      const result = privateResultCanonical ? JSON.parse(privateResultCanonical) : undefined;
      return { _id, operationDocumentId, ordinal, state, dispatchIdentity, reservationUnits, settledCostUnits, slotReleased, resultWithheld,
        receipt: receiptCanonical ? JSON.parse(receiptCanonical) : null, privateResultBytes: privateResultCanonical ? new TextEncoder().encode(privateResultCanonical).length : 0,
        privateProfile: result?.profile ?? null, privateDimensions: result?.vectors?.map((vector: number[]) => vector.length) ?? [] };
    }) };
} });
export const exercise = internalAction({ args: { reference: runtimeAuthorityReference }, handler: async (ctx, args) => {
  if (args.reference.tenantId !== EXPECTED_TENANT) throw Error('FIXTURE_SCOPE_DENIED');
  const budget = await ensureBackendGatewayBudget(ctx, { reference: args.reference, operationKey: 'embedding.query', requestId: 'task10-large-profile-commission1',
    requestCanonical: canonicalModelJson({ fixture: 'task10-large-profile-commission1', profile: LARGE_EMBEDDING_PROFILE, value: FIXED_VALUE }) });
  const composition = createBackendGatewayComposition(ctx), events: unknown[] = [];
  const admit = composition.ledger.admit;
  composition.ledger.admit = async request => {
    const result = await admit(request);
    events.push({ phase: 'admit', status: result.status, ...('attemptId' in result ? { attemptId: result.attemptId } : {}), requestInputUnits: JSON.parse(request.requestCanonical).inputTokens,
      ...('snapshot' in result ? { snapshot: result.snapshot } : {}), ledgerState: await ctx.runQuery(makeFunctionReference<'query'>('profileQualification:state'), { reference: args.reference }), at: Date.now() });
    return result;
  };
  const checkpoint = composition.ledger.checkpoint;
  composition.ledger.checkpoint = async request => {
    const result = await checkpoint(request); events.push({ phase: 'checkpoint', attemptId: request.attemptId, at: Date.now() }); return result;
  };
  const capture = composition.terminalSink.capture;
  composition.terminalSink.capture = async evidence => {
    events.push({ phase: 'terminal', receipt: JSON.parse(evidence.receiptCanonical), at: Date.now() }); return await capture(evidence);
  };
  const call = await createGovernedGatewayModel(composition, { reference: args.reference, operationKey: 'embedding.query', runBudgetId: budget.runBudgetId,
    semanticId: 'task10-large-profile-commission1', ordinal: 0 });
  let result: unknown, error: unknown, completionError: unknown;
  try {
    if (!('doEmbed' in call.model) || call.model.modelId !== LARGE_EMBEDDING_PROFILE.modelId) throw Error('FIXTURE_MODEL_DENIED');
    try {
      const embedded = await (call.model as EmbeddingModelV4).doEmbed({ values: [FIXED_VALUE], abortSignal: call.lifecycle.signal });
      const vector = embedded.embeddings[0]!;
      result = { replay: false, modelId: call.model.modelId, profile: LARGE_EMBEDDING_PROFILE, dimensions: vector.length, finite: vector.every(Number.isFinite),
        norm: Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)), vectorHash: await semanticHash(canonicalModelJson(vector)), usage: embedded.usage ?? null,
        inputUtf8Bytes: new TextEncoder().encode(FIXED_VALUE).length };
    } catch (caught) {
      if (!(caught instanceof GatewayDispatchError) || caught.code !== 'REPLAY_AVAILABLE') throw caught;
      const replay = await call.lifecycle.consumeReplay();
      if (!replay || !('vectors' in replay)) throw Error('FIXTURE_REPLAY_DENIED');
      result = { replay: true, profile: replay.profile, dimensions: replay.vectors[0]!.length, vectorHash: await semanticHash(canonicalModelJson(replay.vectors[0]!)) };
    }
  } catch (caught) { error = { name: caught instanceof Error ? caught.name : 'unknown', code: caught instanceof GatewayDispatchError ? caught.code : caught instanceof Error ? caught.message.slice(0,256) : 'unknown' }; }
  finally { try { await call.lifecycle.complete(); } catch (caught) { completionError = { name: caught instanceof Error ? caught.name : 'unknown', code: caught instanceof Error ? caught.message.slice(0,256) : 'unknown' }; } }
  return { scope: 'PRIVATE_FIXED_OPERATOR_QUALIFICATION_NOT_PREEXISTING_PRODUCTION_TRUST', budget, events, result: result ?? null, error: error ?? null, completionError: completionError ?? null };
} });
