/** Actual managed outcomes. Missing auth/model prerequisites fail explicitly; no skip or arbitrary vector fixture. */
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import type { CortexRuntimeClient } from "../../src/client-runtime/client";
import type { RuntimeConversation, RuntimeTranscriptPage } from "../../src/client-runtime/types";
import type { EmbeddingProfile } from "../../src/domain/profile";
import { DEFAULT_EMBEDDING_PROFILE, assertProfileMatches } from "../../src/domain/profile";
import { actualHttpClient, actualRuntimeClient, actualRuntimeFixture } from "../helpers/runtime-fixtures";
import type { ActualRuntimeFixture } from "../helpers/runtime-fixtures";

const mutation = <A extends Record<string, unknown>, R>(name: string) => makeFunctionReference<"mutation", A, R>(name);
const action = <A extends Record<string, unknown>, R>(name: string) => makeFunctionReference<"action", A, R>(name);
async function denied(operation: Promise<unknown>, code = "FORBIDDEN") {
  try { await operation; throw new Error("Expected authorization denial"); }
  catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<{ code: string }>).data.code).toBe(code);
  }
}

describe("Actual CI runtime fixtures", () => {
  let fixture: ActualRuntimeFixture, owner: ConvexHttpClient, reader: ConvexHttpClient, outsider: ConvexHttpClient;
  let runtime: CortexRuntimeClient | undefined, conversation: RuntimeConversation;
  const session = mutation<Record<string, unknown>, { principalId: string; tenantId: string; memorySpaceId: string }>("runtimeClient:session");
  const create = mutation<Record<string, unknown>, RuntimeConversation>("runtimeTranscript:create");
  const append = mutation<Record<string, unknown>, unknown>("runtimeTranscript:append");
  const get = mutation<Record<string, unknown>, RuntimeConversation>("runtimeTranscript:get");
  const messages = mutation<Record<string, unknown>, RuntimeTranscriptPage>("runtimeTranscript:messages");
  const selector = () => ({ tenantId: fixture.tenantId, memorySpaceId: fixture.memorySpaceId, conversationId: conversation.conversationId });

  beforeAll(() => {
    fixture = actualRuntimeFixture(); owner = actualHttpClient("owner"); reader = actualHttpClient("reader");
    outsider = actualHttpClient("outsider"); runtime = actualRuntimeClient("owner");
  });
  afterAll(async () => { if (runtime) await runtime.close(); });

  it("verifies the host JWT on HTTP and the official reactive client with the same scoped identity", async () => {
    const http = await owner.mutation(session, { tenantId: fixture.tenantId, memorySpaceId: fixture.memorySpaceId });
    const reactive = await runtime!.session();
    expect(http.tenantId).toBe(fixture.tenantId); expect(http.memorySpaceId).toBe(fixture.memorySpaceId);
    expect(reactive.principalId).toBe(http.principalId); expect(reactive.tenantId).toBe(http.tenantId);
  });

  it("denies unauthenticated, substituted tenant and cross-tenant verified identities", async () => {
    const anonymous = new ConvexHttpClient(fixture.deploymentUrl);
    await denied(anonymous.mutation(session, { tenantId: fixture.tenantId, memorySpaceId: fixture.memorySpaceId }), "UNAUTHENTICATED");
    await denied(owner.mutation(session, { tenantId: fixture.identities.outsider.tenantId, memorySpaceId: fixture.memorySpaceId }));
    await denied(outsider.mutation(session, { tenantId: fixture.tenantId, memorySpaceId: fixture.memorySpaceId }));
    const own = await outsider.mutation(session, { tenantId: fixture.identities.outsider.tenantId, memorySpaceId: fixture.identities.outsider.memorySpaceId });
    expect(own.tenantId).toBe(fixture.identities.outsider.tenantId);
  });

  it("creates one canonical locked conversation for an idempotent request", async () => {
    const args = { memorySpaceId: fixture.memorySpaceId, clientRequestId: `actual-${fixture.runId}-transcript` };
    conversation = await owner.mutation(create, args);
    const replay = await owner.mutation(create, args);
    expect(replay.conversationId).toBe(conversation.conversationId);
    expect(conversation.manualWriteLocked).toBe(true); expect(conversation.messageCount).toBe(0);
    await denied(owner.mutation(append, { ...selector(), expectedRevision: conversation.historyRevision, role: "user", parts: [{ type: "text", text: "Locked input" }] }), "TRANSCRIPT_LOCKED");
  });

  it("preserves read-only capability restrictions and cross-tenant transcript privacy", async () => {
    await denied(reader.mutation(create, { memorySpaceId: fixture.memorySpaceId, clientRequestId: `reader-${fixture.runId}` }));
    await denied(outsider.mutation(get, selector()));
    expect((await owner.mutation(messages, { ...selector(), limit: 10 })).page).toEqual([]);
  });

  it("unlocks only through admin policy, rejects a stale revision and persists one authoritative message", async () => {
    const policy = mutation<Record<string, unknown>, { historyRevision: number }>("runtimeTranscript:setPolicy");
    const unlocked = await owner.mutation(policy, { ...selector(), expectedRevision: conversation.historyRevision, manualWriteLocked: false });
    await denied(reader.mutation(policy, { ...selector(), expectedRevision: unlocked.historyRevision, manualWriteLocked: true }));
    await denied(owner.mutation(append, { ...selector(), expectedRevision: conversation.historyRevision, role: "user", parts: [{ type: "text", text: "Stale input" }] }), "IDEMPOTENCY_CONFLICT");
    const text = `CI authoritative message ${fixture.runId}`;
    await owner.mutation(append, { ...selector(), expectedRevision: unlocked.historyRevision, role: "user", parts: [{ type: "text", text }] });
    const page = await owner.mutation(messages, { ...selector(), limit: 10 });
    expect(page.page).toHaveLength(1); expect(page.page[0]!.role).toBe("user");
    expect(page.page[0]!.parts).toEqual([{ type: "text", text }]);
    expect((await owner.mutation(get, selector())).messageCount).toBe(1);
  });

  it("rejects client-provided arbitrary vectors through the preserved legacy endpoint", async () => {
    const store = mutation<Record<string, unknown>, unknown>("memories:store");
    await denied(owner.mutation(store, { memorySpaceId: fixture.memorySpaceId, tenantId: fixture.tenantId,
      content: "Unproven vector", contentType: "raw", sourceType: "system", importance: 50, tags: [], embedding: Array(1536).fill(0.1) }), "PROFILE_NOT_READY");
  });

  it("uses governed real extraction/embeddings with matching source and profile provenance, and replays one receipt", async () => {
    const profile = mutation<Record<string, unknown>, { profile: EmbeddingProfile }>("runtimeMemory:defaultProfile");
    const selected = await owner.mutation(profile, { tenantId: fixture.tenantId, memorySpaceId: fixture.memorySpaceId });
    assertProfileMatches(selected.profile, DEFAULT_EMBEDDING_PROFILE);
    const remember = action<Record<string, unknown>, { receiptId: string; sourceId: string; sourceRevision: number; created: boolean }>("runtimeMemory:remember");
    const args = { tenantId: fixture.tenantId, memorySpaceId: fixture.memorySpaceId,
      text: `The CI library access code for ${fixture.runId} is amber-saffron-731.`, requestId: `actual-${fixture.runId}-remember` };
    const result = await owner.action(remember, args);
    const replay = await owner.action(remember, args);
    expect(result.sourceRevision).toBe(1); expect(result.created).toBe(true);
    expect(replay.receiptId).toBe(result.receiptId); expect(replay.sourceId).toBe(result.sourceId); expect(replay.created).toBe(false);
    const recalled = await runtime!.recall({ text: `What is the CI library access code for ${fixture.runId}?`, requestId: `actual-${fixture.runId}-recall`, limit: 20 });
    expect(recalled.profileId).toBe(selected.profile.profileId);
    const vector = recalled.items.find(item => item.type === "memory" && item.source === "vector" && item.content.includes("amber-saffron-731"));
    expect(vector).toBeDefined(); expect(vector!.memory?.tenantId).toBe(fixture.tenantId);
    expect(vector!.memory?.memorySpaceId).toBe(fixture.memorySpaceId); expect(vector!.memory?.version).toBe(1);
  }, 120000);
});
