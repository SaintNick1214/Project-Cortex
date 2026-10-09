import { test, expect, vi, beforeEach } from "vitest";
import * as queries from "../../lib/db/queries";
import * as data from "../../convex/app/chatData";
import * as users from "../../convex/app/chatUsers";
import { PrivateDb, invoke } from "../helpers/private-db";
const mock = vi.hoisted(() => ({
  session: true,
  sdk: {} as any,
  db: null as any,
  calls: [] as any[],
  failView: false,
  graphModes: [] as boolean[],
}));
vi.mock("@cortexmemory/sdk", () => ({ Cortex: {} }));
vi.mock("bcrypt-ts", () => ({
  hash: vi.fn(async () => "$2b$12$" + "x".repeat(53)),
}));
vi.mock("../../lib/cortex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/cortex")>();
  return {
    ...actual,
    requireScope: async (expected?: string) => {
      if (!mock.session) throw new Error("Sign in required");
      if (expected && expected !== "owner") throw new Error("Foreign owner");
      return { userId: "owner", tenantId: "tenant", memorySpaceId: "owned" };
    },
    withCortex: async (_: unknown, work: any, graph = false) => {
      mock.graphModes.push(graph);
      return work(mock.sdk);
    },
  };
});
vi.mock("../../lib/private-backend", () => ({
  privateConfiguration: () => ({ tenantId: "tenant" }),
  privateCall: async (name: string, args: any) => {
    mock.calls.push([name, args]);
    if (mock.failView && name === "app/chatData:setDocumentVersions")
      throw new Error("View refused");
    const operation = name.split(":")[1];
    return invoke(
      (name.startsWith("app/chatUsers:") ? (users as any) : (data as any))[
        operation
      ],
      mock.db,
      args
    );
  },
}));
const scope = { userId: "owner", tenantId: "tenant", memorySpaceId: "owned" };
const artifact = {
  artifactId: "doc",
  ...scope,
  version: 3,
  kind: "text",
  title: "Owned",
  content: "third",
  createdAt: 1,
  updatedAt: 3,
};
const history = [1, 2, 3].map((version) => ({
  version,
  timestamp: version,
  title: `v${version}`,
  content: `content-${version}`,
}));
beforeEach(() => {
  mock.session = true;
  mock.failView = false;
  mock.calls.length = 0;
  mock.graphModes.length = 0;
  mock.db = new PrivateDb({
    chatUsers: [{ _id: "user", ...scope }],
    conversations: [
      {
        _id: "chat",
        conversationId: "c",
        tenantId: "tenant",
        memorySpaceId: "owned",
        participants: { userId: "owner" },
        metadata: { title: "Owned" },
        visibility: "private",
        createdAt: 1,
        updatedAt: 2,
      },
    ],
    artifacts: [{ _id: "artifact", ...artifact }],
  });
  mock.sdk = {
    memorySpaces: {get: vi.fn(async () => ({memorySpaceId:"owned",tenantId:"tenant"})),register: vi.fn()},
    conversations: {
      get: vi.fn(async () => mock.db.tables.conversations[0]),
      create: vi.fn(),
      list: vi.fn(async () => ({
        conversations: mock.db.tables.conversations,
      })),
      delete: vi.fn(async () => {
        mock.db.tables.conversations = [];
      }),
      deleteMany: vi.fn(async () => ({ deleted: 1 })),
    },
    artifacts: {
      get: vi.fn(async () => mock.db.tables.artifacts[0]),
      getHistory: vi.fn(async () => history),
      getVersion: vi.fn(
        async (_: string, version: number) =>
          history.find((row) => row.version === version) ||
          (version === 4
            ? { version: 4, timestamp: 4, title: "New", content: "new" }
            : null)
      ),
      update: vi.fn(async (_: string, content: string) => {
        const record = mock.db.tables.artifacts[0];
        record.version = 4;
        record.updatedAt = 4;
        record.content = content;
        return record;
      }),
      create: vi.fn(),
      list: vi.fn(async () => mock.db.tables.artifacts),
    },
  };
});
test("single and all owned conversation deletes select configured graph delivery", async () => {
  process.env.CORTEX_GRAPH_SYNC = "true";
  await queries.deleteChatById({ id: "c" });
  expect(mock.sdk.conversations.delete).toHaveBeenCalledExactlyOnceWith("c");
  expect(mock.graphModes).toEqual([true]);
  await queries.deleteAllChatsByUserId({ userId: "owner" });
  expect(mock.sdk.conversations.deleteMany).toHaveBeenCalledExactlyOnceWith({ userId: "owner", memorySpaceId: "owned" });
  expect(mock.graphModes).toEqual([true, true]);
});
test("explicit graph-off delete is supported and foreign identity still refuses", async () => {
  process.env.CORTEX_GRAPH_SYNC = "false";
  await queries.deleteChatById({ id: "c" });
  expect(mock.graphModes).toEqual([false]);
  await expect(queries.deleteAllChatsByUserId({ userId: "foreign" })).rejects.toThrow("Foreign owner");
  expect(mock.sdk.conversations.deleteMany).not.toHaveBeenCalled();
});
test("normal message helper stores real active data and reload/edit uses durable branch", async () => {
  await queries.saveMessages({
    messages: [
      {
        id: "m",
        chatId: "c",
        role: "user",
        parts: [{ type: "text", text: "old" }],
        attachments: [],
        createdAt: new Date(1),
      },
    ],
  });
  expect((await queries.getMessageById({ id: "m" }))[0]).toMatchObject({
    chatId: "c",
    createdAt: new Date(1),
  });
  await queries.deleteMessagesByChatIdAfterTimestamp({
    chatId: "c",
    timestamp: new Date(1),
  });
  expect(await queries.getMessagesByChatId({ id: "c" })).toEqual([]);
  expect(await queries.isBranchEdited("c")).toBe(true);
  await queries.saveMessages({
    messages: [
      {
        id: "m",
        chatId: "c",
        role: "user",
        parts: [{ type: "text", text: "new" }],
        attachments: [],
        createdAt: new Date(2),
      },
    ],
  });
  mock.db = new PrivateDb(mock.db.tables);
  expect((await queries.getMessagesByChatId({ id: "c" }))[0].parts).toEqual([
    { type: "text", text: "new" },
  ]);
});
test("artifact restore keeps selected real SDK version, reload and direct reads exclude discarded versions", async () => {
  expect(
    await queries.deleteDocumentsByIdAfterTimestamp({
      id: "doc",
      timestamp: new Date(1),
    })
  ).toEqual({
    deletedCount: 2,
    retiredVersionCount: 2,
    auditHistoryRetained: true,
  });
  mock.db = new PrivateDb(mock.db.tables);
  expect(
    (await queries.getDocumentsById({ id: "doc" })).map((doc) => doc.content)
  ).toEqual(["content-1"]);
  expect(
    await queries.getDocumentVersion({ id: "doc", version: 2 })
  ).toBeNull();
  expect((await queries.getDocumentById({ id: "doc" }))?.content).toBe(
    "content-1"
  );
  expect(mock.db.tables.artifacts[0].version).toBe(3);
});
test("no-op/out of range restore has no view effects", async () => {
  expect(
    await queries.deleteDocumentsByIdAfterTimestamp({
      id: "doc",
      timestamp: new Date(0),
    })
  ).toEqual({ deletedCount: 0 });
  expect(
    await queries.deleteDocumentsByIdAfterTimestamp({
      id: "doc",
      timestamp: new Date(4),
    })
  ).toEqual({ deletedCount: 0 });
  expect(mock.db.writes).toEqual([]);
});
test("new actual SDK version appends to active list; failed view save reports partial without automatic retry", async () => {
  await queries.deleteDocumentsByIdAfterTimestamp({
    id: "doc",
    timestamp: new Date(1),
  });
  expect(
    (
      await queries.saveDocument({
        id: "doc",
        content: "new",
        title: "New",
        kind: "text",
        userId: "owner",
      })
    ).content
  ).toBe("new");
  expect(mock.db.tables.documentVersions[0].versions).toEqual([1, 4]);
  expect(
    (await queries.getDocumentVersion({ id: "doc", version: 4 }))?.content
  ).toBe("new");
  mock.sdk.artifacts.update.mockImplementation(async () => {
    mock.db.tables.artifacts[0].version = 5;
    return { ...artifact, version: 5 };
  });
  mock.failView = true;
  await expect(
    queries.saveDocument({
      id: "doc",
      content: "partial",
      title: "Partial",
      kind: "text",
      userId: "owner",
    })
  ).rejects.toMatchObject({
    cause: expect.stringContaining("audit version was saved"),
  });
  expect(mock.sdk.artifacts.update).toHaveBeenCalledTimes(2);
  expect(mock.db.tables.documentVersions[0].versions).toEqual([1, 4]);
});
test("undo/redo changes current view while immutable SDK audit stays unchanged", async () => {
  expect(await queries.undoDocumentChange({ id: "doc" })).toEqual({
    success: true,
    version: 2,
  });
  expect((await queries.getDocumentById({ id: "doc" }))?.content).toBe(
    "content-2"
  );
  expect(await queries.redoDocumentChange({ id: "doc" })).toEqual({
    success: true,
    version: 3,
  });
  expect(mock.db.tables.artifacts[0].version).toBe(3);
});
test("owner and parent guards precede artifact writes", async () => {
  mock.db.tables.artifacts[0].userId = "foreign";
  await expect(queries.getDocumentById({ id: "doc" })).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    queries.saveDocument({
      id: "doc",
      content: "x",
      title: "x",
      kind: "text",
      userId: "owner",
    })
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(mock.sdk.artifacts.update).not.toHaveBeenCalled();
  await expect(
    queries.saveChat({
      id: "c",
      userId: "foreign",
      title: "x",
      visibility: "private",
    })
  ).rejects.toThrow("Foreign owner");
  expect(mock.sdk.conversations.create).not.toHaveBeenCalled();
});
test("SDK chat delete also retires active app records", async () => {
  await queries.saveMessages({
    messages: [
      {
        id: "m",
        chatId: "c",
        role: "user",
        parts: [],
        attachments: [],
        createdAt: new Date(),
      },
    ],
  });
  await queries.deleteChatById({ id: "c" });
  expect(mock.db.tables.chatMessages).toEqual([]);
});
test.each([
  () => queries.getChatById({ id: "c" }),
  () => queries.getMessagesByChatId({ id: "c" }),
  () => queries.getVotesByChatId({ id: "c" }),
  () => queries.getSuggestionsByDocumentId({ documentId: "doc" }),
  () => queries.getDocumentById({ id: "doc" }),
  () => queries.getDocumentVersion({ id: "doc", version: 1 }),
  () => queries.updateChatVisibilityById({ chatId: "c", visibility: "public" }),
  () => queries.undoDocumentChange({ id: "doc" }),
  () => queries.deleteChatById({ id: "c" }),
])("missing session refuses real helper before data effects", async (operation) => {
  mock.session = false;
  await expect(operation()).rejects.toThrow("Sign in required");
  expect(mock.calls).toEqual([]);
  expect(mock.sdk.conversations.get).not.toHaveBeenCalled();
  expect(mock.sdk.artifacts.get).not.toHaveBeenCalled();
});

