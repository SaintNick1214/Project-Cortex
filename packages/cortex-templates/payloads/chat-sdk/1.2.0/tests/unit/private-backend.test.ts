import * as data from "../../convex/app/chatData";
import * as users from "../../convex/app/chatUsers";
import { PrivateDb, invoke } from "../helpers/private-db";
const scope = { userId: "owner", tenantId: "tenant", memorySpaceId: "owned" };
const message = {
  id: "m",
  chatId: "c",
  role: "user",
  parts: [{ type: "text", text: "old" }],
  attachments: [],
  createdAt: 1,
};
const suggestion = {
  id: "s",
  documentId: "doc",
  documentCreatedAt: 1,
  originalText: "old",
  suggestedText: "new",
  isResolved: false,
  userId: "owner",
  createdAt: 3,
};
function fixture() {
  return new PrivateDb({
    chatUsers: [
      { _id: "owner-user", ...scope, email: "alice@example.com" },
      {
        _id: "foreign-user",
        userId: "foreign",
        tenantId: "foreign-tenant",
        memorySpaceId: "foreign-space",
        email: "bob@example.com",
      },
    ],
    conversations: [
      {
        _id: "conversation",
        conversationId: "c",
        participants: { userId: "owner" },
        tenantId: "tenant",
        memorySpaceId: "owned",
        visibility: "private",
        createdAt: 1,
        metadata: { title: "Owned", secret: "hidden" },
      },
    ],
    artifacts: [{ _id: "artifact", artifactId: "doc", version: 3, ...scope }],
  });
}
test("registered users persist a hash; guest identities persist; duplicate user is refused", async () => {
  const db = new PrivateDb();
  const registration = {
    ...scope,
    email: "alice@example.com",
    passwordHash: "$2b$12$" + "x".repeat(53),
  };
  expect(await invoke(users.register, db, registration)).toEqual({
    id: "owner",
    email: "alice@example.com",
  });
  expect(
    await invoke(users.credentialByEmail, new PrivateDb(db.tables), {
      email: registration.email,
    }),
  ).toEqual({
    id: "owner",
    email: registration.email,
    password: registration.passwordHash,
  });
  expect(await invoke(users.register, db, registration)).toEqual({
    error: "USER_EXISTS",
  });
  const guest = {
    userId: "guest-id",
    tenantId: "tenant",
    memorySpaceId: "guest-space",
    email: "guest-id@example.com",
  };
  expect(await invoke(users.createGuest, db, guest)).toEqual({
    id: "guest-id",
    email: guest.email,
  });
  expect(
    await invoke(users.credentialByEmail, db, { email: "absent@example.com" }),
  ).toBeNull();
});
test("malformed credentials/duplicate guest have no extra writes", async () => {
  const db = fixture();
  const before = db.writes.length;
  await expect(
    invoke(users.register, db, {
      ...scope,
      email: "alice@example.com",
      passwordHash: "plaintext",
    }),
  ).rejects.toThrow("Invalid credentials");
  await expect(
    invoke(users.createGuest, db, { ...scope, email: "alice@example.com" }),
  ).rejects.toThrow("Guest unavailable");
  expect(db.writes).toHaveLength(before);
});
test("current view survives a new service instance and edit/resubmit retains SDK audit", async () => {
  const db = fixture();
  await invoke(data.saveMessages, db, {
    ...scope,
    messages: [
      message,
      {
        ...message,
        id: "a",
        role: "assistant",
        parts: [{ type: "text", text: "old answer" }],
        createdAt: 2,
      },
    ],
  });
  await invoke(data.vote, db, {
    ...scope,
    chatId: "c",
    messageId: "a",
    type: "up",
  });
  expect(await invoke(data.votes, db, { ...scope, chatId: "c" })).toEqual([
    { chatId: "c", messageId: "a", isUpvoted: true },
  ]);
  await invoke(data.truncate, db, { ...scope, chatId: "c", timestamp: 1 });
  const { _id: branchId, ...branch } = db.tables.chatBranches[0];
  expect(branchId).toEqual(expect.any(String));
  expect(branch).toEqual({ ...scope, chatId: "c", edited: true });
  expect(await invoke(data.branchEdited, db, { ...scope, chatId: "c" })).toBe(
    true,
  );
  expect(await invoke(data.votes, db, { ...scope, chatId: "c" })).toEqual([]);
  await invoke(data.saveMessages, db, {
    ...scope,
    messages: [
      {
        ...message,
        parts: [{ type: "text", text: "new branch" }],
        createdAt: 3,
      },
    ],
  });
  const reloaded = new PrivateDb(db.tables);
  expect(
    await invoke(data.messages, reloaded, { ...scope, chatId: "c" }),
  ).toEqual([
    { ...message, parts: [{ type: "text", text: "new branch" }], createdAt: 3 },
  ]);
  expect(reloaded.tables.conversations).toEqual(db.tables.conversations);
  expect(await invoke(data.recallBranches, reloaded, scope)).toEqual([
    { conversationId: "c", edited: true },
  ]);
});
test("whole batch ownership preflight refuses without partial active writes", async () => {
  const db = fixture();
  await expect(
    invoke(data.saveMessages, db, {
      ...scope,
      messages: [message, { ...message, id: "bad", chatId: "foreign" }],
    }),
  ).rejects.toThrow("Resource unavailable");
  expect(db.writes).toEqual([]);
  expect(db.tables.chatMessages).toBeUndefined();
});
test("message updates, metadata, votes, suggestions and stream tracking are durable", async () => {
  const db = fixture();
  await invoke(data.saveMessages, db, { ...scope, messages: [message] });
  await invoke(data.updateMessage, db, {
    ...scope,
    messageId: "m",
    parts: [{ type: "text", text: "updated" }],
  });
  expect(
    await invoke(data.message, db, { ...scope, messageId: "m" }),
  ).toMatchObject({ parts: [{ type: "text", text: "updated" }] });
  await invoke(data.setTitle, db, {
    ...scope,
    chatId: "c",
    title: "New title",
  });
  expect(db.tables.conversations[0].metadata).toEqual({
    title: "New title",
    secret: "hidden",
  });
  await invoke(data.setVisibility, db, {
    ...scope,
    chatId: "c",
    visibility: "public",
  });
  await invoke(data.saveSuggestions, db, {
    ...scope,
    suggestions: [suggestion],
  });
  expect(
    await invoke(data.suggestions, new PrivateDb(db.tables), {
      ...scope,
      documentId: "doc",
    }),
  ).toEqual([{ ...suggestion, description: null }]);
  await invoke(data.recordStream, db, {
    ...scope,
    chatId: "c",
    streamId: "stream",
  });
  expect(db.tables.chatStreams[0]).toMatchObject({
    streamId: "stream",
    chatId: "c",
    ...scope,
  });
});
test("public projection reads current text only, private switch closes public access", async () => {
  const db = fixture();
  await invoke(data.saveMessages, db, {
    ...scope,
    messages: [
      message,
      {
        ...message,
        id: "system",
        role: "system",
        parts: [{ type: "text", text: "secret-system" }],
      },
    ],
  });
  expect(await invoke(data.publicShare, db, { chatId: "c" })).toBeNull();
  await invoke(data.setVisibility, db, {
    ...scope,
    chatId: "c",
    visibility: "public",
  });
  const result = await invoke(data.publicShare, db, { chatId: "c" });
  expect(result).toEqual({
    title: "Owned",
    createdAt: 1,
    messages: [{ role: "user", text: "old" }],
  });
  expect(JSON.stringify(result)).not.toMatch(
    /tenant|owned|userId|secret|attachment|tool/,
  );
  await invoke(data.setVisibility, db, {
    ...scope,
    chatId: "c",
    visibility: "private",
  });
  expect(await invoke(data.publicShare, db, { chatId: "c" })).toBeNull();
});
for (const [name, operation] of Object.entries(data)) {
  test(`${name} uses genuine internal registration`, () =>
    expect((operation as any).isInternal).toBe(true));
  if (name === "publicShare") continue;
  test(`${name} denies unknown/foreign/forged scope before writes`, async () => {
    const db = fixture();
    await invoke(data.saveMessages, db, { ...scope, messages: [message] });
    await invoke(data.setDocumentVersions, db, {
      ...scope,
      documentId: "doc",
      versions: [1, 2, 3],
    });
    const before = db.writes.length;
    for (const forged of [
      { userId: "absent" },
      { tenantId: "forged" },
      { memorySpaceId: "forged" },
      {
        userId: "foreign",
        tenantId: "foreign-tenant",
        memorySpaceId: "foreign-space",
      },
    ]) {
      const args = {
        ...scope,
        ...forged,
        chatId: "c",
        messageId: "m",
        documentId: "doc",
        messages: [message],
        suggestions: [suggestion],
        parts: [],
        timestamp: 1,
        title: "x",
        visibility: "public",
        versions: [1],
        version: 1,
        type: "up",
        streamId: "s",
        limit: 10,
        since: 0,
        attachmentId: "a",
        url: "https://upload.example/a",
        files: [
          {
            url: "https://upload.example/a",
            name: "own.png",
            mediaType: "image/png",
          },
        ],
      };
      if (
        [
          "recallBranches",
          "clearAllChats",
          "listChats",
          "messageCount",
        ].includes(name) &&
        forged.userId === "foreign"
      )
        expect(await invoke(operation, db, args)).toEqual(
          ["recallBranches", "listChats"].includes(name)
            ? []
            : name === "messageCount"
              ? 0
              : null,
        );
      else
        await expect(invoke(operation, db, args)).rejects.toThrow(
          "Resource unavailable",
        );
    }
    expect(db.writes).toHaveLength(before);
  });
}

