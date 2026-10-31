/** Offline private-handler tests use official generic registrations. Genuine
 * installed Convex codegen remains required; this does not create bindings. */
export {
  internalActionGeneric as internalAction,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
} from "convex/server";
