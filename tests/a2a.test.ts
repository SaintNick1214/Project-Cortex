/** Current public A2A transcript closure from currentdev9b811b04d.
 * Historical message/ACID/pubsub catalog is retained visibly in legacy-transcript. */
import { A2AValidationError } from "../src";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { createRuntimeFixture } from "./helpers/runtime-fixture";
import { createTestRunContext } from "./helpers/isolation";
import { expectConvexRefusal } from "./helpers/public-contract";

describe("A2A current public contract", () => {
  const run = createTestRunContext();
  const tenantId = run.runId, memorySpaceId = run.memorySpaceId("a2a");
  let fixture: Awaited<ReturnType<typeof createRuntimeFixture>>;
  let cortex: Awaited<ReturnType<typeof createRuntimeFixture>>["cortex"];
  beforeAll(async () => {
    fixture = await createRuntimeFixture(tenantId, memorySpaceId, run.userId("owner"));
    cortex = fixture.cortex;
  });
  afterAll(async () => { await fixture?.close(); });
  const operations = [
    ["send", "mutation", { from: "agent-1", to: "agent-2", message: "owned message" }],
    ["request", "mutation", { from: "agent-1", to: "agent-2", message: "owned request", timeout: 1000 }],
    ["broadcast", "mutation", { from: "agent-1", to: ["agent-2", "agent-3"], message: "owned broadcast" }],
    ["getConversation", "query", { agent1: "agent-1", agent2: "agent-2", limit: 100 }],
  ] as const;
  const rows = async () => ({ conversations: await fixture.ownedRows("conversations"), memories: await fixture.ownedRows("memories") });
  it.each(operations)("%s refuses after actual persisted grants, before transcript effects", async (name, kind, args) => {
    const before = await rows();
    const client = cortex.getClient();
    const selected = { ...args, tenantId, memorySpaceId };
    const operation = kind === "query" ? client.query(makeFunctionReference<"query">(`a2a:${name}`), selected)
      : client.mutation(makeFunctionReference<"mutation">(`a2a:${name}`), selected);
    await expect(operation).rejects.toMatchObject({ data: { code: "CAPABILITY_NOT_READY", retryable: false, outcome: "not_dispatched" } });
    expect(await rows()).toEqual(before);
  });
  it("retains the capability refusal through all four SDK entry points", async () => {
    const before = await rows();
    await expectConvexRefusal(cortex.a2a.send({ from: "agent-1", to: "agent-2", message: "owned message" }), "CAPABILITY_NOT_READY");
    await expectConvexRefusal(cortex.a2a.request({ from: "agent-1", to: "agent-2", message: "owned request", timeout: 1000 }), "CAPABILITY_NOT_READY");
    await expectConvexRefusal(cortex.a2a.broadcast({ from: "agent-1", to: ["agent-2"], message: "owned broadcast" }), "CAPABILITY_NOT_READY");
    await expectConvexRefusal(cortex.a2a.getConversation("agent-1", "agent-2", { limit: 100 }), "CAPABILITY_NOT_READY");
    expect(await rows()).toEqual(before);
  });
  it("does not reveal capability or create transcript effects for an unauthenticated client", async () => {
    const client = new ConvexHttpClient(process.env.CONVEX_URL!, { logger: false });
    const before = await rows();
    await expect(client.mutation(makeFunctionReference<"mutation">("a2a:send"), { from: "agent-1", to: "agent-2", message: "owned message", tenantId, memorySpaceId }))
      .rejects.toMatchObject({ data: { code: "UNAUTHENTICATED", outcome: "not_dispatched" } });
    expect(await rows()).toEqual(before);
  });
  it("rejects a forged tenant without revealing capability or creating transcript effects", async () => {
    const before = await rows();
    await expect(cortex.getClient().mutation(makeFunctionReference<"mutation">("a2a:send"), { from: "agent-1", to: "agent-2", message: "owned message", tenantId: tenantId + "-foreign", memorySpaceId }))
      .rejects.toMatchObject({ data: { code: "FORBIDDEN", outcome: "not_dispatched" } });
    expect(await rows()).toEqual(before);
  });

  describe("Client-Side Validation", () => {
    describe("send() validation", () => {
      it("should throw on missing from agent", async () => {
        await expect(
          cortex.a2a.send({
            from: "",
            to: "agent-2",
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "",
            to: "agent-2",
            message: "test",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(A2AValidationError);
          expect((error as A2AValidationError).code).toBe("INVALID_AGENT_ID");
          expect((error as A2AValidationError).field).toBe("from");
        }
      });

      it("should throw on missing to agent", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "",
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "agent-1",
            to: "",
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_AGENT_ID");
          expect((error as A2AValidationError).field).toBe("to");
        }
      });

      it("should throw on empty message", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("EMPTY_MESSAGE");
        }
      });

      it("should throw on whitespace-only message", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "   \n\t   ",
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on message > 100KB", async () => {
        const largeMessage = "x".repeat(102401); // 100KB + 1 byte

        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: largeMessage,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: largeMessage,
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("MESSAGE_TOO_LARGE");
        }
      });

      it("should throw on invalid importance (-1)", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            importance: -1,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            importance: -1,
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_IMPORTANCE");
        }
      });

      it("should throw on invalid importance (101)", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            importance: 101,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on non-integer importance", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            importance: 50.5,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on invalid agent ID format", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent@invalid!chars",
            to: "agent-2",
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw when from === to", async () => {
        await expect(
          cortex.a2a.send({
            from: "same-agent",
            to: "same-agent",
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "same-agent",
            to: "same-agent",
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe(
            "SAME_AGENT_COMMUNICATION",
          );
        }
      });
    });

    describe("broadcast() validation", () => {
      it("should throw on empty recipients array", async () => {
        await expect(
          cortex.a2a.broadcast({
            from: "sender",
            to: [],
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.broadcast({
            from: "sender",
            to: [],
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("EMPTY_RECIPIENTS");
        }
      });

      it("should throw on duplicate recipients", async () => {
        await expect(
          cortex.a2a.broadcast({
            from: "sender",
            to: ["recipient-1", "recipient-1", "recipient-2"],
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.broadcast({
            from: "sender",
            to: ["recipient-1", "recipient-1"],
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe(
            "DUPLICATE_RECIPIENTS",
          );
        }
      });

      it("should throw on > 100 recipients", async () => {
        const tooManyRecipients = Array.from(
          { length: 101 },
          (_, i) => `recipient-${i}`,
        );

        await expect(
          cortex.a2a.broadcast({
            from: "sender",
            to: tooManyRecipients,
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.broadcast({
            from: "sender",
            to: tooManyRecipients,
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe(
            "TOO_MANY_RECIPIENTS",
          );
        }
      });

      it("should throw on invalid recipient ID", async () => {
        await expect(
          cortex.a2a.broadcast({
            from: "sender",
            to: ["valid-recipient", "invalid@recipient!"],
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw when sender in recipients", async () => {
        await expect(
          cortex.a2a.broadcast({
            from: "sender",
            to: ["recipient-1", "sender", "recipient-2"],
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.broadcast({
            from: "sender",
            to: ["sender"],
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_RECIPIENT");
        }
      });
    });

    describe("getConversation() validation", () => {
      it("should throw when since > until", async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        await expect(
          cortex.a2a.getConversation("agent-1", "agent-2", {
            since: now,
            until: yesterday,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.getConversation("agent-1", "agent-2", {
            since: now,
            until: yesterday,
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_DATE_RANGE");
        }
      });

      it("should throw on invalid minImportance", async () => {
        await expect(
          cortex.a2a.getConversation("agent-1", "agent-2", {
            minImportance: 150,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on limit = 0", async () => {
        await expect(
          cortex.a2a.getConversation("agent-1", "agent-2", {
            limit: 0,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.getConversation("agent-1", "agent-2", {
            limit: 0,
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_LIMIT");
        }
      });

      it("should throw on limit > 1000", async () => {
        await expect(
          cortex.a2a.getConversation("agent-1", "agent-2", {
            limit: 1001,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on negative offset", async () => {
        await expect(
          cortex.a2a.getConversation("agent-1", "agent-2", {
            offset: -1,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.getConversation("agent-1", "agent-2", {
            offset: -1,
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_OFFSET");
        }
      });

      it("should throw on empty agent1", async () => {
        await expect(cortex.a2a.getConversation("", "agent-2")).rejects.toThrow(
          A2AValidationError,
        );
      });

      it("should throw on empty agent2", async () => {
        await expect(cortex.a2a.getConversation("agent-1", "")).rejects.toThrow(
          A2AValidationError,
        );
      });
    });

    describe("request() validation", () => {
      it("should throw on invalid timeout (< 1000ms)", async () => {
        await expect(
          cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            timeout: 500,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            timeout: 500,
          });
        } catch (error) {
          if (error instanceof A2AValidationError) {
            expect(error.code).toBe("INVALID_TIMEOUT");
          }
        }
      });

      it("should throw on invalid timeout (> 300000ms)", async () => {
        await expect(
          cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            timeout: 400000,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on invalid retries (negative)", async () => {
        await expect(
          cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            retries: -1,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            retries: -1,
          });
        } catch (error) {
          if (error instanceof A2AValidationError) {
            expect(error.code).toBe("INVALID_RETRIES");
          }
        }
      });

      it("should throw on invalid retries (> 10)", async () => {
        await expect(
          cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            retries: 11,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw when from === to", async () => {
        await expect(
          cortex.a2a.request({
            from: "same-agent",
            to: "same-agent",
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.request({
            from: "same-agent",
            to: "same-agent",
            message: "test",
          });
        } catch (error) {
          if (error instanceof A2AValidationError) {
            expect(error.code).toBe("SAME_AGENT_COMMUNICATION");
          }
        }
      });
    });
  });
});
