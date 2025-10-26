/**
 * Interactive Test Runner
 *
 * Menu-driven test execution for debugging individual API operations
 */

// Load environment variables
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local first (if exists), then .env.test as fallback
dotenv.config({ path: join(__dirname, "..", ".env.local") });
dotenv.config({ path: join(__dirname, "..", ".env.test") });

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { TestCleanup, StorageInspector } from "./helpers";
import * as readline from "readline";

// Test data
const TEST_USER_ID = "user-test-interactive";
const TEST_AGENT_ID = "agent-test-interactive";
let currentConversationId: string | null = null;
let currentImmutableType: string | null = null;
let currentImmutableId: string | null = null;

// Clients
let cortex: Cortex;
let client: ConvexClient;
let cleanup: TestCleanup;
let inspector: StorageInspector;

// Initialize
async function initialize() {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("\n❌ CONVEX_URL not set in environment");
    console.error("\n💡 Make sure you have either:");
    console.error("   - .env.local with CONVEX_URL=http://127.0.0.1:3210");
    console.error("   - .env.test with CONVEX_URL=http://127.0.0.1:3210");
    console.error("\n💡 Also make sure Convex is running: npm run dev\n");
    throw new Error("CONVEX_URL not set in environment");
  }

  cortex = new Cortex({ convexUrl });
  client = new ConvexClient(convexUrl);
  cleanup = new TestCleanup(client);
  inspector = new StorageInspector(client);

  console.log("✅ SDK and helpers initialized");
  console.log(`📡 Connected to: ${convexUrl}\n`);
}

