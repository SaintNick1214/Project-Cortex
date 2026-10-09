/** Public protected reads are fresh mutations; explicit deployment operators
 * retain the separate legacy query bindings installed by their admin transport. */
import type { ConvexClient } from "convex/browser";
import {
  getFunctionName, makeFunctionReference,
  type FunctionArgs, type FunctionReference, type FunctionReturnType,
} from "convex/server";
import { isDeploymentOperatorClient } from "./deploymentOperator";

export function readBackend<R extends FunctionReference<"query" | "mutation", "public">>(
  client: ConvexClient,
  reference: R,
  args: FunctionArgs<R>,
): Promise<FunctionReturnType<R>> {
  const name = getFunctionName(reference);
  return isDeploymentOperatorClient(client)
    ? client.query(makeFunctionReference<"query", FunctionArgs<R>, FunctionReturnType<R>>(name), args)
    : client.mutation(makeFunctionReference<"mutation", FunctionArgs<R>, FunctionReturnType<R>>(name), args);
}
