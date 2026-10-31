/** Native authenticated fixture provisioning. Calls still use public registrations
 * and persisted scoped grants; no legacy routing or caller-label authority. */
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { Cortex, type CortexConfig } from "../../src";
import { testDeploymentKey } from "./deployment-operator";

export async function createRuntimeFixture(tenantId: string, memorySpaceIds: string | string[], userId: string, resilience: CortexConfig["resilience"] = { enabled: false }, options: { registerSpaces?: boolean } = {}) {
  const scopes = typeof memorySpaceIds === "string" ? [memorySpaceIds] : [...memorySpaceIds];
  if (!tenantId.trim() || !userId.trim() || scopes.length < 1 || scopes.length > 64 || new Set(scopes).size !== scopes.length || scopes.some(scope => !scope.trim()))
    throw new Error("Runtime fixtures require an explicit bounded owned tenant, scope list and actor.");
  const memorySpaceId = scopes[0]!;
  const url = process.env.CONVEX_URL;
  if (!url) throw new Error("A dedicated runtime fixture URL is required.");
  const key = testDeploymentKey(url);
  const identity = { issuer: `https://cortex-ci.test/${crypto.randomUUID()}`, subject: userId };
  const admin = new ConvexHttpClient(url, { logger: false }) as ConvexHttpClient & {
    setAdminAuth(key: string): void;
    function(name: string, component: undefined, args: Record<string, unknown>): Promise<unknown>;
  };
  admin.setAdminAuth(key);
  const inspector = new ConvexClient(url, { logger: false, unsavedChangesWarning: false });
  (inspector as unknown as { setAdminAuth(key: string): void }).setAdminAuth(key);
  // All authority is provisioned from the caller's fixed list before API calls.
  let principalId: string | undefined;
  for (const scope of scopes) {
    const actor: unknown = await admin.mutation(makeFunctionReference<"mutation">("runtimeAuth:provision"), {
    ...identity, actorKind: "user", metadataUserId: userId, tenantId, memorySpaceId: scope,
    capabilities: ["read", "write", "admin", "storage:read", "storage:write"], resourceAccess: "space",
    });
    if (!actor || typeof actor !== "object" || !("principalId" in actor) || typeof actor.principalId !== "string" || !actor.principalId || (principalId && principalId !== actor.principalId))
      throw new Error("Runtime fixture provisioning did not return one consistent verified principal.");
    principalId = actor.principalId;
  }
  const authenticate = (client: ConvexClient): undefined => {
    (client as unknown as { setAdminAuth(key: string, attributes: typeof identity): void }).setAdminAuth(key, identity);
    if (scopes.length > 1) {
      // Select only already-provisioned owned scopes. Response bindings choose
      // selectors for subsequent ID calls; they never create or broaden grants.
      const contextScopes = new Map<string, string>();
      for (const method of ["query", "mutation"] as const) {
        const original = client[method];
        Object.defineProperty(client, method, { value: async (...args: unknown[]) => {
          // Only these canonical metadata/registry validators accept both scope
          // selectors. Data handlers have distinct validators and must receive
          // the SDK's actual arguments, including genuine refusal cases.
          const name = getFunctionName(args[0] as Parameters<typeof getFunctionName>[0]);
          if (!/^(contexts|agents|sessions|immutable|mutable|memorySpaces):/.test(name))
            return Reflect.apply(original, client, args);
          const selectors = args[1] as { tenantId?: string; memorySpaceId?: string; contextId?: string };
          args[1] = { ...selectors, tenantId: selectors.tenantId ?? tenantId, memorySpaceId: selectors.memorySpaceId ?? (selectors.contextId ? contextScopes.get(selectors.contextId) : undefined) ?? memorySpaceId };
          const result: unknown = await Reflect.apply(original, client, args);
          if (result && typeof result === "object" && "contextId" in result && "memorySpaceId" in result
            && typeof result.contextId === "string" && typeof result.memorySpaceId === "string") {
            if (!scopes.includes(result.memorySpaceId)) throw new Error("Runtime fixture returned an unqualified scope.");
            contextScopes.set(result.contextId, result.memorySpaceId);
          }
          return result;
        } });
      }
    }
    return undefined;
  };
  const cortex = new Cortex({ convexUrl: url, convexLogger: false, auth: { userId, tenantId }, resilience }, { initializeTransport: authenticate });
  if (options.registerSpaces !== false) for (const scope of scopes) await cortex.memorySpaces.register({ memorySpaceId: scope, type: "custom", name: "Owned runtime CI fixture" });
  return {
    cortex, admin, identity, tenantId, memorySpaceId, userId, principalId: principalId!, initializeTransport: authenticate,
    async ownedRows(table: "conversationShares" | "conversationSnapshots" | "contexts" | "agents" | "sessions" | "immutable" | "conversations" | "runtimeConversations" | "runtimeTranscriptMessages" | "memories" | "governancePolicies" | "governanceEnforcement" | "facts" | "mutable" | "artifacts") {
      let cursor: string | null = null;
      const owned: unknown[] = [];
      for (let page = 0; page < 100; page++) {
        const result = await inspector.query(makeFunctionReference<"query">("_system/cli/tableData"), {
          table, order: "desc", paginationOpts: { cursor, numItems: 1000 },
        }) as { page: {tenantId?: string; memorySpaceId?: string}[]; isDone: boolean; continueCursor: string };
        owned.push(...result.page.filter(row => row.tenantId === tenantId && typeof row.memorySpaceId === "string" && scopes.includes(row.memorySpaceId)));
        if (result.isDone) return owned;
        cursor = result.continueCursor;
      }
      throw new Error("Runtime fixture inspection budget exceeded.");
    },
    async close() { await cortex.shutdown(); await inspector.close(); },
  };
}
