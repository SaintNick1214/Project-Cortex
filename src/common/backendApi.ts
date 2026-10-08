/** Legacy SDK argument contracts, inferred from genuine internal backend bindings.
 * Runtime names remain public in ordinary mode. Explicit deploymentOperator mode
 * routes them to internal registrations; unsupported public names fail closed.
 */
import { anyApi, type FunctionReference } from "convex/server";
import { api as publicApi, internal } from "../../convex-dev/_generated/api";

type ClientReference<T> = T extends FunctionReference<infer Kind, "internal", infer Args, infer Result, infer Component>
  ? FunctionReference<Kind, "public", Args, Result, Component>
  : { [Key in keyof T]: ClientReference<T[Key]> };
type WithPublicResult<Legacy, Public> = Legacy extends FunctionReference<infer Kind, "public", infer Args, infer Result, infer Component>
  ? Public extends FunctionReference<Kind, "public", infer _PublicArgs, infer PublicResult, infer _PublicComponent>
    ? FunctionReference<Kind, "public", Args, Result | PublicResult, Component> : Legacy
  : Legacy;
type LegacyAgents = ClientReference<typeof internal.cliOperator.agents>;
type LegacyImmutable = ClientReference<typeof internal.cliOperator.immutable>;
type LegacyApi = {
  admin: ClientReference<typeof internal.cliOperator.admin>;
  memories: ClientReference<typeof internal.cliOperator.memories>;
  facts: ClientReference<typeof internal.cliOperator.facts>;
  factHistory: ClientReference<typeof internal.cliOperator.factHistory>;
  conversations: ClientReference<typeof internal.cliOperator.conversations>;
  memorySpaces: ClientReference<typeof internal.cliOperator.memorySpaces>;
  immutable: Omit<LegacyImmutable, "store"> & {
    store: WithPublicResult<LegacyImmutable["store"], typeof publicApi.immutable.store>;
  };
  graphSync: ClientReference<typeof internal.cliOperator.graphSync>;
  agents: Omit<LegacyAgents, "register" | "update"> & {
    register: WithPublicResult<LegacyAgents["register"], typeof publicApi.agents.register>;
    update: WithPublicResult<LegacyAgents["update"], typeof publicApi.agents.update>;
  };
  mutable: ClientReference<typeof internal.cliOperator.mutable>;
  artifacts: ClientReference<typeof internal.cliOperator.artifacts>;
  attachments: ClientReference<typeof internal.cliOperator.attachments>;
};
// Convex uses the same reference representation for public and internal paths.
// Visibility is enforced by the server, never by this TypeScript annotation.
export const api = anyApi as unknown as Omit<typeof publicApi, keyof LegacyApi> & LegacyApi;
