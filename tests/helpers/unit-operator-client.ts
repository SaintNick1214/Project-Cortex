/** In-memory transport for SDK unit tests. No key or server authority is implied.
 * Real native administration/refusal is covered by the integration fixtures. */
import { jest } from "@jest/globals";
import type { ConvexClient } from "convex/browser";
import { enableDeploymentOperator } from "../../src/common/deploymentOperator";

export function createUnitOperatorClient() {
  const mutation = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const query = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const transport = {
    mutation, query,
    action: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    onUpdate: jest.fn<(...args: unknown[]) => unknown>(),
  };
  enableDeploymentOperator(transport as unknown as ConvexClient);
  // Return the original spies separately from the real routing wrappers.
  return { mutation, query, transport };
}