test("artifact lists follow the active selection after reload and reject foreign scope", async () => {
  await queries.undoDocumentChange({ id: "doc" });
  mock.db = new PrivateDb(mock.db.tables);
  expect(
    (await queries.getDocumentsByUserId({ userId: "owner" }))[0].content
  ).toBe("content-2");
  mock.db.tables.artifacts[0].conversationRef = { conversationId: "c" };
  expect(
    (await queries.getDocumentsByConversationId({ conversationId: "c" }))[0]
      .content
  ).toBe("content-2");
  await expect(
    queries.getDocumentsByUserId({ userId: "foreign" })
  ).rejects.toThrow("Foreign owner");
  mock.db.tables.artifacts[0].tenantId = "foreign";
  await expect(
    queries.getDocumentsByConversationId({ conversationId: "c" })
  ).rejects.toMatchObject({ statusCode: 404 });
});

test("account helpers persist regular and guest records and duplicate/error outcomes", async () => {
  const [regular] = await queries.createUser(" Alice@Example.com ", "password");
  expect(regular.email).toBe("alice@example.com");
  expect((await queries.getUser("alice@example.com"))[0]).toMatchObject({
    id: regular.id,
    email: regular.email,
    password: expect.stringMatching(/^\$2b\$12\$/),
  });
  expect(await queries.getUser("absent@example.com")).toEqual([]);
  await expect(
    queries.createUser("alice@example.com", "password")
  ).rejects.toMatchObject({ cause: "Account already exists" });
  await expect(
    queries.createUser("bob@example.com", "x")
  ).rejects.toMatchObject({ statusCode: 400 });
  const [guest] = await queries.createGuestUser();
  expect((await queries.getUser(guest.email))[0]).toMatchObject({
    id: guest.id,
    password: null,
  });
});
test("normal chat metadata, list, count, vote, suggestion and stream helpers have durable outcomes", async () => {
  expect(
    await queries.saveChat({
      id: "c",
      userId: "owner",
      title: "Ignored existing",
      visibility: "private",
    })
  ).toMatchObject({ id: "c", title: "Owned" });
  expect(await queries.getChatById({ id: "c" })).toMatchObject({
    id: "c",
    userId: "owner",
  });
  await queries.updateChatTitleById({
    chatId: "c",
    title: "Renamed",
    userId: "owner",
  });
  await queries.updateChatVisibilityById({ chatId: "c", visibility: "public" });
  expect(
    await queries.getChatsByUserId({
      id: "owner",
      limit: 10,
      startingAfter: null,
      endingBefore: null,
    })
  ).toEqual([
    expect.objectContaining({ title: "Renamed", visibility: "public" }),
  ]);
  await queries.saveMessages({
    messages: [
      {
        id: "m",
        chatId: "c",
        role: "user",
        parts: [{ type: "text", text: "first" }],
        attachments: [],
        createdAt: new Date(),
      },
    ],
  });
  await queries.updateMessage({
    id: "m",
    parts: [{ type: "text", text: "updated" }],
  });
  expect((await queries.getMessageById({ id: "m" }))[0].parts).toEqual([
    { type: "text", text: "updated" },
  ]);
  expect(
    await queries.getMessageCountByUserId({
      id: "owner",
      differenceInHours: 24,
    })
  ).toBe(1);
  await queries.voteMessage({ chatId: "c", messageId: "m", type: "up" });
  expect(await queries.getVotesByChatId({ id: "c" })).toEqual([
    { chatId: "c", messageId: "m", isUpvoted: true },
  ]);
  const suggestion = {
    id: "s",
    documentId: "doc",
    documentCreatedAt: new Date(1),
    originalText: "old",
    suggestedText: "new",
    description: null,
    isResolved: false,
    userId: "owner",
    createdAt: new Date(2),
  };
  await queries.saveSuggestions({ suggestions: [suggestion] });
  expect(
    await queries.getSuggestionsByDocumentId({ documentId: "doc" })
  ).toEqual([suggestion]);
  await queries.createStreamId({ streamId: "stream", chatId: "c" });
  expect(mock.db.tables.chatStreams[0]).toMatchObject({
    streamId: "stream",
    ...scope,
  });
  expect(await queries.getPublicShare("c")).toEqual({
    title: "Renamed",
    createdAt: 1,
    messages: [{ role: "user", text: "updated" }],
  });
  await expect(
    queries.voteMessage({ chatId: "c", messageId: "absent", type: "up" })
  ).rejects.toThrow("Resource unavailable");
  await expect(
    queries.saveSuggestions({
      suggestions: [{ ...suggestion, userId: "foreign" }],
    })
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(await queries.deleteAllChatsByUserId({ userId: "owner" })).toEqual({
    deletedCount: 1,
  });
  expect(mock.db.tables.chatMessages).toEqual([]);
});

test("resubmit uses durable user turn and retires later active replies; forged text or fresh replay refuses", async () => {
  const message = {
    id: "m",
    role: "user" as const,
    parts: [{ type: "text" as const, text: "original" }],
  };
  await queries.saveMessages({
    messages: [
      { ...message, chatId: "c", attachments: [], createdAt: new Date(1) },
      {
        id: "a",
        role: "assistant",
        parts: [{ type: "text", text: "discarded" }],
        chatId: "c",
        attachments: [],
        createdAt: new Date(2),
      },
    ],
  });
  const before = mock.db.writes.length;
  await expect(
    queries.prepareChatMessages({
      chatId: "c",
      message: { ...message, parts: [{ type: "text", text: "forged" }] },
      regenerate: true,
    })
  ).rejects.toMatchObject({ statusCode: 400 });
  await expect(
    queries.prepareChatMessages({ chatId: "c", message, regenerate: false })
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(mock.db.writes).toHaveLength(before);
  expect(
    await queries.prepareChatMessages({
      chatId: "c",
      message,
      regenerate: true,
    })
  ).toEqual([]);
  expect(await queries.isBranchEdited("c")).toBe(true);
  expect(mock.db.tables.conversations).toHaveLength(1);
  await queries.saveMessages({
    messages: [
      { ...message, chatId: "c", attachments: [], createdAt: new Date(3) },
    ],
  });
  expect(
    (await queries.getMessagesByChatId({ id: "c" })).map((row) => row.id)
  ).toEqual(["m"]);
  mock.session = false;
  await expect(
    queries.prepareChatMessages({ chatId: "c", message, regenerate: true })
  ).rejects.toThrow("Sign in required");
});

test.each([
  "text",
  "code",
  "image",
  "sheet",
])("supported %s artifact and version retain exact kind", async (kind) => {
  mock.db.tables.artifacts[0].kind = kind;
  expect((await queries.getDocumentById({ id: "doc" }))?.kind).toBe(kind);
  expect(
    (await queries.getDocumentsById({ id: "doc" })).map(
      (document) => document.kind
    )
  ).toEqual([kind, kind, kind]);
  const saved = await queries.saveDocument({
    id: "doc",
    userId: "owner",
    title: "Saved",
    content: "new",
    kind,
  });
  expect(saved).toMatchObject({ kind, content: "new" });
  expect(mock.sdk.artifacts.update).toHaveBeenCalledExactlyOnceWith(
    "doc",
    "new",
    { title: "Saved", changeSummary: "Updated via Chat SDK" }
  );
  expect(mock.sdk.artifacts.create).not.toHaveBeenCalled();
});
test.each([
  "diagram",
  "html",
  "custom",
])("unsupported %s artifact refuses instead of mislabeling a renderer", async (kind) => {
  mock.db.tables.artifacts[0].kind = kind;
  await expect(queries.getDocumentById({ id: "doc" })).rejects.toMatchObject({
    statusCode: 400,
  });
  await expect(queries.getDocumentsById({ id: "doc" })).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(mock.sdk.artifacts.update).not.toHaveBeenCalled();
  expect(mock.sdk.artifacts.create).not.toHaveBeenCalled();
});
test.each([
  "diagram",
  "html",
  "custom",
])("unsupported %s save refuses before any backend effect", async (kind) => {
  await expect(
    queries.saveDocument({
      id: "doc",
      userId: "owner",
      title: "Unsupported",
      content: "body",
      kind,
    })
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(mock.calls).toEqual([]);
  expect(mock.sdk.artifacts.get).not.toHaveBeenCalled();
  expect(mock.sdk.artifacts.update).not.toHaveBeenCalled();
  expect(mock.sdk.artifacts.create).not.toHaveBeenCalled();
});

test("new chat prepares missing physical registry before creating captured references", async () => {
  mock.sdk.conversations.get.mockResolvedValue(null); mock.sdk.memorySpaces.get.mockResolvedValue(null);
  mock.sdk.conversations.create.mockResolvedValue({...mock.db.tables.conversations[0],conversationId:"new"});
  await queries.saveChat({id:"new",userId:"owner",title:"New",visibility:"private"});
  expect(mock.sdk.memorySpaces.register).toHaveBeenCalledTimes(1);
  expect(mock.sdk.memorySpaces.register).toHaveBeenCalledWith({memorySpaceId:"owned",tenantId:"tenant",type:"personal",participants:[{id:"owner",type:"user"}]});
  expect(mock.sdk.memorySpaces.get.mock.invocationCallOrder[0]).toBeLessThan(mock.sdk.memorySpaces.register.mock.invocationCallOrder[0]);
  expect(mock.sdk.memorySpaces.register.mock.invocationCallOrder[0]).toBeLessThan(mock.sdk.conversations.create.mock.invocationCallOrder[0]);
});
test("new chat with existing registry does not register again", async () => {
  mock.sdk.conversations.get.mockResolvedValue(null); mock.sdk.conversations.create.mockResolvedValue({...mock.db.tables.conversations[0],conversationId:"new"});
  await queries.saveChat({id:"new",userId:"owner",title:"New",visibility:"private"});
  expect(mock.sdk.memorySpaces.register).not.toHaveBeenCalled(); expect(mock.sdk.conversations.create).toHaveBeenCalledTimes(1);
});
test("registry refusal prevents new conversation; unauthenticated scope never touches registry", async () => {
  mock.sdk.conversations.get.mockResolvedValue(null); mock.sdk.memorySpaces.get.mockResolvedValue(null); mock.sdk.memorySpaces.register.mockRejectedValueOnce(new Error("Registry refused"));
  await expect(queries.saveChat({id:"new",userId:"owner",title:"New",visibility:"private"})).rejects.toThrow("Registry refused");
  expect(mock.sdk.conversations.create).not.toHaveBeenCalled(); mock.sdk.memorySpaces.get.mockClear(); mock.session=false;
  await expect(queries.saveChat({id:"new",userId:"owner",title:"New",visibility:"private"})).rejects.toThrow("Sign in required"); expect(mock.sdk.memorySpaces.get).not.toHaveBeenCalled();
});


test("public artifact save and direct read preserve valid empty content", async () => {
  const saved = await queries.saveDocument({ id: "doc", content: "", title: "Blank", kind: "text", userId: "owner" });
  expect(saved.content).toBe("");
  expect(mock.sdk.artifacts.update).toHaveBeenCalledExactlyOnceWith("doc", "", { title: "Blank", changeSummary: "Updated via Chat SDK" });
  expect((await queries.getDocumentById({ id: "doc" }))?.content).toBe("");
});

test("public artifact history preserves an empty version instead of missing content", async () => {
  mock.sdk.artifacts.getHistory.mockResolvedValue([{ version: 3, timestamp: 3, title: "Blank", content: "" }]);
  expect((await queries.getDocumentsById({ id: "doc" })).map((document) => document.content)).toEqual([""]);
});

test("empty current content is retained without history and absent artifact still returns no document", async () => {
  mock.db.tables.artifacts[0].content = "";
  mock.sdk.artifacts.getHistory.mockResolvedValue([]);
  expect((await queries.getDocumentsById({ id: "doc" })).map((document) => document.content)).toEqual([""]);
  mock.sdk.artifacts.get.mockResolvedValue(null);
  expect(await queries.getDocumentById({ id: "doc" })).toBeNull();
  expect(await queries.getDocumentsById({ id: "doc" })).toEqual([]);
});