test("document active versions persist actual SDK numbers and deny duplicates/out of range", async () => {
  const db = fixture();
  expect(
    await invoke(data.documentVersions, db, { ...scope, documentId: "doc" }),
  ).toBeNull();
  await invoke(data.setDocumentVersions, db, {
    ...scope,
    documentId: "doc",
    versions: [1],
  });
  expect(
    await invoke(data.documentVersions, new PrivateDb(db.tables), {
      ...scope,
      documentId: "doc",
    }),
  ).toEqual([1]);
  await invoke(data.setDocumentVersions, db, {
    ...scope,
    documentId: "doc",
    versions: [1, 3],
  });
  expect(
    await invoke(data.documentVersions, db, { ...scope, documentId: "doc" }),
  ).toEqual([1, 3]);
  for (const versions of [[0], [4], [1, 1], []])
    await expect(
      invoke(data.setDocumentVersions, db, {
        ...scope,
        documentId: "doc",
        versions,
      }),
    ).rejects.toThrow("Invalid active versions");
});
test("deleted SDK parent cannot resurrect active messages or votes; foreign clear refuses", async () => {
  const db = fixture();
  await invoke(data.saveMessages, db, { ...scope, messages: [message] });
  db.tables.conversations = [];
  await invoke(data.clearChat, db, { ...scope, chatId: "c" });
  expect(db.tables.chatMessages).toEqual([]);
});

