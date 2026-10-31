/** Installed only in a new owned disposable host. One V1 stream; no tool effects. */
import { internalAction, internalQuery } from './_generated/server';
import type { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { createBackendGatewayComposition, ensureBackendGatewayBudget } from './runtimeGatewayBackend';
import { createGovernedGatewayModel } from './runtimeGateway';
import { canonicalModelJson } from './_cortex/shared/domain/model_policy';
import { semanticHash } from './_cortex/shared/domain/profile';
import { AGENT_NATIVE_TOOLS, AGENT_TOOL_REGISTRY_VERSION } from './_cortex/shared/domain/agent_tools';
import { V1_REFERENCE, V1_OPERATION } from './renewalV1Scope';

export const snapshot = internalQuery({ args: {}, handler: async ctx => {
  // This brand-new isolated DB has exactly eight historical attempts before this probe.
  // Bounded full reads let the operator assert that every original row stays exact.
  const [accounts, operations, attempts] = await Promise.all([
    ctx.db.query('runtimeBudgetAccounts').take(100), ctx.db.query('runtimeModelOperations').take(100),
    ctx.db.query('runtimeModelAttempts').take(100),
  ]);
  if (accounts.length >= 100 || operations.length >= 100 || attempts.length >= 100) throw Error('V1_LEDGER_BOUND');
  return { accounts, operations, attempts };
} });

function serializablePart(part: LanguageModelV4StreamPart): LanguageModelV4StreamPart {
  if (part.type === 'finish') for (const group of [part.usage.inputTokens, part.usage.outputTokens]) {
    for (const value of Object.values(group)) if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw Error('V1_USAGE_INVALID');
  }
  return JSON.parse(JSON.stringify(part)) as LanguageModelV4StreamPart;
}

export const observe = internalAction({ args: {}, handler: async ctx => {
  const semanticId = V1_OPERATION + ':fixed-stream';
  const budget = await ensureBackendGatewayBudget(ctx, { reference: V1_REFERENCE, operationKey: 'agent.respond', requestId: semanticId,
    requestCanonical: canonicalModelJson({ fixedV1Qualification: V1_OPERATION, maximumRequests: 1 }) });
  const composition = createBackendGatewayComposition(ctx), admissions: unknown[] = [], terminalReceipts: unknown[] = [];
  const admit = composition.ledger.admit;
  composition.ledger.admit = async input => {
    const admitted = await admit(input);
    const request = JSON.parse(input.requestCanonical) as { inputTokens: number; outputTokens: number; tools?: unknown };
    admissions.push({ status: admitted.status, inputTokens: request.inputTokens, outputTokens: request.outputTokens,
      requestHash: await semanticHash(input.requestCanonical), toolsCanonical: canonicalModelJson(request.tools),
      ...(admitted.status === 'reserved' ? { registryVersion: admitted.snapshot.pins.toolRegistryVersion,
        boundRevision: admitted.snapshot.pins.boundRevision, reservationUnits: admitted.snapshot.costBound.maximumCostUnits } : {}) });
    return admitted;
  };
  const capture = composition.terminalSink.capture;
  composition.terminalSink.capture = async input => {
    terminalReceipts.push({ capturedAt: Date.now(), receipt: JSON.parse(input.receiptCanonical) }); return capture(input);
  };
  const handle = await createGovernedGatewayModel(composition, { reference: V1_REFERENCE, operationKey: 'agent.respond',
    runBudgetId: budget.runBudgetId, semanticId, ordinal: 0 });
  const checkedAt = Date.now(), parts: unknown[] = [];
  let error: string | null = null, completionError: string | null = null, readerDone = false, readerLockReleased = false, replay = false;
  try {
    replay = !!await handle.lifecycle.consumeReplay();
    if (!replay) {
      const input: LanguageModelV4CallOptions = {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Call memory_recall once with text "jasmine tea" and limit 1. Return no other tool calls.' }] }],
        tools: JSON.parse(canonicalModelJson(AGENT_NATIVE_TOOLS)), toolChoice: { type: 'tool', toolName: 'memory_recall' },
        maxOutputTokens: 512, abortSignal: handle.lifecycle.signal,
      };
      const stream = await (handle.model as LanguageModelV4).doStream(input), reader = stream.stream.getReader();
      try {
        for (;;) {
          const row = await reader.read(); if (row.done) { readerDone = true; break; }
          parts.push(serializablePart(row.value));
          if (new TextEncoder().encode(canonicalModelJson(parts)).length > 60000) throw Error('V1_OUTPUT_LIMIT');
        }
      } finally {
        if (!readerDone) await reader.cancel().catch(() => {});
        reader.releaseLock(); readerLockReleased = true;
      }
    }
  } catch { error = 'V1_STREAM_FAILED_OR_UNKNOWN'; }
  finally { try { await handle.lifecycle.complete(); } catch { completionError = 'V1_COMPLETE_FAILED_OR_UNKNOWN'; } }
  return { checkedAt, completedAt: Date.now(), semanticId, runBudgetId: budget.runBudgetId,
    registryVersion: AGENT_TOOL_REGISTRY_VERSION, boundRevision: 'agent-tools-32768-512-v1', modelId: handle.model.modelId,
    admissions, terminalReceipts, parts, readerDone, readerLockReleased, replay, error, completionError };
} });
