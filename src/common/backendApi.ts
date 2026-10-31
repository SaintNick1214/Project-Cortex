/** Legacy SDK argument contracts, inferred from genuine internal backend bindings.
 * Runtime names remain public in ordinary mode. Explicit deploymentOperator mode
 * routes them to internal registrations; unsupported public names fail closed.
 */
import { anyApi, type ApiFromModules, type FilterApi, type FunctionReference } from "convex/server";
// Infer only genuine entry modules. Importing the host's entire generated API
// here creates a cycle when this SDK helper itself belongs to that host closure.
type PublicApi = FilterApi<ApiFromModules<{
  agents: typeof import("../../convex-dev/agents");
  artifacts: typeof import("../../convex-dev/artifacts");
  attachments: typeof import("../../convex-dev/attachments");
  contexts: typeof import("../../convex-dev/contexts");
  conversationShares: typeof import("../../convex-dev/conversationShares");
  conversationSnapshots: typeof import("../../convex-dev/conversationSnapshots");
  conversations: typeof import("../../convex-dev/conversations");
  factHistory: typeof import("../../convex-dev/factHistory");
  facts: typeof import("../../convex-dev/facts");
  governance: typeof import("../../convex-dev/governance");
  graphSync: typeof import("../../convex-dev/graphSync");
  immutable: typeof import("../../convex-dev/immutable");
  memories: typeof import("../../convex-dev/memories");
  memorySpaces: typeof import("../../convex-dev/memorySpaces");
  mutable: typeof import("../../convex-dev/mutable");
  sessions: typeof import("../../convex-dev/sessions");
}>, FunctionReference<"query" | "mutation" | "action", "public">>;
type OperatorApi = ApiFromModules<{
  admin: typeof import("../../convex-dev/cliOperator/admin");
  memories: typeof import("../../convex-dev/cliOperator/memories");
  facts: typeof import("../../convex-dev/cliOperator/facts");
  factHistory: typeof import("../../convex-dev/cliOperator/factHistory");
  conversations: typeof import("../../convex-dev/cliOperator/conversations");
  memorySpaces: typeof import("../../convex-dev/cliOperator/memorySpaces");
  immutable: typeof import("../../convex-dev/cliOperator/immutable");
  graphSync: typeof import("../../convex-dev/cliOperator/graphSync");
  agents: typeof import("../../convex-dev/cliOperator/agents");
  mutable: typeof import("../../convex-dev/cliOperator/mutable");
  artifacts: typeof import("../../convex-dev/cliOperator/artifacts");
  attachments: typeof import("../../convex-dev/cliOperator/attachments");
}>;

type ClientReference<T> = T extends FunctionReference<infer Kind, "internal", infer Args, infer Result, infer Component>
  ? FunctionReference<Kind, "public", Args, Result, Component>
  : { [Key in keyof T]: ClientReference<T[Key]> };
type WithPublicResult<Legacy, Public> = Legacy extends FunctionReference<infer Kind, "public", infer Args, infer Result, infer Component>
  ? Public extends FunctionReference<infer _PublicKind, "public", infer PublicArgs, infer PublicResult, infer _PublicComponent>
    ? FunctionReference<Kind, "public", Args | PublicArgs, Result | PublicResult, Component> : Legacy
  : Legacy;
type LegacyAgents = ClientReference<OperatorApi["agents"]>;
type LegacyImmutable = ClientReference<OperatorApi["immutable"]>;
type LegacyApi = {
  admin: ClientReference<OperatorApi["admin"]>;
  memories: ClientReference<OperatorApi["memories"]>;
  facts: ClientReference<OperatorApi["facts"]>;
  factHistory: ClientReference<OperatorApi["factHistory"]>;
  conversations: ClientReference<OperatorApi["conversations"]>;
  memorySpaces: ClientReference<OperatorApi["memorySpaces"]>;
  immutable: Omit<LegacyImmutable, "store"> & {
    store: WithPublicResult<LegacyImmutable["store"], PublicApi["immutable"]["store"]>;
  };
  graphSync: ClientReference<OperatorApi["graphSync"]>;
  agents: Omit<LegacyAgents, "register" | "update"> & {
    register: WithPublicResult<LegacyAgents["register"], PublicApi["agents"]["register"]>;
    update: WithPublicResult<LegacyAgents["update"], PublicApi["agents"]["update"]>;
  };
  mutable: ClientReference<OperatorApi["mutable"]>;
  artifacts: ClientReference<OperatorApi["artifacts"]>;
  attachments: ClientReference<OperatorApi["attachments"]>;
};
// Convex uses the same reference representation for public and internal paths.
// Visibility is enforced by the server, never by this TypeScript annotation.
type PublicAndOperatorDomain<Legacy, Public> = {
  [Key in keyof Legacy]: Key extends keyof Public ? WithPublicResult<Legacy[Key], Public[Key]> : Legacy[Key];
} & Omit<Public, keyof Legacy>;
type CombinedApi = {
  [Domain in keyof LegacyApi]: Domain extends keyof PublicApi ? PublicAndOperatorDomain<LegacyApi[Domain], (PublicApi)[Domain]> : LegacyApi[Domain];
};
type BackendApi = Omit<PublicApi, keyof LegacyApi> & CombinedApi;
export const api: BackendApi = anyApi as unknown as BackendApi;