test("logical version selection supports undo/redo while audit versions are retained", async () => {
  const db = fixture();
  await invoke(data.setDocumentVersions, db, {
    ...scope,
    documentId: "doc",
    versions: [1, 3],
  });
  await invoke(data.selectDocumentVersion, db, {
    ...scope,
    documentId: "doc",
    version: 1,
  });
  expect(
    await invoke(data.documentSelection, new PrivateDb(db.tables), {
      ...scope,
      documentId: "doc",
    }),
  ).toBe(1);
  await expect(
    invoke(data.selectDocumentVersion, db, {
      ...scope,
      documentId: "doc",
      version: 2,
    }),
  ).rejects.toThrow("Resource unavailable");
  expect(db.tables.artifacts[0].version).toBe(3);
});

test("model file input requires a durable owned uploaded attachment, including after reload", async () => {
  const db = fixture();
  db.tables.attachments = [
    {
      _id: "attachment",
      ...scope,
      attachmentId: "a",
      filename: "own.png",
      mimeType: "image/png",
    },
  ];
  await invoke(data.registerUpload, db, {
    ...scope,
    attachmentId: "a",
    url: "https://upload.example/a",
  });
  const args = {
    ...scope,
    files: [
      {
        url: "https://upload.example/a",
        name: "own.png",
        mediaType: "image/png",
      },
    ],
  };
  expect(await invoke(data.verifyUploads, new PrivateDb(db.tables), args)).toBe(
    true,
  );
  for (const files of [
    [{ ...args.files[0], url: "https://external.invalid/probe" }],
    [{ ...args.files[0], name: "forged" }],
    [{ ...args.files[0], mediaType: "image/jpeg" }],
  ])
    await expect(
      invoke(data.verifyUploads, db, { ...scope, files }),
    ).rejects.toThrow("Resource unavailable");
  db.tables.attachments[0].userId = "foreign";
  await expect(invoke(data.verifyUploads, db, args)).rejects.toThrow(
    "Resource unavailable",
  );
});

test("history cursor includes older pages and timestamp ties; count spans all current owned messages", async () => {
  const db = fixture();
  db.tables.conversations = ["d", "c", "b", "a"].map((conversationId) => ({
    ...db.tables.conversations[0],
    _id: conversationId,
    conversationId,
    createdAt: 1,
    updatedAt: 2,
  }));
  expect(
    (await invoke(data.listChats, db, { ...scope, limit: 2 })).map(
      (row: any) => row.id,
    ),
  ).toEqual(["d", "c"]);
  expect(
    (
      await invoke(data.listChats, db, {
        ...scope,
        limit: 2,
        endingBefore: "c",
      })
    ).map((row: any) => row.id),
  ).toEqual(["b", "a"]);
  expect(
    (
      await invoke(data.listChats, db, {
        ...scope,
        limit: 2,
        startingAfter: "b",
      })
    ).map((row: any) => row.id),
  ).toEqual(["d", "c"]);
  await expect(
    invoke(data.listChats, db, { ...scope, limit: 2, endingBefore: "foreign" }),
  ).rejects.toThrow("Resource unavailable");
  db.tables.chatMessages = [1, 2, 3].map((createdAt) => ({
    ...scope,
    createdAt,
  }));
  expect(await invoke(data.messageCount, db, { ...scope, since: 2 })).toBe(2);
});
