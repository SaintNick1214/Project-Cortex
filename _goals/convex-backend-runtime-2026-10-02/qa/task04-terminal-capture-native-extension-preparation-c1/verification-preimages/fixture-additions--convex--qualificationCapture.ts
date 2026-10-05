/** OFFLINE draft: NOT_FROZEN/NOT_RUN. Parent stages only after refreshed product review. */
import { internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";

/** Genuine nested native mutation rollback; no public route or product handler surrogate. */
export const parentRefinementRollback = internalMutation({
  args: { run: v.string(), attemptId: v.id("runtimeModelAttempts"), dispatchIdentity: v.string(), receiptCanonical: v.string() },
  handler: async (ctx, args) => {
    if (!/^admission-[a-f0-9]{32}$/.test(args.run)) throw new Error("QA_OWNERSHIP_REJECTED");
    const attempt = await ctx.db.get("runtimeModelAttempts", args.attemptId);
    if (!attempt) throw new Error("QA_UNOWNED");
    const operation = await ctx.db.get("runtimeModelOperations", attempt.operationDocumentId);
    if (!operation?.tenantId.startsWith(args.run + "-")) throw new Error("QA_UNOWNED");
    const result = await ctx.runMutation(makeFunctionReference<"mutation", {
      attemptId: typeof args.attemptId; dispatchIdentity: string; receiptCanonical: string;
    }, { evidenceId: string; state: string; settledCostUnits?: number; overrun: boolean }>("runtimeModelPolicy:captureTerminalEvidence"), {
      attemptId: args.attemptId, dispatchIdentity: args.dispatchIdentity, receiptCanonical: args.receiptCanonical,
    });
    if (result.state !== "settled" || result.settledCostUnits !== 150 || !result.overrun) throw new Error("QA_REFINEMENT_NOT_OBSERVED");
    throw new ConvexError({ version: 1, code: "QA_ROLLBACK", message: "Expected native refinement rollback", retryable: false, outcome: "rolled_back" });
  },
});
