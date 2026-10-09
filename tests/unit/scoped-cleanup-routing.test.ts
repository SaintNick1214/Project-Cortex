import { expect, it, jest } from "@jest/globals";
import type { ConvexClient } from "convex/browser";
import { getFunctionName } from "convex/server";
import * as conversations from "../../convex-dev/cliOperator/conversations";
import * as memorySpaces from "../../convex-dev/cliOperator/memorySpaces";
import * as memories from "../../convex-dev/cliOperator/memories";
import * as facts from "../../convex-dev/cliOperator/facts";
import * as immutable from "../../convex-dev/cliOperator/immutable";
import * as mutable from "../../convex-dev/cliOperator/mutable";
import * as agents from "../../convex-dev/cliOperator/agents";
import * as contexts from "../../convex-dev/contexts";
import { enableDeploymentOperator } from "../../src/common/deploymentOperator";
import { ScopedCleanup } from "../helpers/cleanup";
import { createTestRunContext } from "../helpers/isolation";

it("uses registered operator Query reads and fresh context Mutations while deleting only its prefix", async () => {
  const ctx = createTestRunContext(), space = ctx.memorySpaceId("owned");
  const modules: Record<string, Record<string, unknown>> = {
    "cliOperator/conversations": conversations, "cliOperator/memorySpaces": memorySpaces,
    "cliOperator/memories": memories, "cliOperator/facts": facts,
    "cliOperator/immutable": immutable, "cliOperator/mutable": mutable,
    "cliOperator/agents": agents, contexts,
  };
  const foreign = {
    conversations: { conversationId: "foreign-conversation", memorySpaceId: "foreign-space" },
    spaces: { memorySpaceId: "foreign-space" },
    contexts: { contextId: "foreign-context", memorySpaceId: "foreign-space" },
    immutable: { type: "foreign-type", id: "foreign-id" },
    user: { type: "user", id: "foreign-user" },
    agent: { agentId: "foreign-agent" },
  };
  const rows = {
    conversations: [foreign.conversations, { conversationId: ctx.conversationId("owned"), memorySpaceId: space }],
    spaces: [foreign.spaces, { memorySpaceId: space }],
    contexts: [foreign.contexts, { contextId: ctx.contextId("owned"), memorySpaceId: space }],
    immutable: [foreign.immutable, foreign.user, { type: ctx.immutableType("owned"), id: ctx.immutableId("owned") }, { type: "user", id: ctx.userId("owned") }],
    agents: [foreign.agent, { agentId: ctx.agentId("owned") }],
    memories: [{ memoryId: ctx.memorySpaceId("memory") }],
    facts: [{ factId: ctx.factPrefix("owned") }],
  };
  const calls: { kind: string; name: string; args: Record<string, unknown> }[] = [];
  const dispatch = (kind: "query" | "mutation") => jest.fn(async (ref: unknown, raw: unknown) => {
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]), [domain, operation] = name.split(":");
    const registration = modules[domain]?.[operation];
    expect(typeof registration).toBe("function");
    expect(registration).toHaveProperty(kind === "query" ? "isQuery" : "isMutation", true);
    const args = raw as Record<string, unknown>; calls.push({ kind, name, args });
    switch (name) {
      case "cliOperator/conversations:list": return { conversations: rows.conversations };
      case "cliOperator/memorySpaces:list": return { spaces: rows.spaces };
      case "cliOperator/memories:list": expect(args.memorySpaceId).toBe(space); return rows.memories;
      case "cliOperator/facts:list": expect(args.memorySpaceId).toBe(space); return rows.facts;
      case "cliOperator/immutable:list": return { entries: rows.immutable.filter(row => args.type === undefined || row.type === args.type) };
      case "cliOperator/agents:list": return rows.agents;
      case "contexts:list": return rows.contexts;
      case "cliOperator/conversations:deleteConversation": rows.conversations = rows.conversations.filter(row => row.conversationId !== args.conversationId); break;
      case "cliOperator/memorySpaces:deleteSpace": rows.spaces = rows.spaces.filter(row => row.memorySpaceId !== args.memorySpaceId); break;
      case "cliOperator/memories:deleteMemory": expect(args.memorySpaceId).toBe(space); rows.memories = rows.memories.filter(row => row.memoryId !== args.memoryId); break;
      case "cliOperator/facts:deleteFact": expect(args.memorySpaceId).toBe(space); rows.facts = rows.facts.filter(row => row.factId !== args.factId); break;
      case "contexts:deleteContext": rows.contexts = rows.contexts.filter(row => row.contextId !== args.contextId); break;
      case "cliOperator/immutable:purge": rows.immutable = rows.immutable.filter(row => row.type !== args.type || row.id !== args.id); break;
      case "cliOperator/agents:unregister": rows.agents = rows.agents.filter(row => row.agentId !== args.agentId); break;
      case "cliOperator/mutable:purgeNamespace": expect(String(args.namespace).startsWith(ctx.runId)).toBe(true); return { deleted: 0 };
      default: throw new Error(`Unexpected cleanup operation ${name}`);
    }
    return { deleted: true };
  });
  const action = jest.fn();
  const client = { query: dispatch("query"), mutation: dispatch("mutation"), action, onUpdate: jest.fn() } as unknown as ConvexClient;
  enableDeploymentOperator(client);
  const cleanup = new ScopedCleanup(client, ctx);
  await expect(cleanup.cleanupAll()).resolves.toEqual({ conversations: 1, memories: 1, facts: 1, contexts: 1, memorySpaces: 1, users: 1, agents: 1, immutable: 1, mutable: 0, total: 8 });
  await expect(cleanup.verifyCleanup()).resolves.toBe(true);
  expect(rows).toEqual({ conversations: [foreign.conversations], spaces: [foreign.spaces], contexts: [foreign.contexts], immutable: [foreign.immutable, foreign.user], agents: [foreign.agent], memories: [], facts: [] });
  expect(calls.filter(call => call.kind === "query").map(call => call.name)).toContain("cliOperator/memorySpaces:list");
  expect(calls.filter(call => call.name === "contexts:list").every(call => call.kind === "mutation")).toBe(true);
  expect(action).not.toHaveBeenCalled();
});
