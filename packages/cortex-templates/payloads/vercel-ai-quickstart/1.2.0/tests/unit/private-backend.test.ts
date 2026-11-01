import * as accounts from "../../convex/app/accounts";
import * as sessions from "../../convex/app/sessions";
import * as state from "../../convex/app/authState";
import * as memories from "../../convex/app/memories";
import * as facts from "../../convex/app/facts";
import * as conversations from "../../convex/app/conversations";
import * as users from "../../convex/app/users";
import { PrivateDb, invoke } from "../helpers/private-db";
const accountId = "11111111-1111-4111-8111-111111111111";
const scope = {
  userId: accountId,
  tenantId: "tenant",
  memorySpaceId: `space-${accountId}`,
};
const credentials = {
  accountId,
  username: "alice",
  passwordHash:
    "AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
};
test("setup is atomic-once; subsequent users have fixed role and singleton tenant", async () => {
  const db = new PrivateDb();
  expect(await invoke(state.status, db, {})).toEqual({ isSetup: false });
  expect(
    await invoke(accounts.setup, db, { ...credentials, tenantId: "tenant" }),
  ).toEqual({ accountId });
  expect(await invoke(state.status, db, {})).toEqual({ isSetup: true });
  expect(
    await invoke(accounts.setup, db, { ...credentials, tenantId: "evil" }),
  ).toEqual({ error: "SETUP_COMPLETE" });
  const second = {
    ...credentials,
    accountId: "22222222-2222-4222-8222-222222222222",
    username: "bob",
  };
  await invoke(accounts.register, db, second);
  expect(db.tables.appAccounts[1]).toMatchObject({
    role: "user",
    tenantId: "tenant",
    allowedMemorySpaceIds: [`space-${second.accountId}`],
  });
  expect(await invoke(accounts.register, db, second)).toEqual({
    error: "USERNAME_TAKEN",
  });
  expect(
    await invoke(accounts.identityById, db, { accountId }),
  ).not.toHaveProperty("passwordHash");
  expect(
    await invoke(accounts.credentialByUsername, db, { username: "alice" }),
  ).toMatchObject({ passwordHash: credentials.passwordHash });
});
test("missing bootstrap, malformed hash and unknown identity refuse", async () => {
  const db = new PrivateDb();
  expect(await invoke(accounts.register, db, credentials)).toEqual({
    error: "SETUP_REQUIRED",
  });
  await expect(
    invoke(accounts.setup, db, {
      ...credentials,
      passwordHash: "plaintext",
      tenantId: "t",
    }),
  ).rejects.toThrow("Invalid");
  expect(db.writes).toEqual([]);
  expect(await invoke(accounts.identityById, db, { accountId })).toBeNull();
  expect(
    await invoke(accounts.credentialByUsername, db, { username: "missing" }),
  ).toBeNull();
});
test("session expiry, duplicate digest, revoke and disabled account", async () => {
  const db = new PrivateDb();
  await invoke(accounts.setup, db, { ...credentials, tenantId: "tenant" });
  const digest = "a".repeat(64);
  await invoke(sessions.create, db, { sessionDigest: digest, accountId });
  expect(
    await invoke(sessions.create, db, { sessionDigest: digest, accountId }),
  ).toEqual({ error: "SESSION_EXISTS" });
  expect(
    await invoke(sessions.resolve, db, { sessionDigest: digest }),
  ).toMatchObject({ accountId });
  db.tables.appSessions[0].expiresAt = Date.now() - 1;
  expect(
    await invoke(sessions.resolve, db, { sessionDigest: digest }),
  ).toBeNull();
  db.tables.appSessions[0].expiresAt = Date.now() + 60000;
  await invoke(sessions.revoke, db, { sessionDigest: digest });
  expect(
    await invoke(sessions.resolve, db, { sessionDigest: digest }),
  ).toBeNull();
  db.tables.appAccounts[0].disabled = true;
  expect(
    await invoke(sessions.create, db, {
      sessionDigest: "b".repeat(64),
      accountId,
    }),
  ).toEqual({ error: "ACCOUNT_UNAVAILABLE" });
});
for (const [module, exports] of Object.entries({
  memories,
  facts,
  conversations,
  users,
})) {
  for (const [name, operation] of Object.entries(exports)) {
    test(`${module}:${name} is internal and denies foreign account/space/tenant before writes`, async () => {
      expect((operation as any).isInternal).toBe(true);
      const db = new PrivateDb();
      await invoke(accounts.setup, db, { ...credentials, tenantId: "tenant" });
      const before = db.writes.length;
      for (const forged of [
        { userId: "foreign" },
        { tenantId: "foreign" },
        { memorySpaceId: "foreign" },
      ])
        await expect(
          invoke(operation, db, {
            ...scope,
            conversationId: "c",
            query: "x",
            factType: "preference",
            ...forged,
          }),
        ).rejects.toThrow("Resource unavailable");
      expect(db.writes).toHaveLength(before);
    });
  }
}
test("data queries select every exact owner dimension and return empty safely", async () => {
  const db = new PrivateDb();
  await invoke(accounts.setup, db, { ...credentials, tenantId: "tenant" });
  db.tables.memories = [
    { _id: "own", ...scope, content: "owned" },
    { _id: "foreign", ...scope, userId: "foreign", content: "secret" },
  ];
  expect(await invoke(memories.getRecent, db, scope)).toEqual([
    expect.objectContaining({ content: "owned" }),
  ]);
  expect(await invoke(memories.count, db, scope)).toBe(1);
  expect(await invoke(facts.getRecent, db, scope)).toEqual([]);
  expect(
    await invoke(conversations.get, db, {
      ...scope,
      conversationId: "missing",
    }),
  ).toBeNull();
});

test("display name survives account and session reload while role and scope remain server-owned", async () => {
  const db = new PrivateDb();
  const record = {
    accountId: "11111111-1111-1111-1111-111111111111",
    username: "alice",
    displayName: "Alice Example",
    passwordHash:
      "AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    tenantId: "tenant",
  };
  await invoke(accounts.setup, db, record);
  expect(
    await invoke(accounts.identityById, new PrivateDb(db.tables), {
      accountId: record.accountId,
    }),
  ).toMatchObject({
    displayName: "Alice Example",
    role: "admin",
    tenantId: "tenant",
  });
  await invoke(sessions.create, db, {
    accountId: record.accountId,
    sessionDigest: "a".repeat(64),
  });
  expect(
    await invoke(sessions.resolve, new PrivateDb(db.tables), {
      sessionDigest: "a".repeat(64),
    }),
  ).toMatchObject({ displayName: "Alice Example" });
});
