/** Convex action composition for the governed Gateway. No public endpoint or provider bypass. */
import { makeFunctionReference } from "convex/server";
import type { ApiFromModules, FunctionArgs, FunctionReturnType } from "convex/server";
import type { ActionCtx } from "./_generated/server";
import type * as ModelPolicy from "./runtimeModelPolicy";
import { createGovernedGatewayModel, GatewayDispatchError } from "./runtimeGateway";
import type { GatewayBinding, GatewayComposition } from "./runtimeGateway";
import { traceRuntimePhase } from "./runtimeLatencyTrace";

type PolicyApi = ApiFromModules<{ runtimeModelPolicy: typeof ModelPolicy }>["runtimeModelPolicy"];
export type BackendGatewayContext = Pick<ActionCtx, "runQuery" | "runMutation">;
export type BackendGatewayBudgetArgs = FunctionArgs<PolicyApi["ensureBudget"]>;
export type BackendGatewayBudget = FunctionReturnType<PolicyApi["ensureBudget"]>;

/** Types come from the actual internal registrations, including their visibility.
 * Explicit references work during additive installation before host codegen. */
function policyReference<Name extends keyof PolicyApi>(name: Name): PolicyApi[Name] {
  // Convex's constructor nominally returns "public" references. Visibility at
  // dispatch is enforced by the named registration; preserve its inferred type.
  return makeFunctionReference(`runtimeModelPolicy:${name}`) as unknown as PolicyApi[Name];
}
const references = Object.freeze({
  ensureBudget: policyReference("ensureBudget"),
  resolve: policyReference("resolve"),
  admit: policyReference("admit"),
  checkpoint: policyReference("checkpoint"),
  markVisible: policyReference("markVisible"),
  captureTerminalEvidence: policyReference("captureTerminalEvidence"),
  attachTerminalResult: policyReference("attachTerminalResult"),
});

/** Creates/reuses the native account for an exact authorized request. Task05 can
 * instead bind this in its parent mutation using bindTrustedBudget atomically. */
export async function ensureBackendGatewayBudget(
  ctx: BackendGatewayContext, args: BackendGatewayBudgetArgs,
): Promise<BackendGatewayBudget> {
  return await ctx.runMutation(references.ensureBudget, args);
}

/** Every dispatch/visibility/result operation uses the native ledger's current
 * grant, scope epoch, source and tombstone checks. Each secondary call must supply
 * its own operation key, semantic identity/ordinal and optional parent operation.
 * Terminal capture is charge-only: it settles known/uncertain liability atomically
 * even if delivery authority was revoked. Attachment independently fences output.
 * No second settlement, automatic inference retry or fallback is introduced. */
export function createBackendGatewayComposition(ctx: BackendGatewayContext): GatewayComposition {
  type Correlation = { runBudgetId: string; operationKey: string; semanticId?: string };
  const attempts = new Map<string, Correlation>();
  const timed = async <T>(phase: string, correlation: Correlation | undefined, invoke: () => Promise<T>): Promise<T> => {
    if (process.env.CORTEX_RUNTIME_LATENCY_TRACE !== "1") return invoke();
    const started = Date.now();
    const match = correlation?.semanticId?.match(/^cortex:(run:[a-f0-9]{64}):(\d+):\d+$/);
    const runId = match?.[1] ?? correlation?.runBudgetId ?? "unbound-gateway";
    const attemptNumber = match ? Number(match[2]) : 0;
    const metadata = { runBudgetId: correlation?.runBudgetId, semanticId: correlation?.semanticId, operationKey: correlation?.operationKey };
    traceRuntimePhase(runId, attemptNumber, `gateway.ledger.${phase}.begin`, metadata);
    try {
      const result = await invoke();
      traceRuntimePhase(runId, attemptNumber, `gateway.ledger.${phase}.end`, { ...metadata, durationMs: Date.now() - started });
      return result;
    } catch (error) {
      traceRuntimePhase(runId, attemptNumber, `gateway.ledger.${phase}.failed`, { ...metadata, durationMs: Date.now() - started });
      throw error;
    }
  };
  return {
    ledger: {
      resolve: async (args) => {
        const correlation = { runBudgetId: args.runBudgetId, operationKey: args.operationKey };
        const result = await timed("resolve", correlation, () => ctx.runQuery(references.resolve, {
          reference: args.reference, operationKey: args.operationKey, runBudgetId: args.runBudgetId,
          ...(args.source !== undefined ? { source: args.source } : {}),
          ...(args.parentOperationId !== undefined ? { parentOperationId: args.parentOperationId } : {}),
        }));
        if (result.storageLimits.embeddingValuesPerCall !== 1) throw new GatewayDispatchError("CAPABILITY_UNAVAILABLE");
        return { ...result, storageLimits: { ...result.storageLimits, embeddingValuesPerCall: 1 } };
      },
      admit: async (args) => {
        const correlation = { runBudgetId: args.runBudgetId, operationKey: args.operationKey, semanticId: args.semanticId };
        const result = await timed("admit", correlation, () => ctx.runMutation(references.admit, args));
        if (result.status === "reserved") attempts.set(result.attemptId, correlation);
        return result;
      },
      checkpoint: async (args) => await timed("checkpoint", attempts.get(args.attemptId), () => ctx.runMutation(references.checkpoint, args)),
      markVisible: async (args) => {
        const result = await timed("visibility", attempts.get(args.attemptId), () => ctx.runMutation(references.markVisible, args));
        if (result.recorded !== true) throw new GatewayDispatchError("VISIBILITY_NOT_RECORDED");
        return { recorded: true };
      },
      attachTerminalResult: async (args) => await timed("attach", attempts.get(args.attemptId), () => ctx.runMutation(references.attachTerminalResult, args)),
    },
    terminalSink: {
      capture: async (evidence) => await timed("capture", attempts.get(evidence.attemptId), () => ctx.runMutation(references.captureTerminalEvidence, evidence)),
    },
  };
}

/** Production path uses the official Gateway factory. The action owner must await
 * lifecycle.complete() in finally; model construction does not dispatch inference.
 * An empty/unqualified deployment policy still fails closed in the native ledger. */
export async function createBackendGovernedGatewayModel(ctx: BackendGatewayContext, binding: GatewayBinding) {
  return await createGovernedGatewayModel(createBackendGatewayComposition(ctx), binding);
}
