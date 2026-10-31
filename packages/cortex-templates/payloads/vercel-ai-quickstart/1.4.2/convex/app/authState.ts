import { internalQuery } from "../_generated/server";
export const status = internalQuery({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db
      .query("appAuthState")
      .withIndex("by_key", (q) => q.eq("key", "setup"))
      .unique();
    return { isSetup: state?.bootstrapComplete === true };
  },
});