// Menu options
const MENU_OPTIONS = {
  // ═══════════════════════════════════════════════════════════════════════
  // Utility
  // ═══════════════════════════════════════════════════════════════════════
  "1": { label: "🧹 Purge All Databases", action: purgeAllDatabases },
  "2": { label: "📊 Inspect Database State", action: inspectDatabase },

  // ═══════════════════════════════════════════════════════════════════════
  // Layer 1a: Conversations API
  // ═══════════════════════════════════════════════════════════════════════
  "10": {
    label: "💬 Conversations API ─────────────",
    action: showConversationsMenu,
  },
  "11": { label: "  ➕ create (user-agent)", action: testCreateUserAgent },
  "12": { label: "  ➕ create (agent-agent)", action: testCreateAgentAgent },
  "13": { label: "  📖 get", action: testGet },
  "14": { label: "  💬 addMessage", action: testAddMessage },
  "15": { label: "  📋 list (by user)", action: testListByUser },
  "16": { label: "  📋 list (by agent)", action: testListByAgent },
  "17": { label: "  🔢 count", action: testCount },
  "18": { label: "  📜 getHistory", action: testGetHistory },
  "19": { label: "  🔍 search", action: testSearch },
  "20": { label: "  💾 export (JSON)", action: testExportJSON },
  "21": { label: "  📊 export (CSV)", action: testExportCSV },
  "22": { label: "  🗑️  delete", action: testDelete },
  "23": {
    label: "  🔄 Propagation: Add 5 msgs & verify",
    action: testConvPropagation,
  },
  "24": { label: "  🏋️  Edge: 100+ messages", action: testConvManyMessages },
  "25": {
    label: "  🔗 Integration: Full workflow",
    action: testConvIntegration,
  },
  "26": { label: "  🗑️  deleteMany", action: testConvDeleteMany },
  "27": { label: "  📧 getMessage", action: testConvGetMessage },
  "28": { label: "  📧 getMessagesByIds", action: testConvGetMessagesByIds },
  "29": { label: "  🔎 findConversation", action: testConvFindConversation },
  "30": { label: "  🔄 getOrCreate", action: testConvGetOrCreate },
  "39": {
    label: "  🎯 Run All Conversations Tests",
    action: runConversationsTests,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Layer 1b: Immutable Store API
  // ═══════════════════════════════════════════════════════════════════════
  "40": {
    label: "💾 Immutable Store API ───────────",
    action: showImmutableMenu,
  },
  "41": { label: "  💾 store (create/update)", action: testImmutableStore },
  "42": { label: "  📖 get", action: testImmutableGet },
  "43": { label: "  🔢 getVersion", action: testImmutableGetVersion },
  "44": { label: "  📜 getHistory", action: testImmutableGetHistory },
  "45": { label: "  📋 list", action: testImmutableList },
  "46": { label: "  🔍 search", action: testImmutableSearch },
  "47": { label: "  🔢 count", action: testImmutableCount },
  "48": { label: "  🗑️  purge", action: testImmutablePurge },
  "50": {
    label: "  🔄 Propagation: Update & verify",
    action: testImmPropagation,
  },
  "51": { label: "  🏋️  Edge: 25 versions", action: testImmManyVersions },
  "52": {
    label: "  🔗 Integration: Full workflow",
    action: testImmIntegration,
  },
  "53": { label: "  ⏰ getAtTimestamp", action: testImmGetAtTimestamp },
  "54": { label: "  🗑️  purgeMany", action: testImmPurgeMany },
  "55": { label: "  🧹 purgeVersions", action: testImmPurgeVersions },
  "59": { label: "  🎯 Run All Immutable Tests", action: runImmutableTests },

  // ═══════════════════════════════════════════════════════════════════════
  // Layer 1c: Mutable Store API
  // ═══════════════════════════════════════════════════════════════════════
  "60": {
    label: "🔄 Mutable Store API ─────────────",
    action: showMutableMenu,
  },
  "61": { label: "  💾 set", action: testMutableSet },
  "62": { label: "  📖 get", action: testMutableGet },
  "63": { label: "  🔄 update", action: testMutableUpdate },
  "64": { label: "  ➕ increment", action: testMutableIncrement },
  "65": { label: "  ➖ decrement", action: testMutableDecrement },
  "66": { label: "  📋 list", action: testMutableList },
  "67": { label: "  🔢 count", action: testMutableCount },
  "68": { label: "  ❓ exists", action: testMutableExists },
  "69": { label: "  🗑️  delete", action: testMutableDelete },
  "70": { label: "  🧹 purgeNamespace", action: testMutablePurgeNamespace },
  "71": { label: "  🗑️  purgeMany", action: testMutablePurgeMany },
  "79": { label: "  🎯 Run All Mutable Tests", action: runMutableTests },

  // ═══════════════════════════════════════════════════════════════════════
  // Run All
  // ═══════════════════════════════════════════════════════════════════════
  "99": { label: "🎯 Run All Tests (All 3 Layers)", action: runAllTests },
  "0": { label: "❌ Exit", action: exit },
};

// Category placeholders (just show a message)
async function showConversationsMenu() {
  console.log("\n💬 Conversations API");
  console.log("Core: 11-22 | Advanced: 23-30 | Run All: 39\n");
}

async function showImmutableMenu() {
  console.log("\n💾 Immutable Store API");
  console.log("Core: 41-48 | Advanced: 50-55 | Run All: 59\n");
}

async function showMutableMenu() {
  console.log("\n🔄 Mutable Store API");
  console.log("Core: 61-71 | Run All: 79\n");
}

// Test implementations
async function purgeAllDatabases() {
  console.log("\n🧹 Purging all databases...");

  // Purge conversations
  console.log("  Purging conversations...");
  const convDeleted = await cleanup.purgeConversations();
  await cleanup.verifyConversationsEmpty();
  currentConversationId = null;
  console.log(`  ✅ Purged ${convDeleted.deleted} conversation(s)`);

  // Purge immutable
  console.log("  Purging immutable store...");
  const entries = await client.query(api.immutable.list, {});
  let immutableDeleted = 0;
  for (const entry of entries) {
    try {
      await client.mutation(api.immutable.purge, {
        type: entry.type,
        id: entry.id,
      });
      immutableDeleted++;
    } catch (error: any) {
      if (error.message?.includes("IMMUTABLE_ENTRY_NOT_FOUND")) {
        continue;
      }
    }
  }
  currentImmutableType = null;
  currentImmutableId = null;
  console.log(`  ✅ Purged ${immutableDeleted} immutable entry/entries`);

  // Purge mutable
  console.log("  Purging mutable store...");
  const namespaces = [
    "test",
    "inventory",
    "config",
    "counters",
    "sessions",
    "temp",
    "purge-test",
    "count-test",
    "prefix-test",
    "user-data",
    "propagation-test",
    "sync-test",
    "sync-test-unique",
    "rapid-test",
    "large-test",
    "test-namespace_with.chars",
    "empty-test",
    "concurrent",
    "integration-test",
    "acid-test",
    "overwrite-test",
    "ns-a",
    "ns-b",
    "bulk-delete",
    "purge-ns-test",
    "bulk-mut-del",
  ];

  let mutableDeleted = 0;
  for (const ns of namespaces) {
    try {
      const result = await client.mutation(api.mutable.purgeNamespace, {
        namespace: ns,
      });
      mutableDeleted += result.deleted;
    } catch (error: any) {
      // Namespace might not exist - that's fine
    }
  }
  console.log(`  ✅ Purged ${mutableDeleted} mutable entry/entries`);

  console.log("\n✅ All databases clean\n");
}

async function inspectDatabase() {
  console.log("\n📊 Inspecting database state...\n");
  await inspector.inspectAllConversations();
  await inspector.printStats();

  if (currentConversationId) {
    console.log(`\n🎯 Current conversation ID: ${currentConversationId}`);
    await inspector.inspectConversation(currentConversationId);
  } else {
    console.log("\n⚠️  No current conversation ID set");
  }
  console.log();
}

async function testCreateUserAgent() {
  console.log("\n➕ Testing: conversations.create (user-agent)...");

  const input = {
    type: "user-agent" as const,
    participants: {
      userId: TEST_USER_ID,
      agentId: TEST_AGENT_ID,
    },
    metadata: {
      source: "interactive-runner",
    },
  };

  console.log("📤 Input:", JSON.stringify(input, null, 2));

  const result = await cortex.conversations.create(input);
  currentConversationId = result.conversationId;

  console.log("\n📥 Result:", JSON.stringify(result, null, 2));
  console.log(`\n🎯 Current conversation ID set to: ${currentConversationId}`);

  // Inspect storage
  console.log("\n📊 Storage validation:");
  await inspector.inspectConversation(currentConversationId);
  console.log();
}

async function testCreateAgentAgent() {
  console.log("\n➕ Testing: conversations.create (agent-agent)...");

  const input = {
    type: "agent-agent" as const,
    participants: {
      agentIds: [
        TEST_AGENT_ID,
        "agent-target-interactive",
        "agent-observer-interactive",
      ],
    },
  };

  console.log("📤 Input:", JSON.stringify(input, null, 2));

  const result = await cortex.conversations.create(input);
  currentConversationId = result.conversationId;

  console.log("\n📥 Result:", JSON.stringify(result, null, 2));
  console.log(`\n🎯 Current conversation ID set to: ${currentConversationId}`);

  // Inspect storage
  console.log("\n📊 Storage validation:");
  await inspector.inspectConversation(currentConversationId);
  console.log();
}

async function testGet() {
  if (!currentConversationId) {
    console.log(
      "\n⚠️  No current conversation ID. Create a conversation first (option 3 or 4).\n",
    );
    return;
  }

  console.log(`\n📖 Testing: conversations.get("${currentConversationId}")...`);

  const result = await cortex.conversations.get(currentConversationId);

  console.log("\n📥 Result:", JSON.stringify(result, null, 2));
  console.log();
}

async function testAddMessage() {
  if (!currentConversationId) {
    console.log(
      "\n⚠️  No current conversation ID. Create a conversation first (option 3 or 4).\n",
    );
    return;
  }

  console.log(
    `\n💬 Testing: conversations.addMessage("${currentConversationId}")...`,
  );

  const input = {
    conversationId: currentConversationId,
    message: {
      role: "user" as const,
      content: "Hello, agent! This is a test message added interactively.",
      metadata: {
        source: "interactive-runner",
      },
    },
  };

  console.log("📤 Input:", JSON.stringify(input, null, 2));

  const result = await cortex.conversations.addMessage(input);

  console.log("\n📥 Result:", JSON.stringify(result, null, 2));
  console.log(`✅ Message count: ${result.messageCount}`);

  // Inspect storage
  console.log("\n📊 Storage validation:");
  await inspector.inspectConversation(currentConversationId);
  console.log();
}

async function testListByUser() {
  console.log(
    `\n📋 Testing: conversations.list({ userId: "${TEST_USER_ID}" })...`,
  );

  const conversations = await cortex.conversations.list({
    userId: TEST_USER_ID,
  });

  console.log(`\n📥 Found ${conversations.length} conversation(s)`);
  console.log("Result:", JSON.stringify(conversations, null, 2));

  // Validate: all conversations should include this userId
  console.log("\n🔍 Validation:");
  let allValid = true;
  conversations.forEach((conv, i) => {
    const hasUser = conv.participants.userId === TEST_USER_ID;

    if (hasUser) {
      console.log(`  ✅ Conversation ${i + 1}: Contains ${TEST_USER_ID}`);
    } else {
      console.log(`  ❌ Conversation ${i + 1}: Missing ${TEST_USER_ID}`);
      allValid = false;
    }
  });

  if (allValid) {
    console.log("✅ All conversations contain the user");
  } else {
    console.log("❌ Some conversations don't contain the user");
  }
  console.log();
}

async function testListByAgent() {
  console.log(
    `\n📋 Testing: conversations.list({ agentId: "${TEST_AGENT_ID}" })...`,
  );

  const conversations = await cortex.conversations.list({
    agentId: TEST_AGENT_ID,
  });

  console.log(`\n📥 Found ${conversations.length} conversation(s)`);
  console.log("Result:", JSON.stringify(conversations, null, 2));

  // Validate: all conversations should include this agentId
  console.log("\n🔍 Validation:");
  let allValid = true;
  conversations.forEach((conv, i) => {
    const hasAgent =
      conv.participants.agentId === TEST_AGENT_ID ||
      conv.participants.agentIds?.includes(TEST_AGENT_ID);

    if (hasAgent) {
      console.log(`  ✅ Conversation ${i + 1}: Contains ${TEST_AGENT_ID}`);
    } else {
      console.log(`  ❌ Conversation ${i + 1}: Missing ${TEST_AGENT_ID}`);
      allValid = false;
    }
  });

  if (allValid) {
    console.log("✅ All conversations contain the agent");
  } else {
    console.log("❌ Some conversations don't contain the agent");
  }
  console.log();
}

async function testCount() {
  console.log(
    `\n🔢 Testing: conversations.count({ userId: "${TEST_USER_ID}" })...`,
  );

  const count = await cortex.conversations.count({
    userId: TEST_USER_ID,
  });

  console.log(`\n📥 Count: ${count}`);
  console.log();
}

async function testGetHistory() {
  if (!currentConversationId) {
    console.log(
      "\n⚠️  No current conversation ID. Create a conversation first (option 3 or 4).\n",
    );
    return;
  }

  console.log(
    `\n📜 Testing: conversations.getHistory("${currentConversationId}")...`,
  );

  // Get first page
  const page1 = await cortex.conversations.getHistory(currentConversationId, {
    limit: 5,
    offset: 0,
    sortOrder: "asc",
  });

  console.log("\n📥 Page 1 (limit: 5, offset: 0, sortOrder: asc):");
  console.log(`  Total messages: ${page1.total}`);
  console.log(`  Returned: ${page1.messages.length}`);
  console.log(`  Has more: ${page1.hasMore}`);

  console.log("\n  Messages:");
  page1.messages.forEach((msg, i) => {
    console.log(
      `    [${i + 1}] ${msg.role}: ${msg.content.substring(0, 50)}...`,
    );
  });

  // Try descending order
  const page2 = await cortex.conversations.getHistory(currentConversationId, {
    limit: 3,
    sortOrder: "desc",
  });

  console.log("\n📥 Page 2 (limit: 3, sortOrder: desc - newest first):");
  page2.messages.forEach((msg, i) => {
    console.log(
      `    [${i + 1}] ${msg.role}: ${msg.content.substring(0, 50)}...`,
    );
  });

  console.log("\n✅ getHistory working correctly");
  console.log();
}

async function testSearch() {
  console.log("\n🔍 Testing: conversations.search({ query: 'test' })...");

  const results = await cortex.conversations.search({
    query: "test",
    filters: {
      limit: 5,
    },
  });

  console.log(`\n📥 Found ${results.length} conversation(s) matching "test"`);

  if (results.length > 0) {
    console.log("\nResults:");
    results.forEach((result, i) => {
      console.log(
        `\n  [${i + 1}] Conversation: ${result.conversation.conversationId}`,
      );
      console.log(`      Score: ${result.score.toFixed(3)}`);
      console.log(`      Matched messages: ${result.matchedMessages.length}`);
      console.log(`      Highlights:`);
      result.highlights.forEach((hl, j) => {
        console.log(`        ${j + 1}. "${hl}"`);
      });
    });
  } else {
    console.log("  No matches found.");
  }

  console.log("\n✅ search working correctly");
  console.log();
}

async function testExportJSON() {
  console.log("\n💾 Testing: conversations.export({ format: 'json' })...");

  const exported = await cortex.conversations.export({
    filters: {
      userId: TEST_USER_ID,
    },
    format: "json",
    includeMetadata: true,
  });

  console.log(`\n📥 Export Result:`);
  console.log(`  Format: ${exported.format}`);
  console.log(`  Count: ${exported.count}`);
  console.log(`  Exported at: ${new Date(exported.exportedAt).toISOString()}`);
  console.log(`  Data size: ${exported.data.length} characters`);

  // Parse and show sample
  const parsed = JSON.parse(exported.data);
  if (parsed.length > 0) {
    console.log(`\n  Sample (first conversation):`);
    console.log(
      JSON.stringify(parsed[0], null, 2).split("\n").slice(0, 15).join("\n"),
    );
    if (JSON.stringify(parsed[0], null, 2).split("\n").length > 15) {
      console.log("    ...");
    }
  }

  console.log("\n✅ JSON export working correctly");
  console.log();
}

async function testExportCSV() {
  console.log("\n📊 Testing: conversations.export({ format: 'csv' })...");

  const exported = await cortex.conversations.export({
    filters: {
      agentId: TEST_AGENT_ID,
    },
    format: "csv",
    includeMetadata: false,
  });

  console.log(`\n📥 Export Result:`);
  console.log(`  Format: ${exported.format}`);
  console.log(`  Count: ${exported.count}`);
  console.log(`  Exported at: ${new Date(exported.exportedAt).toISOString()}`);
  console.log(`  Data size: ${exported.data.length} characters`);

  // Show CSV preview
  const lines = exported.data.split("\n");
  console.log(`\n  CSV Preview (first 5 lines):`);
  lines.slice(0, 5).forEach((line, i) => {
    console.log(
      `    ${i === 0 ? "Header" : `Row ${i}`}: ${line.substring(0, 80)}...`,
    );
  });

  console.log("\n✅ CSV export working correctly");
  console.log();
}

async function testDelete() {
  if (!currentConversationId) {
    console.log(
      "\n⚠️  No current conversation ID. Create a conversation first (option 3 or 4).\n",
    );
    return;
  }

  console.log(
    `\n🗑️  Testing: conversations.delete("${currentConversationId}")...`,
  );

  await cortex.conversations.delete(currentConversationId);

  console.log("✅ Conversation deleted");

  // Verify deletion
  console.log("\n📊 Verifying deletion...");
  try {
    await cortex.conversations.get(currentConversationId);
    console.log("❌ ERROR: Conversation still exists!");
  } catch (error: any) {
    if (error.message?.includes("CONVERSATION_NOT_FOUND")) {
      console.log("✅ Verified: Conversation no longer exists");
    } else {
      console.log("⚠️  Unexpected error:", error.message);
    }
  }

  currentConversationId = null;
  console.log();
}

async function runConversationsTests() {
  console.log("\n💬 Running all Conversations API tests...\n");
  console.log("═".repeat(80));

  await purgeAllDatabases();
  console.log("═".repeat(80));

  console.log("\n  CORE OPERATIONS\n");
  console.log("═".repeat(80));

  await testCreateUserAgent();
  console.log("═".repeat(80));

  await testGet();
  console.log("═".repeat(80));

  await testAddMessage();
  console.log("═".repeat(80));

  await testGetHistory();
  console.log("═".repeat(80));

  await testListByUser();
  console.log("═".repeat(80));

  await testCount();
  console.log("═".repeat(80));

  await testCreateAgentAgent();
  console.log("═".repeat(80));

  await testListByAgent();
  console.log("═".repeat(80));

  await testSearch();
  console.log("═".repeat(80));

  await testExportJSON();
  console.log("═".repeat(80));

  await testExportCSV();
  console.log("═".repeat(80));

  console.log("\n  ADVANCED TESTS\n");
  console.log("═".repeat(80));

  await testConvPropagation();
  console.log("═".repeat(80));

  await testConvManyMessages();
  console.log("═".repeat(80));

  await testConvIntegration();
  console.log("═".repeat(80));

  // Final validation for conversations
  console.log("\n🔍 CONVERSATIONS VALIDATION\n");
  console.log("═".repeat(80));

  const totalCount = await cortex.conversations.count();
  const userConvs = await cortex.conversations.list({ userId: TEST_USER_ID });
  const agentConvs = await cortex.conversations.list({
    agentId: TEST_AGENT_ID,
  });

  console.log("📊 Results:");
  console.log(`  Total: ${totalCount}`);
  console.log(`  By user: ${userConvs.length}`);
  console.log(`  By agent: ${agentConvs.length}`);

  console.log("\n✅ Expected: Total=2, By user=1, By agent=2");
  console.log(
    `📊 Actual: ${totalCount === 2 && userConvs.length === 1 && agentConvs.length === 2 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log("═".repeat(80));
  console.log("\n✅ Conversations tests complete!\n");
}

async function runImmutableTests() {
  console.log("\n💾 Running all Immutable Store API tests...\n");
  console.log("═".repeat(80));

  await purgeAllDatabases();
  console.log("═".repeat(80));

  console.log("\n  CORE OPERATIONS\n");
  console.log("═".repeat(80));

  await testImmutableStore();
  console.log("═".repeat(80));

  await testImmutableGet();
  console.log("═".repeat(80));

  await testImmutableGetVersion();
  console.log("═".repeat(80));

  await testImmutableGetHistory();
  console.log("═".repeat(80));

  await testImmutableList();
  console.log("═".repeat(80));

  await testImmutableSearch();
  console.log("═".repeat(80));

  await testImmutableCount();
  console.log("═".repeat(80));

  console.log("\n  ADVANCED TESTS\n");
  console.log("═".repeat(80));

  await testImmPropagation();
  console.log("═".repeat(80));

  await testImmManyVersions();
  console.log("═".repeat(80));

  await testImmIntegration();
  console.log("═".repeat(80));

  // Final validation for immutable
  console.log("\n🔍 IMMUTABLE STORE VALIDATION\n");
  console.log("═".repeat(80));

  const totalCount = await cortex.immutable.count();
  const kbArticles = await cortex.immutable.list({ type: "kb-article" });

  console.log("📊 Results:");
  console.log(`  Total entries: ${totalCount}`);
  console.log(`  KB articles: ${kbArticles.length}`);

  console.log("\n✅ Expected: Total=1, KB articles=1");
  console.log(
    `📊 Actual: ${totalCount === 1 && kbArticles.length === 1 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log("═".repeat(80));
  console.log("\n✅ Immutable Store tests complete!\n");
}

async function runAllTests() {
  console.log("\n🎯 Running ALL tests for ALL 3 LAYERS...\n");
  console.log("═".repeat(80));

  await purgeAllDatabases();
  console.log("═".repeat(80));

  await testCreateUserAgent();
  console.log("═".repeat(80));

  await testGet();
  console.log("═".repeat(80));

  await testAddMessage();
  console.log("═".repeat(80));

  await testGetHistory();
  console.log("═".repeat(80));

  await testListByUser();
  console.log("═".repeat(80));

  await testCount();
  console.log("═".repeat(80));

  await testCreateAgentAgent();
  console.log("═".repeat(80));

  await testListByAgent();
  console.log("═".repeat(80));

  await testSearch();
  console.log("═".repeat(80));

  await testExportJSON();
  console.log("═".repeat(80));

  await testExportCSV();
  console.log("═".repeat(80));

  await inspectDatabase();
  console.log("═".repeat(80));

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1b: Immutable Store Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log("\n" + "═".repeat(80));
  console.log("  LAYER 1B: IMMUTABLE STORE TESTS");
  console.log("═".repeat(80) + "\n");

  await testImmutableStore();
  console.log("═".repeat(80));

  await testImmutableGet();
  console.log("═".repeat(80));

  await testImmutableGetVersion();
  console.log("═".repeat(80));

  await testImmutableGetHistory();
  console.log("═".repeat(80));

  await testImmutableList();
  console.log("═".repeat(80));

  await testImmutableSearch();
  console.log("═".repeat(80));

  await testImmutableCount();
  console.log("═".repeat(80));

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1c: Mutable Store Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log("\n" + "═".repeat(80));
  console.log("  LAYER 1C: MUTABLE STORE TESTS");
  console.log("═".repeat(80) + "\n");

  await testMutableSet();
  console.log("═".repeat(80));

  await testMutableGet();
  console.log("═".repeat(80));

  await testMutableIncrement();
  console.log("═".repeat(80));

  await testMutableList();
  console.log("═".repeat(80));

  await testMutableCount();
  console.log("═".repeat(80));

  // Final validation
  console.log("\n🔍 FINAL VALIDATION (ALL 3 LAYERS)\n");
  console.log("═".repeat(80));

  // Layer 1a: Conversations
  const totalConvCount = await cortex.conversations.count();
  const userConvs = await cortex.conversations.list({ userId: TEST_USER_ID });
  const agentConvs = await cortex.conversations.list({
    agentId: TEST_AGENT_ID,
  });

  console.log("📊 Layer 1a (Conversations):");
  console.log(`  Total: ${totalConvCount}`);
  console.log(`  By user: ${userConvs.length}`);
  console.log(`  By agent: ${agentConvs.length}`);

  // Layer 1b: Immutable
  const totalImmCount = await cortex.immutable.count();
  const kbArticles = await cortex.immutable.list({ type: "kb-article" });

  console.log("\n📊 Layer 1b (Immutable Store):");
  console.log(`  Total entries: ${totalImmCount}`);
  console.log(`  KB articles: ${kbArticles.length}`);

  // Layer 1c: Mutable
  const inventoryCount = await cortex.mutable.count({ namespace: "inventory" });
  const counterCount = await cortex.mutable.count({ namespace: "counters" });

  console.log("\n📊 Layer 1c (Mutable Store):");
  console.log(`  Inventory items: ${inventoryCount}`);
  console.log(`  Counters: ${counterCount}`);

  console.log("\n✅ Expected:");
  console.log("  Conversations: Total=2, By user=1, By agent=2");
  console.log("  Immutable: Total=1, KB articles=1");
  console.log("  Mutable: Inventory & counters created");

  console.log("\n📊 Actual:");
  console.log(
    `  Conversations: ${totalConvCount === 2 && userConvs.length === 1 && agentConvs.length === 2 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `  Immutable: ${totalImmCount === 1 && kbArticles.length === 1 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `  Mutable: ${inventoryCount > 0 && counterCount > 0 ? "✅ PASS" : "❌ FAIL"}`,
  );

  const allValid =
    totalConvCount === 2 &&
    userConvs.length === 1 &&
    agentConvs.length === 2 &&
    totalImmCount === 1 &&
    kbArticles.length === 1 &&
    inventoryCount > 0 &&
    counterCount > 0;

  console.log("\n" + "═".repeat(80));
  if (allValid) {
    console.log("✅ ALL TESTS PASSED! All 3 layers working correctly.");
  } else {
    console.log("❌ SOME TESTS FAILED! Check counts above.");
  }
  console.log("═".repeat(80));

  console.log("\n💡 Tip: You can now inspect or clean up using the menu\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 1b: Immutable Store Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testImmutableStore() {
  console.log("\n💾 Testing: immutable.store()...");

  const entry = {
    type: "kb-article",
    id: "test-article-interactive",
    data: {
      title: "Test Article",
      content: "This is a test article created interactively",
      version: 1,
    },
    metadata: {
      publishedBy: "interactive-runner",
      tags: ["test", "interactive"],
      importance: 50,
    },
  };

  console.log("📤 Input:", JSON.stringify(entry, null, 2));

  const result = await cortex.immutable.store(entry);
  currentImmutableType = result.type;
  currentImmutableId = result.id;

  console.log("\n📥 Result:");
  console.log(`  Type: ${result.type}`);
  console.log(`  ID: ${result.id}`);
  console.log(`  Version: ${result.version}`);
  console.log(`  Previous versions: ${result.previousVersions.length}`);
  console.log(`  Created: ${new Date(result.createdAt).toISOString()}`);

  console.log(
    `\n🎯 Current entry set to: ${result.type}/${result.id} (v${result.version})`,
  );
  console.log();
}

async function testImmutableGet() {
  if (!currentImmutableType || !currentImmutableId) {
    console.log(
      "\n⚠️  No current entry. Run immutable.store first (option 16).\n",
    );
    return;
  }

  console.log(
    `\n📖 Testing: immutable.get("${currentImmutableType}", "${currentImmutableId}")...`,
  );

  const result = await cortex.immutable.get(
    currentImmutableType,
    currentImmutableId,
  );

  if (result) {
    console.log("\n📥 Result:");
    console.log(`  Type: ${result.type}`);
    console.log(`  ID: ${result.id}`);
    console.log(`  Version: ${result.version}`);
    console.log(`  Data:`, JSON.stringify(result.data, null, 2));
    console.log(`  Previous versions: ${result.previousVersions.length}`);
  } else {
    console.log("\n❌ Entry not found");
  }
  console.log();
}

async function testImmutableGetVersion() {
  if (!currentImmutableType || !currentImmutableId) {
    console.log(
      "\n⚠️  No current entry. Run immutable.store first (option 16).\n",
    );
    return;
  }

  console.log(
    `\n🔢 Testing: immutable.getVersion("${currentImmutableType}", "${currentImmutableId}", 1)...`,
  );

  const v1 = await cortex.immutable.getVersion(
    currentImmutableType,
    currentImmutableId,
    1,
  );

  if (v1) {
    console.log("\n📥 Version 1:");
    console.log(`  Data:`, JSON.stringify(v1.data, null, 2));
    console.log(`  Timestamp: ${new Date(v1.timestamp).toISOString()}`);
  } else {
    console.log("\n⚠️  Version 1 not found (might have been cleaned up)");
  }
  console.log();
}

async function testImmutableGetHistory() {
  if (!currentImmutableType || !currentImmutableId) {
    console.log(
      "\n⚠️  No current entry. Run immutable.store first (option 16).\n",
    );
    return;
  }

  console.log(
    `\n📜 Testing: immutable.getHistory("${currentImmutableType}", "${currentImmutableId}")...`,
  );

  const history = await cortex.immutable.getHistory(
    currentImmutableType,
    currentImmutableId,
  );

  console.log(`\n📥 Found ${history.length} version(s)`);

  history.forEach((version, i) => {
    console.log(`\n  Version ${version.version}:`);
    console.log(`    Timestamp: ${new Date(version.timestamp).toISOString()}`);
    console.log(
      `    Data:`,
      JSON.stringify(version.data).substring(0, 100) + "...",
    );
  });
  console.log();
}

async function testImmutableList() {
  console.log("\n📋 Testing: immutable.list({ type: 'kb-article' })...");

  const entries = await cortex.immutable.list({
    type: "kb-article",
  });

  console.log(`\n📥 Found ${entries.length} entry/entries`);

  entries.forEach((entry, i) => {
    console.log(`\n  [${i + 1}] ${entry.type}/${entry.id} (v${entry.version})`);
    console.log(`      Created: ${new Date(entry.createdAt).toISOString()}`);
    console.log(`      Versions: ${entry.previousVersions.length + 1}`);
  });
  console.log();
}

async function testImmutableSearch() {
  console.log("\n🔍 Testing: immutable.search({ query: 'test' })...");

  const results = await cortex.immutable.search({
    query: "test",
    limit: 5,
  });

  console.log(`\n📥 Found ${results.length} matching entry/entries`);

  results.forEach((result, i) => {
    console.log(`\n  [${i + 1}] ${result.entry.type}/${result.entry.id}`);
    console.log(`      Score: ${result.score}`);
    console.log(`      Highlights: ${result.highlights.join(", ")}`);
  });
  console.log();
}

async function testImmutableCount() {
  console.log("\n🔢 Testing: immutable.count({ type: 'kb-article' })...");

  const count = await cortex.immutable.count({
    type: "kb-article",
  });

  console.log(`\n📥 Count: ${count}`);
  console.log();
}

async function testImmutablePurge() {
  if (!currentImmutableType || !currentImmutableId) {
    console.log(
      "\n⚠️  No current entry. Run immutable.store first (option 31).\n",
    );
    return;
  }

  console.log(
    `\n🗑️  Testing: immutable.purge("${currentImmutableType}", "${currentImmutableId}")...`,
  );

  const result = await cortex.immutable.purge(
    currentImmutableType,
    currentImmutableId,
  );

  console.log("\n📥 Result:");
  console.log(`  Deleted: ${result.deleted}`);
  console.log(`  Versions deleted: ${result.versionsDeleted}`);

  // Verify deletion
  const check = await cortex.immutable.get(
    currentImmutableType,
    currentImmutableId,
  );
  if (check === null) {
    console.log("  ✅ Verified: Entry no longer exists");
  } else {
    console.log("  ❌ ERROR: Entry still exists!");
  }

  currentImmutableType = null;
  currentImmutableId = null;
  console.log();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Advanced Conversations Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testConvPropagation() {
  console.log("\n🔄 Testing: State Change Propagation...");
  console.log(
    "Creating conversation and adding 5 messages, verifying propagation to all APIs\n",
  );

  // Create conversation
  const conv = await cortex.conversations.create({
    type: "user-agent",
    participants: {
      userId: TEST_USER_ID,
      agentId: TEST_AGENT_ID,
    },
  });
  currentConversationId = conv.conversationId;

  console.log(`✅ Created: ${conv.conversationId}`);
  console.log(`   Initial message count: ${conv.messageCount}`);

  // Add 5 messages
  for (let i = 1; i <= 5; i++) {
    await cortex.conversations.addMessage({
      conversationId: conv.conversationId,
      message: {
        role: i % 2 === 0 ? "agent" : "user",
        content: `Message ${i} with PROPAGATE keyword`,
      },
    });
    console.log(`   Added message ${i}/5`);
  }

  // Verify in get()
  const retrieved = await cortex.conversations.get(conv.conversationId);
  console.log(`\n✅ get() shows ${retrieved!.messageCount} messages`);

  // Verify in list()
  const list = await cortex.conversations.list({ userId: TEST_USER_ID });
  const inList = list.find((c) => c.conversationId === conv.conversationId);
  console.log(`✅ list() shows ${inList?.messageCount} messages`);

  // Verify in search()
  const searchResults = await cortex.conversations.search({
    query: "PROPAGATE",
  });
  const inSearch = searchResults.find(
    (r) => r.conversation.conversationId === conv.conversationId,
  );
  console.log(
    `✅ search() found with ${inSearch?.matchedMessages.length} matched messages`,
  );

  // Verify in getHistory()
  const history = await cortex.conversations.getHistory(conv.conversationId);
  console.log(`✅ getHistory() returned ${history.messages.length} messages`);

  console.log("\n🎯 Validation:");
  const allMatch =
    retrieved!.messageCount === 5 &&
    inList?.messageCount === 5 &&
    inSearch?.matchedMessages.length === 5 &&
    history.messages.length === 5;

  if (allMatch) {
    console.log("  ✅ ALL OPERATIONS SHOW 5 MESSAGES - Propagation working!");
  } else {
    console.log("  ❌ INCONSISTENCY DETECTED!");
    console.log(
      `     get: ${retrieved!.messageCount}, list: ${inList?.messageCount}, search: ${inSearch?.matchedMessages.length}, history: ${history.messages.length}`,
    );
  }
  console.log();
}

async function testConvManyMessages() {
  console.log("\n🏋️  Testing: Edge Case - 100+ Messages...");
  console.log(
    "Creating conversation with 100 messages and testing pagination\n",
  );

  // Create conversation
  const conv = await cortex.conversations.create({
    type: "user-agent",
    participants: {
      userId: TEST_USER_ID,
      agentId: TEST_AGENT_ID,
    },
  });
  currentConversationId = conv.conversationId;

  console.log(`✅ Created: ${conv.conversationId}`);

  // Add 100 messages
  console.log("   Adding 100 messages...");
  for (let i = 1; i <= 100; i++) {
    await cortex.conversations.addMessage({
      conversationId: conv.conversationId,
      message: {
        role: i % 2 === 0 ? "agent" : "user",
        content: `Message ${i}`,
      },
    });
    if (i % 20 === 0) {
      console.log(`   Progress: ${i}/100`);
    }
  }

  console.log("✅ Added 100 messages");

  // Get full conversation
  const retrieved = await cortex.conversations.get(conv.conversationId);
  console.log(`\n✅ get() returned ${retrieved!.messageCount} messages`);

  // Test pagination
  const page1 = await cortex.conversations.getHistory(conv.conversationId, {
    limit: 20,
    offset: 0,
    sortOrder: "asc",
  });
  console.log(
    `✅ getHistory(limit: 20, offset: 0) returned ${page1.messages.length} messages`,
  );
  console.log(`   First message: "${page1.messages[0].content}"`);

  const page2 = await cortex.conversations.getHistory(conv.conversationId, {
    limit: 20,
    offset: 20,
    sortOrder: "asc",
  });
  console.log(
    `✅ getHistory(limit: 20, offset: 20) returned ${page2.messages.length} messages`,
  );
  console.log(`   First message: "${page2.messages[0].content}"`);

  console.log("\n🎯 Validation:");
  if (page1.messages[0].content !== page2.messages[0].content) {
    console.log("  ✅ Pages are different - Pagination working!");
  } else {
    console.log("  ❌ Pages are the same - Pagination issue!");
  }
  console.log();
}

async function testConvDeleteMany() {
  console.log("\n🗑️  Testing: conversations.deleteMany()...");

  // Create multiple conversations
  console.log("Creating 5 test conversations...");
  for (let i = 1; i <= 5; i++) {
    await cortex.conversations.create({
      type: "user-agent",
      participants: {
        userId: `${TEST_USER_ID}-bulk`,
        agentId: TEST_AGENT_ID,
      },
    });
  }

  const countBefore = await cortex.conversations.count({
    userId: `${TEST_USER_ID}-bulk`,
  });
  console.log(`✅ Created ${countBefore} conversations`);

  // Delete all
  const result = await cortex.conversations.deleteMany({
    userId: `${TEST_USER_ID}-bulk`,
  });

  console.log(`\n📥 Result:`);
  console.log(`  Deleted: ${result.deleted}`);
  console.log(`  Messages deleted: ${result.totalMessagesDeleted}`);

  // Verify
  const countAfter = await cortex.conversations.count({
    userId: `${TEST_USER_ID}-bulk`,
  });
  console.log(
    `\n✅ Verification: ${countAfter === 0 ? "All deleted" : `${countAfter} remaining`}`,
  );
  console.log();
}

async function testConvGetMessage() {
  if (!currentConversationId) {
    console.log(
      "\n⚠️  No current conversation. Create one first (option 11).\n",
    );
    return;
  }

  console.log(`\n📧 Testing: conversations.getMessage()...`);

  // Get the conversation to find a message ID
  const conv = await cortex.conversations.get(currentConversationId);
  if (!conv || conv.messages.length === 0) {
    console.log(
      "⚠️  No messages in conversation. Add a message first (option 14).\n",
    );
    return;
  }

  const messageId = conv.messages[0].id;
  console.log(`Looking for message: ${messageId}`);

  const message = await cortex.conversations.getMessage(
    currentConversationId,
    messageId,
  );

  if (message) {
    console.log(`\n📥 Found message:`);
    console.log(`  ID: ${message.id}`);
    console.log(`  Role: ${message.role}`);
    console.log(`  Content: ${message.content.substring(0, 50)}...`);
  } else {
    console.log("\n❌ Message not found");
  }
  console.log();
}

async function testConvGetMessagesByIds() {
  if (!currentConversationId) {
    console.log(
      "\n⚠️  No current conversation. Create one first (option 11).\n",
    );
    return;
  }

  console.log(`\n📧 Testing: conversations.getMessagesByIds()...`);

  const conv = await cortex.conversations.get(currentConversationId);
  if (!conv || conv.messages.length === 0) {
    console.log("⚠️  No messages in conversation.\n");
    return;
  }

  const messageIds = conv.messages.slice(0, 3).map((m) => m.id);
  console.log(`Retrieving ${messageIds.length} messages...`);

  const messages = await cortex.conversations.getMessagesByIds(
    currentConversationId,
    messageIds,
  );

  console.log(`\n📥 Retrieved ${messages.length} messages:`);
  messages.forEach((msg, i) => {
    console.log(
      `  ${i + 1}. [${msg.role}]: ${msg.content.substring(0, 40)}...`,
    );
  });
  console.log();
}

async function testConvFindConversation() {
  console.log(`\n🔎 Testing: conversations.findConversation()...`);

  const found = await cortex.conversations.findConversation({
    type: "user-agent",
    userId: TEST_USER_ID,
    agentId: TEST_AGENT_ID,
  });

  if (found) {
    console.log(`\n📥 Found existing conversation:`);
    console.log(`  ID: ${found.conversationId}`);
    console.log(`  Messages: ${found.messageCount}`);
    console.log(`  Created: ${new Date(found.createdAt).toISOString()}`);
    currentConversationId = found.conversationId;
  } else {
    console.log(
      `\n⚠️  No existing conversation found for ${TEST_USER_ID} + ${TEST_AGENT_ID}`,
    );
  }
  console.log();
}

async function testConvGetOrCreate() {
  console.log(`\n🔄 Testing: conversations.getOrCreate()...`);
  console.log("This will find existing or create new atomically\n");

  const result = await cortex.conversations.getOrCreate({
    type: "user-agent",
    participants: {
      userId: `${TEST_USER_ID}-getorcreate`,
      agentId: TEST_AGENT_ID,
    },
  });

  console.log(`📥 Result:`);
  console.log(`  ID: ${result.conversationId}`);
  console.log(`  Messages: ${result.messageCount}`);
  console.log(
    `  ${result.messageCount === 0 ? "Created new" : "Found existing"}`,
  );

  currentConversationId = result.conversationId;

  // Call again to demonstrate it returns same
  const second = await cortex.conversations.getOrCreate({
    type: "user-agent",
    participants: {
      userId: `${TEST_USER_ID}-getorcreate`,
      agentId: TEST_AGENT_ID,
    },
  });

  console.log(
    `\n✅ Second call returned same: ${second.conversationId === result.conversationId ? "Yes" : "No"}`,
  );
  console.log();
}

async function testConvIntegration() {
  console.log("\n🔗 Testing: Cross-Operation Integration...");
  console.log("Full workflow: create → add messages → verify in all APIs\n");

  // Create
  const conv = await cortex.conversations.create({
    type: "user-agent",
    participants: {
      userId: TEST_USER_ID,
      agentId: TEST_AGENT_ID,
    },
    metadata: {
      testMarker: "INTEGRATION_TEST",
    },
  });
  currentConversationId = conv.conversationId;
  console.log(`✅ Step 1: Created conversation ${conv.conversationId}`);

  // Add message with unique keyword
  await cortex.conversations.addMessage({
    conversationId: conv.conversationId,
    message: {
      role: "user",
      content: "This message has UNIQUE_INTEGRATION_KEYWORD for testing",
    },
  });
  console.log("✅ Step 2: Added message with unique keyword");

  // Verify in all operations
  const get = await cortex.conversations.get(conv.conversationId);
  console.log(`✅ Step 3: get() returned messageCount: ${get!.messageCount}`);

  const list = await cortex.conversations.list({ userId: TEST_USER_ID });
  const inList = list.some((c) => c.conversationId === conv.conversationId);
  console.log(
    `✅ Step 4: list() ${inList ? "found" : "did not find"} conversation`,
  );

  const search = await cortex.conversations.search({
    query: "UNIQUE_INTEGRATION_KEYWORD",
  });
  const inSearch = search.some(
    (r) => r.conversation.conversationId === conv.conversationId,
  );
  console.log(
    `✅ Step 5: search() ${inSearch ? "found" : "did not find"} conversation`,
  );

  const count = await cortex.conversations.count({ userId: TEST_USER_ID });
  console.log(`✅ Step 6: count() returned ${count}`);

  const exported = await cortex.conversations.export({
    filters: { userId: TEST_USER_ID },
    format: "json",
  });
  const parsed = JSON.parse(exported.data);
  const inExport = parsed.some(
    (c: any) => c.conversationId === conv.conversationId,
  );
  console.log(
    `✅ Step 7: export() ${inExport ? "included" : "did not include"} conversation`,
  );

  console.log("\n🎯 Validation:");
  if (inList && inSearch && inExport && get!.messageCount === 1) {
    console.log("  ✅ ALL OPERATIONS CONSISTENT - Integration working!");
  } else {
    console.log("  ❌ INCONSISTENCY DETECTED across operations!");
  }
  console.log();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Advanced Immutable Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testImmPropagation() {
  console.log("\n🔄 Testing: State Change Propagation...");
  console.log(
    "Updating entry multiple times and verifying changes propagate to all APIs\n",
  );

  const type = "propagation-test";
  const id = "test-entry";

  // Create v1 with "draft" keyword
  const v1 = await cortex.immutable.store({
    type,
    id,
    data: {
      status: "draft",
      content: "This is a draft document",
    },
  });
  currentImmutableType = type;
  currentImmutableId = id;

  console.log(`✅ Step 1: Created v${v1.version} with status "draft"`);

  // Verify in search
  let searchResults = await cortex.immutable.search({ query: "draft" });
  const foundDraft = searchResults.some((r) => r.entry.id === id);
  console.log(
    `✅ Step 2: search("draft") ${foundDraft ? "found" : "did not find"} entry`,
  );

  // Update to v2 with "published" keyword
  const v2 = await cortex.immutable.store({
    type,
    id,
    data: {
      status: "published",
      content: "This is a published document",
    },
  });

  console.log(`✅ Step 3: Updated to v${v2.version} with status "published"`);

  // Verify get() shows new version
  const current = await cortex.immutable.get(type, id);
  console.log(
    `✅ Step 4: get() returned v${current!.version} with status "${current!.data.status}"`,
  );

  // Verify search finds new keyword
  searchResults = await cortex.immutable.search({ query: "published" });
  const foundPublished = searchResults.some((r) => r.entry.id === id);
  console.log(
    `✅ Step 5: search("published") ${foundPublished ? "found" : "did not find"} entry`,
  );

  // Verify search doesn't find old keyword
  const draftResults = await cortex.immutable.search({ query: "draft" });
  const stillHasDraft = draftResults.some((r) => r.entry.id === id);
  console.log(
    `✅ Step 6: search("draft") ${stillHasDraft ? "still found" : "no longer finds"} entry`,
  );

  // Verify getVersion(1) still has old data
  const historicalV1 = await cortex.immutable.getVersion(type, id, 1);
  console.log(
    `✅ Step 7: getVersion(1) still has status "${historicalV1!.data.status}"`,
  );

  console.log("\n🎯 Validation:");
  if (
    current!.version === 2 &&
    foundPublished &&
    !stillHasDraft &&
    historicalV1!.data.status === "draft"
  ) {
    console.log("  ✅ STATE CHANGES PROPAGATED CORRECTLY!");
    console.log("     - Current version updated");
    console.log("     - Search reflects new content");
    console.log("     - Historical versions preserved");
  } else {
    console.log("  ❌ PROPAGATION ISSUE DETECTED!");
  }
  console.log();
}

async function testImmManyVersions() {
  console.log("\n🏋️  Testing: Edge Case - 25 Versions...");
  console.log(
    "Creating entry with 25 versions and testing version retrieval\n",
  );

  const type = "stress-test";
  const id = "many-versions";

  console.log("Creating 25 versions...");
  for (let i = 1; i <= 25; i++) {
    await cortex.immutable.store({
      type,
      id,
      data: {
        iteration: i,
        content: `Version ${i} content`,
      },
    });
    if (i % 5 === 0) {
      console.log(`   Progress: ${i}/25`);
    }
  }
  currentImmutableType = type;
  currentImmutableId = id;

  console.log("✅ Created 25 versions");

  // Get current
  const current = await cortex.immutable.get(type, id);
  console.log(
    `\n✅ get() returned v${current!.version} with iteration ${current!.data.iteration}`,
  );
  console.log(
    `   Previous versions stored: ${current!.previousVersions.length}`,
  );

  // Get history
  const history = await cortex.immutable.getHistory(type, id);
  console.log(`✅ getHistory() returned ${history.length} versions`);

  // Spot check specific versions
  const v1 = await cortex.immutable.getVersion(type, id, 1);
  const v10 = await cortex.immutable.getVersion(type, id, 10);
  const v25 = await cortex.immutable.getVersion(type, id, 25);

  console.log(`\n✅ Version spot check:`);
  console.log(`   v1: iteration ${v1!.data.iteration}`);
  console.log(`   v10: iteration ${v10!.data.iteration}`);
  console.log(`   v25: iteration ${v25!.data.iteration}`);

  console.log("\n🎯 Validation:");
  if (
    current!.version === 25 &&
    history.length === 25 &&
    v1!.data.iteration === 1 &&
    v25!.data.iteration === 25
  ) {
    console.log("  ✅ ALL 25 VERSIONS ACCESSIBLE - Version history working!");
  } else {
    console.log("  ❌ VERSION ISSUE DETECTED!");
  }
  console.log();
}

async function testImmGetAtTimestamp() {
  if (!currentImmutableType || !currentImmutableId) {
    console.log(
      "\n⚠️  No current entry. Run immutable.store first (option 41).\n",
    );
    return;
  }

  console.log(`\n⏰ Testing: immutable.getAtTimestamp()...`);

  // Get history to find timestamps
  const history = await cortex.immutable.getHistory(
    currentImmutableType,
    currentImmutableId,
  );

  if (history.length === 0) {
    console.log("⚠️  No history available.\n");
    return;
  }

  // Try past, present, future
  const past = history[0].timestamp - 1000;
  const atV1 = history[0].timestamp;
  const future = Date.now() + 10000;

  console.log("\n📥 Testing different timestamps:");

  const beforeCreation = await cortex.immutable.getAtTimestamp(
    currentImmutableType,
    currentImmutableId,
    past,
  );
  console.log(
    `  Before creation: ${beforeCreation ? `v${beforeCreation.version}` : "null (didn't exist)"}`,
  );

  const atFirst = await cortex.immutable.getAtTimestamp(
    currentImmutableType,
    currentImmutableId,
    atV1,
  );
  console.log(
    `  At first version: ${atFirst ? `v${atFirst.version}` : "null"}`,
  );

  const inFuture = await cortex.immutable.getAtTimestamp(
    currentImmutableType,
    currentImmutableId,
    future,
  );
  console.log(
    `  In future: ${inFuture ? `v${inFuture.version} (current)` : "null"}`,
  );
  console.log();
}

async function testImmPurgeMany() {
  console.log("\n🗑️  Testing: immutable.purgeMany()...");

  // Create test entries
  console.log("Creating 3 test entries...");
  for (let i = 1; i <= 3; i++) {
    await cortex.immutable.store({
      type: "bulk-delete-test",
      id: `entry-${i}`,
      data: { value: i },
    });
  }

  const countBefore = await cortex.immutable.count({
    type: "bulk-delete-test",
  });
  console.log(`✅ Created ${countBefore} entries`);

  // Purge all
  const result = await cortex.immutable.purgeMany({ type: "bulk-delete-test" });

  console.log(`\n📥 Deleted:`);
  console.log(`  Entries: ${result.deleted}`);
  console.log(`  Total versions: ${result.totalVersionsDeleted}`);

  const countAfter = await cortex.immutable.count({ type: "bulk-delete-test" });
  console.log(
    `\n✅ Verification: ${countAfter === 0 ? "All deleted" : `${countAfter} remaining`}`,
  );
  console.log();
}

async function testImmPurgeVersions() {
  console.log("\n🧹 Testing: immutable.purgeVersions()...");

  const type = "version-retention";
  const id = "test-entry";

  // Create 10 versions
  console.log("Creating 10 versions...");
  for (let i = 1; i <= 10; i++) {
    await cortex.immutable.store({
      type,
      id,
      data: { iteration: i },
    });
  }

  const before = await cortex.immutable.get(type, id);
  console.log(`✅ Created ${before!.version} versions`);

  // Keep only latest 5
  const result = await cortex.immutable.purgeVersions(type, id, 5);

  console.log(`\n📥 Purge result:`);
  console.log(`  Versions purged: ${result.versionsPurged}`);
  console.log(`  Versions remaining: ${result.versionsRemaining}`);

  const after = await cortex.immutable.get(type, id);
  console.log(
    `\n✅ Verification: ${after!.previousVersions.length + 1} versions remain`,
  );
  console.log();
}

async function testImmIntegration() {
  console.log("\n🔗 Testing: Cross-Operation Integration...");
  console.log("Full workflow: store → list → search → count consistency\n");

  const type = "integration-test";
  const id = "workflow-test";

  // Step 1: Store with unique keyword
  const v1 = await cortex.immutable.store({
    type,
    id,
    data: {
      title: "Integration Test",
      content: "This entry contains UNIQUE_IMM_KEYWORD for testing",
    },
  });
  currentImmutableType = type;
  currentImmutableId = id;

  console.log(`✅ Step 1: store() created v${v1.version}`);

  // Step 2: Verify in list
  const list1 = await cortex.immutable.list({ type });
  const inList = list1.some((e) => e.id === id);
  console.log(`✅ Step 2: list() ${inList ? "found" : "did not find"} entry`);

  // Step 3: Verify in search
  const search1 = await cortex.immutable.search({
    query: "UNIQUE_IMM_KEYWORD",
    type,
  });
  const inSearch1 = search1.some((r) => r.entry.id === id);
  console.log(
    `✅ Step 3: search() ${inSearch1 ? "found" : "did not find"} entry`,
  );

  // Step 4: Count
  const count1 = await cortex.immutable.count({ type });
  console.log(`✅ Step 4: count() returned ${count1}`);

  // Step 5: Update content (remove old keyword, add new)
  const v2 = await cortex.immutable.store({
    type,
    id,
    data: {
      title: "Integration Test Updated",
      content: "This entry now contains DIFFERENT_KEYWORD instead",
    },
  });

  console.log(`\n✅ Step 5: Updated to v${v2.version}`);

  // Step 6: List should still show it
  const list2 = await cortex.immutable.list({ type });
  const stillInList = list2.some((e) => e.id === id);
  console.log(
    `✅ Step 6: list() still ${stillInList ? "shows" : "does not show"} entry`,
  );

  // Step 7: Old keyword search should NOT find it
  const searchOld = await cortex.immutable.search({
    query: "UNIQUE_IMM_KEYWORD",
    type,
  });
  const foundOld = searchOld.some((r) => r.entry.id === id);
  console.log(
    `✅ Step 7: search("UNIQUE_IMM_KEYWORD") ${foundOld ? "still found (BAD)" : "no longer finds (GOOD)"}`,
  );

  // Step 8: New keyword search should find it
  const searchNew = await cortex.immutable.search({
    query: "DIFFERENT_KEYWORD",
    type,
  });
  const foundNew = searchNew.some((r) => r.entry.id === id);
  console.log(
    `✅ Step 8: search("DIFFERENT_KEYWORD") ${foundNew ? "found (GOOD)" : "did not find (BAD)"}`,
  );

  // Step 9: Count should be unchanged
  const count2 = await cortex.immutable.count({ type });
  console.log(`✅ Step 9: count() unchanged at ${count2}`);

  console.log("\n🎯 Validation:");
  if (stillInList && !foundOld && foundNew && count1 === count2) {
    console.log("  ✅ CROSS-OPERATION CONSISTENCY VERIFIED!");
    console.log("     - Entry remains in list after update");
    console.log("     - Search reflects new content");
    console.log("     - Count unchanged");
  } else {
    console.log("  ❌ INCONSISTENCY DETECTED!");
  }
  console.log();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 1c: Mutable Store Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testMutableSet() {
  console.log("\n💾 Testing: mutable.set()...");

  const result = await cortex.mutable.set("inventory", "widget-qty", 100);

  console.log("📥 Result:");
  console.log(`  Namespace: ${result.namespace}`);
  console.log(`  Key: ${result.key}`);
  console.log(`  Value: ${result.value}`);
  console.log();
}

async function testMutableGet() {
  console.log("\n📖 Testing: mutable.get()...");

  const value = await cortex.mutable.get("inventory", "widget-qty");

  console.log(`📥 Value: ${value !== null ? value : "null (key not found)"}`);
  console.log();
}

async function testMutableUpdate() {
  console.log("\n🔄 Testing: mutable.update()...");

  await cortex.mutable.set("counters", "test-counter", 0);

  const result = await cortex.mutable.update(
    "counters",
    "test-counter",
    (current) => current + 10,
  );

  console.log(`📥 Updated value: ${result.value}`);
  console.log();
}

async function testMutableIncrement() {
  console.log("\n➕ Testing: mutable.increment()...");

  await cortex.mutable.set("counters", "inc-test", 0);
  await cortex.mutable.increment("counters", "inc-test", 5);

  const value = await cortex.mutable.get("counters", "inc-test");
  console.log(`📥 After increment(5): ${value}`);
  console.log();
}

async function testMutableDecrement() {
  console.log("\n➖ Testing: mutable.decrement()...");

  await cortex.mutable.set("inventory", "dec-test", 100);
  await cortex.mutable.decrement("inventory", "dec-test", 10);

  const value = await cortex.mutable.get("inventory", "dec-test");
  console.log(`📥 After decrement(10): ${value}`);
  console.log();
}

async function testMutableList() {
  console.log("\n📋 Testing: mutable.list()...");

  const items = await cortex.mutable.list({ namespace: "inventory" });

  console.log(`\n📥 Found ${items.length} items in inventory:`);
  items.slice(0, 5).forEach((item) => {
    console.log(
      `  ${item.key}: ${JSON.stringify(item.value).substring(0, 40)}`,
    );
  });
  console.log();
}

async function testMutableCount() {
  console.log("\n🔢 Testing: mutable.count()...");

  const count = await cortex.mutable.count({ namespace: "inventory" });

  console.log(`📥 Count: ${count} items in inventory`);
  console.log();
}

async function testMutableExists() {
  console.log("\n❓ Testing: mutable.exists()...");

  const exists = await cortex.mutable.exists("inventory", "widget-qty");

  console.log(`📥 widget-qty exists: ${exists ? "Yes" : "No"}`);
  console.log();
}

async function testMutableDelete() {
  console.log("\n🗑️  Testing: mutable.delete()...");

  await cortex.mutable.set("temp", "delete-me", "temporary");
  console.log("✅ Created temp/delete-me");

  await cortex.mutable.delete("temp", "delete-me");
  console.log("✅ Deleted temp/delete-me");

  const exists = await cortex.mutable.exists("temp", "delete-me");
  console.log(
    `✅ Verification: ${exists ? "Still exists (ERROR)" : "Deleted successfully"}`,
  );
  console.log();
}

async function testMutablePurgeNamespace() {
  console.log("\n🧹 Testing: mutable.purgeNamespace()...");

  // Create test entries
  await cortex.mutable.set("purge-ns-test", "key-1", 1);
  await cortex.mutable.set("purge-ns-test", "key-2", 2);

  const countBefore = await cortex.mutable.count({
    namespace: "purge-ns-test",
  });
  console.log(`✅ Created ${countBefore} keys`);

  const result = await cortex.mutable.purgeNamespace("purge-ns-test");

  console.log(`📥 Deleted ${result.deleted} keys`);

  const countAfter = await cortex.mutable.count({ namespace: "purge-ns-test" });
  console.log(
    `✅ Verification: ${countAfter === 0 ? "All deleted" : `${countAfter} remaining`}`,
  );
  console.log();
}

async function testMutablePurgeMany() {
  console.log("\n🗑️  Testing: mutable.purgeMany()...");

  // Create test entries
  await cortex.mutable.set("bulk-mut-del", "temp-1", "a");
  await cortex.mutable.set("bulk-mut-del", "temp-2", "b");
  await cortex.mutable.set("bulk-mut-del", "keep-1", "c");

  const countBefore = await cortex.mutable.count({ namespace: "bulk-mut-del" });
  console.log(`✅ Created ${countBefore} keys`);

  const result = await cortex.mutable.purgeMany({
    namespace: "bulk-mut-del",
    keyPrefix: "temp-",
  });

  console.log(`\n📥 Deleted ${result.deleted} keys with prefix "temp-"`);
  console.log(`Keys deleted: ${result.keys.join(", ")}`);

  const countAfter = await cortex.mutable.count({
    namespace: "bulk-mut-del",
    keyPrefix: "temp-",
  });
  console.log(
    `\n✅ Verification: ${countAfter === 0 ? "All temp- keys deleted" : `${countAfter} remaining`}`,
  );
  console.log();
}

async function runMutableTests() {
  console.log("\n🔄 Running all Mutable Store API tests...\n");
  console.log("═".repeat(80));

  await purgeAllDatabases();
  console.log("═".repeat(80));

  console.log("\n  CORE OPERATIONS\n");
  console.log("═".repeat(80));

  await testMutableSet();
  console.log("═".repeat(80));

  await testMutableGet();
  console.log("═".repeat(80));

  await testMutableUpdate();
  console.log("═".repeat(80));

  await testMutableIncrement();
  console.log("═".repeat(80));

  await testMutableDecrement();
  console.log("═".repeat(80));

  await testMutableList();
  console.log("═".repeat(80));

  await testMutableCount();
  console.log("═".repeat(80));

  await testMutableExists();
  console.log("═".repeat(80));

  await testMutableDelete();
  console.log("═".repeat(80));

  await testMutablePurgeNamespace();
  console.log("═".repeat(80));

  await testMutablePurgeMany();
  console.log("═".repeat(80));

  // Final validation
  console.log("\n🔍 MUTABLE STORE VALIDATION\n");
  console.log("═".repeat(80));

  const inventoryCount = await cortex.mutable.count({ namespace: "inventory" });
  const counterCount = await cortex.mutable.count({ namespace: "counters" });

  console.log("📊 Results:");
  console.log(`  Inventory items: ${inventoryCount}`);
  console.log(`  Counters: ${counterCount}`);

  console.log("\n✅ Mutable Store tests complete!\n");
}

function exit() {
  console.log("\n👋 Goodbye!\n");
  process.exit(0);
}

// Display menu
function displayMenu() {
  console.log("═".repeat(80));
  console.log("  🧪 CORTEX SDK - INTERACTIVE TEST RUNNER");
  console.log("═".repeat(80));
  console.log();

  // Utility
  console.log("  🛠️  UTILITY");
  console.log("   1) 🧹 Purge All Databases");
  console.log("   2) 📊 Inspect Database State");
  console.log();

  // Layer 1a
  console.log("  💬 LAYER 1A: CONVERSATIONS API");
  console.log("  10) [Category Header]");
  console.log("     Core Operations:");
  console.log("  11)   ➕ create (user-agent)");
  console.log("  12)   ➕ create (agent-agent)");
  console.log("  13)   📖 get");
  console.log("  14)   💬 addMessage");
  console.log("  15)   📋 list (by user)");
  console.log("  16)   📋 list (by agent)");
  console.log("  17)   🔢 count");
  console.log("  18)   📜 getHistory");
  console.log("  19)   🔍 search");
  console.log("  20)   💾 export (JSON)");
  console.log("  21)   📊 export (CSV)");
  console.log("  22)   🗑️  delete");
  console.log("     Advanced Tests:");
  console.log("  23)   🔄 Propagation (5 msgs)");
  console.log("  24)   🏋️  Edge (100+ msgs)");
  console.log("  25)   🔗 Integration");
  console.log("     Advanced Operations:");
  console.log("  26)   🗑️  deleteMany");
  console.log("  27)   📧 getMessage");
  console.log("  28)   📧 getMessagesByIds");
  console.log("  29)   🔎 findConversation");
  console.log("  30)   🔄 getOrCreate");
  console.log("  39)   🎯 Run All");
  console.log();

  // Layer 1b
  console.log("  💾 LAYER 1B: IMMUTABLE STORE API");
  console.log("  40) [Category Header]");
  console.log("     Core Operations:");
  console.log("  41)   💾 store");
  console.log("  42)   📖 get");
  console.log("  43)   🔢 getVersion");
  console.log("  44)   📜 getHistory");
  console.log("  45)   📋 list");
  console.log("  46)   🔍 search");
  console.log("  47)   🔢 count");
  console.log("  48)   🗑️  purge");
  console.log("     Advanced:");
  console.log("  50)   🔄 Propagation");
  console.log("  51)   🏋️  Edge (25 vers)");
  console.log("  52)   🔗 Integration");
  console.log("  53)   ⏰ getAtTimestamp");
  console.log("  54)   🗑️  purgeMany");
  console.log("  55)   🧹 purgeVersions");
  console.log("  59)   🎯 Run All");
  console.log();

  // Layer 1c
  console.log("  🔄 LAYER 1C: MUTABLE STORE API");
  console.log("  60) [Category Header]");
  console.log("     Operations:");
  console.log("  61)   💾 set");
  console.log("  62)   📖 get");
  console.log("  63)   🔄 update");
  console.log("  64)   ➕ increment");
  console.log("  65)   ➖ decrement");
  console.log("  66)   📋 list");
  console.log("  67)   🔢 count");
  console.log("  68)   ❓ exists");
  console.log("  69)   🗑️  delete");
  console.log("  70)   🧹 purgeNamespace");
  console.log("  71)   🗑️  purgeMany");
  console.log("  79)   🎯 Run All");
  console.log();

  // Global
  console.log("  🌐 GLOBAL");
  console.log("  99) 🎯 Run All Tests (All 3 Layers)");
  console.log("   0) ❌ Exit");
  console.log();
  console.log("═".repeat(80));

  if (currentConversationId || currentImmutableType) {
    if (currentConversationId) {
      console.log(`🎯 Conversation: ${currentConversationId}`);
    }
    if (currentImmutableType && currentImmutableId) {
      console.log(
        `🎯 Immutable Entry: ${currentImmutableType}/${currentImmutableId}`,
      );
    }
    console.log("═".repeat(80));
  }
}

// Get user input
function getUserChoice(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("\n👉 Select an option: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Main loop
async function mainLoop() {
  while (true) {
    displayMenu();
    const choice = await getUserChoice();

    const option = MENU_OPTIONS[choice as keyof typeof MENU_OPTIONS];

    if (option) {
      try {
        await option.action();
      } catch (error: any) {
        console.log("\n❌ Error:", error.message);
        console.log(error.stack);
        console.log();
      }
    } else {
      console.log("\n⚠️  Invalid option. Please try again.\n");
    }

    // Pause before showing menu again
    if (choice !== "0") {
      await new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question("\nPress Enter to continue...", () => {
          rl.close();
          resolve(null);
        });
      });
      console.clear();
    }
  }
}

// Start the interactive runner
async function start() {
  console.clear();
  console.log("\n🚀 Starting Interactive Test Runner...\n");

  try {
    await initialize();
    await mainLoop();
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run it
start();
