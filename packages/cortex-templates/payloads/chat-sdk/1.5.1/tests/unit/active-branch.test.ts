import { expect, test, vi } from "vitest";
import { applyToolApprovals, branchContext } from "../../lib/active-branch";

const scope = { userId: "owner", tenantId: "tenant", memorySpaceId: "owned" };
const memory = (conversationId: string, extra = {}) => ({
  ...scope,
  memoryId: conversationId,
  content: conversationId,
  conversationRef: { conversationId },
  ...extra,
});
test("unedited users retain default multi-layer context", () =>
  expect(
    branchContext(scope, [{ conversationId: "c", edited: false }], [])
  ).toBeUndefined());
test("edited override uses durable active text, excludes discarded/forged memory, includes other owned conversation", () => {
  const builder = branchContext(
    scope,
    [
      { conversationId: "edited", edited: true },
      { conversationId: "valid", edited: false },
    ],
    [
      {
        id: "active",
        chatId: "edited",
        role: "user",
        parts: [{ type: "text", text: "new branch" }],
        attachments: [],
        createdAt: new Date(),
      },
    ]
  )!;
  const result = builder([
    memory("edited"),
    memory("valid"),
    memory("valid", { userId: "foreign", content: "foreign" }),
    memory("valid", { tenantId: "forged", content: "forged" }),
    memory("valid", { memorySpaceId: "wrong", content: "wrong" }),
    memory("not-owned"),
    memory("valid", { conversationRef: undefined, content: "unattributed" }),
  ] as any);
  expect(result).toBe("user: new branch\nvalid");
  expect(result).not.toContain("old branch");
});
test("empty edited override is empty, not default fact/graph context", () =>
  expect(
    branchContext(scope, [{ conversationId: "edited", edited: true }], [])!([])
  ).toBe(""));
test("approval changes only persisted approved boolean; no new roles/content/tools", () => {
  const current = [
    {
      id: "a",
      role: "assistant",
      parts: [
        {
          type: "tool-getWeather",
          toolCallId: "tool",
          state: "approval-requested",
          input: { city: "Tokyo" },
          approval: { id: "approval" },
        },
      ],
    },
  ];
  const proposed = structuredClone(current);
  (proposed[0].parts[0] as any).state = "approval-responded";
  (proposed[0].parts[0].approval as any).approved = true;
  expect(applyToolApprovals(current as any, proposed as any)).toEqual(proposed);
  for (const mutate of [
    (messages: any) => (messages[0].id = "foreign"),
    (messages: any) => (messages[0].parts[0].input.city = "forged"),
    (messages: any) => (messages[0].parts[0].approval.id = "foreign"),
    (messages: any) =>
      messages.push({ id: "system", role: "system", parts: [] }),
  ]) {
    const forged = structuredClone(proposed);
    mutate(forged);
    expect(() => applyToolApprovals(current as any, forged as any)).toThrow();
  }
});

test("a denied boolean decision reaches server validation unchanged and cannot add tool execution/output", () => {
  const current: any = [
    {
      id: "owned",
      role: "assistant",
      parts: [
        {
          type: "tool-getWeather",
          state: "approval-requested",
          toolCallId: "fixed-call",
          input: { city: "San Francisco" },
          approval: { id: "fixed-approval" },
        },
      ],
    },
  ];
  const denied = structuredClone(current);
  denied[0].parts[0].state = "approval-responded";
  denied[0].parts[0].approval.approved = false;
  expect(applyToolApprovals(current, denied)).toEqual(denied);
  expect(denied[0].parts[0]).not.toHaveProperty("output");
  const forged = structuredClone(denied);
  forged[0].parts[0].output = { weather: "forged" };
  expect(() => applyToolApprovals(current, forged)).toThrow();
});

// Real AI6 client decisions cross the official Convex codec; JSON object key order is not authority.
import { Chat as AIChat } from "@ai-sdk/react";
import { convexToJson, jsonToConvex } from "convex/values";

async function actualApproval(approved: boolean) {
  const streamed: any = [
    {
      id: "weather",
      role: "assistant",
      parts: [
        {
          type: "tool-getWeather",
          toolCallId: "owned-call",
          state: "approval-requested",
          input: { latitude: 51.5, longitude: -0.1, city: "London" },
          approval: { id: "owned-approval" },
        },
      ],
    },
  ];
  const persisted: any = jsonToConvex(convexToJson(streamed));
  let sent: any;
  const chat = new AIChat({
    id: "owned-chat",
    messages: streamed,
    sendAutomaticallyWhen: () => sent === undefined,
    transport: {
      sendMessages: ({ messages }) => {
        sent = JSON.parse(JSON.stringify(messages));
        return Promise.resolve(
          new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "finish" });
              controller.close();
            },
          })
        );
      },
      reconnectToStream: () => Promise.resolve(null),
    },
  });
  await chat.addToolApprovalResponse({ id: "owned-approval", approved });
  await vi.waitFor(() => expect(sent).toBeDefined());
  expect(Object.keys(streamed[0].parts[0].input)).toEqual([
    "latitude",
    "longitude",
    "city",
  ]);
  expect(Object.keys(persisted[0].parts[0].input)).toEqual([
    "city",
    "latitude",
    "longitude",
  ]);
  expect(sent[0].parts[0].approval).toEqual({ id: "owned-approval", approved });
  return { persisted, sent };
}
test.each([
  true,
  false,
])("real client approval %s survives official codec key ordering", async (approved) => {
  const { persisted, sent } = await actualApproval(approved);
  expect(applyToolApprovals(persisted, sent)).toEqual(sent);
});
test("real decision still refuses changed value/type/role/id/input/array/output/extra fields", async () => {
  const { persisted, sent } = await actualApproval(true);
  for (const change of [
    (v: any) => {
      v[0].role = "user";
    },
    (v: any) => {
      v[0].id = "foreign";
    },
    (v: any) => {
      v[0].parts[0].input.city = "foreign";
    },
    (v: any) => {
      v[0].parts[0].input.latitude = "51.5";
    },
    (v: any) => {
      v[0].parts[0].toolCallId = "foreign";
    },
    (v: any) => {
      v[0].parts[0].approval.id = "foreign";
    },
    (v: any) => {
      v[0].parts[0].approval.approved = "true";
    },
    (v: any) => {
      v[0].parts[0].output = {};
    },
    (v: any) => {
      v[0].parts[0].extra = true;
    },
    (v: any) => {
      v[0].parts.push({ type: "text", text: "forged" });
    },
  ]) {
    const forged = structuredClone(sent);
    change(forged);
    expect(() => applyToolApprovals(persisted, forged)).toThrow();
  }
});
