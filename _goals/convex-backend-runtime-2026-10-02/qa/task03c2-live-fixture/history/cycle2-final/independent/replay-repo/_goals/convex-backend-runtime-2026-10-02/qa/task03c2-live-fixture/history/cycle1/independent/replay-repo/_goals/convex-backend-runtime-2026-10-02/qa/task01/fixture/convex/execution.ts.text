import { v } from "convex/values";
import { internal } from "./_generated/api";
import { workflow } from "./runtime";

export const execute = workflow.define({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (step,args): Promise<null> => {
    await step.runAction(internal.inference.execute, args, { retry: false });
    return null;
  },
});
