/** Native proof tests select one dedicated deployment before any fixture I/O. */
import { randomUUID } from "node:crypto";
import { ConvexHttpClient, type ConvexClient } from "convex/browser";
import { enableDeploymentOperator } from "../../src/common/deploymentOperator";
import { testDeploymentKey } from "./deployment-operator";

export function nativeTarget(): { url: string; key: string } {
  const url = process.env.CONVEX_URL;
  if (!url || url !== process.env.CORTEX_CI_EXPECTED_CONVEX_URL)
    throw new Error("Native proof tests require an exact dedicated CORTEX_CI_EXPECTED_CONVEX_URL target.");
  const selected = new URL(url);
  if (selected.origin !== url || selected.username || selected.password ||
      !(selected.protocol === "https:" || selected.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(selected.hostname)))
    throw new Error("Native proof tests require a qualified deployment origin.");
  return { url, key: testDeploymentKey(url) };
}

export interface NativeAdmin {
  setAdminAuth(key: string): void;
  function(name: string, component: undefined, args: Record<string, unknown>): Promise<unknown>;
}

/** Ordinary clients stay separate for public/authentication refusal assertions. */
export function nativeAdmin(): ConvexHttpClient & NativeAdmin {
  const { url, key } = nativeTarget();
  const client = new ConvexHttpClient(url, { logger: false }) as ConvexHttpClient & NativeAdmin;
  client.setAdminAuth(key);
  return client;
}

export function operatorClient<T>(client: T): T {
  nativeTarget();
  enableDeploymentOperator(client as unknown as ConvexClient);
  return client;
}

export function nativeOperator(): ConvexHttpClient & NativeAdmin {
  return operatorClient(nativeAdmin());
}

export const proofPrefix = (label: string): string => `${label}-${randomUUID()}`;
export const publicFunctionName = (name: string): string => name.replace(/^cliOperator\//, "");
export const operatorFunctionName = (name: string): string =>
  /^(facts|factHistory|memories|conversations|memorySpaces|immutable):/.test(name) ? `cliOperator/${name}` : name;
