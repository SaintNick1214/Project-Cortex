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
  "10": { label: "💬 Conversations API ─────────────", action: showConversationsMenu },
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
  "23": { label: "  🔄 Propagation: Add 5 msgs & verify", action: testConvPropagation },
  "24": { label: "  🏋️  Edge: 100+ messages", action: testConvManyMessages },
  "25": { label: "  🔗 Integration: Full workflow", action: testConvIntegration },
  "29": { label: "  🎯 Run All Conversations Tests", action: runConversationsTests },
  
  // ═══════════════════════════════════════════════════════════════════════
  // Layer 1b: Immutable Store API
  // ═══════════════════════════════════════════════════════════════════════
  "30": { label: "💾 Immutable Store API ───────────", action: showImmutableMenu },
  "31": { label: "  💾 store (create/update)", action: testImmutableStore },
  "32": { label: "  📖 get", action: testImmutableGet },
  "33": { label: "  🔢 getVersion", action: testImmutableGetVersion },
  "34": { label: "  📜 getHistory", action: testImmutableGetHistory },
  "35": { label: "  📋 list", action: testImmutableList },
  "36": { label: "  🔍 search", action: testImmutableSearch },
  "37": { label: "  🔢 count", action: testImmutableCount },
  "38": { label: "  🗑️  purge", action: testImmutablePurge },
  "40": { label: "  🔄 Propagation: Update & verify", action: testImmPropagation },
  "41": { label: "  🏋️  Edge: 25 versions", action: testImmManyVersions },
  "42": { label: "  🔗 Integration: Full workflow", action: testImmIntegration },
  "49": { label: "  🎯 Run All Immutable Tests", action: runImmutableTests },
  
  // ═══════════════════════════════════════════════════════════════════════
  // Run All
  // ═══════════════════════════════════════════════════════════════════════
  "99": { label: "🎯 Run All Tests (Both Layers)", action: runAllTests },
  "0": { label: "❌ Exit", action: exit },
};

// Category placeholders (just show a message)
async function showConversationsMenu() {
  console.log("\n💬 Conversations API");
  console.log("Select individual tests (11-22) or run all (29)\n");
}

async function showImmutableMenu() {
  console.log("\n💾 Immutable Store API");
  console.log("Select individual tests (31-38) or run all (39)\n");
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
      agentIds: [TEST_AGENT_ID, "agent-target-interactive", "agent-observer-interactive"],
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
    console.log("\n⚠️  No current conversation ID. Create a conversation first (option 3 or 4).\n");
    return;
  }

  console.log(`\n📖 Testing: conversations.get("${currentConversationId}")...`);

  const result = await cortex.conversations.get(currentConversationId);

  console.log("\n📥 Result:", JSON.stringify(result, null, 2));
  console.log();
}

async function testAddMessage() {
  if (!currentConversationId) {
    console.log("\n⚠️  No current conversation ID. Create a conversation first (option 3 or 4).\n");
    return;
  }

  console.log(`\n💬 Testing: conversations.addMessage("${currentConversationId}")...`);

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
  console.log(`\n📋 Testing: conversations.list({ userId: "${TEST_USER_ID}" })...`);

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
  console.log(`\n📋 Testing: conversations.list({ agentId: "${TEST_AGENT_ID}" })...`);

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
  console.log(`\n🔢 Testing: conversations.count({ userId: "${TEST_USER_ID}" })...`);

  const count = await cortex.conversations.count({
    userId: TEST_USER_ID,
  });

  console.log(`\n📥 Count: ${count}`);
  console.log();
}

async function testGetHistory() {
  if (!currentConversationId) {
    console.log("\n⚠️  No current conversation ID. Create a conversation first (option 3 or 4).\n");
    return;
  }

  console.log(`\n📜 Testing: conversations.getHistory("${currentConversationId}")...`);

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
    console.log(`    [${i + 1}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
  });

  // Try descending order
  const page2 = await cortex.conversations.getHistory(currentConversationId, {
    limit: 3,
    sortOrder: "desc",
  });

  console.log("\n📥 Page 2 (limit: 3, sortOrder: desc - newest first):");
  page2.messages.forEach((msg, i) => {
    console.log(`    [${i + 1}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
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
      console.log(`\n  [${i + 1}] Conversation: ${result.conversation.conversationId}`);
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
    console.log(JSON.stringify(parsed[0], null, 2).split("\n").slice(0, 15).join("\n"));
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
    console.log(`    ${i === 0 ? "Header" : `Row ${i}`}: ${line.substring(0, 80)}...`);
  });

  console.log("\n✅ CSV export working correctly");
  console.log();
}

async function testDelete() {
  if (!currentConversationId) {
    console.log("\n⚠️  No current conversation ID. Create a conversation first (option 3 or 4).\n");
    return;
  }

  console.log(`\n🗑️  Testing: conversations.delete("${currentConversationId}")...`);

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
  const agentConvs = await cortex.conversations.list({ agentId: TEST_AGENT_ID });

  console.log("📊 Results:");
  console.log(`  Total: ${totalCount}`);
  console.log(`  By user: ${userConvs.length}`);
  console.log(`  By agent: ${agentConvs.length}`);

  console.log("\n✅ Expected: Total=2, By user=1, By agent=2");
  console.log(`📊 Actual: ${totalCount === 2 && userConvs.length === 1 && agentConvs.length === 2 ? "✅ PASS" : "❌ FAIL"}`);
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
  console.log(`📊 Actual: ${totalCount === 1 && kbArticles.length === 1 ? "✅ PASS" : "❌ FAIL"}`);
  console.log("═".repeat(80));
  console.log("\n✅ Immutable Store tests complete!\n");
}

async function runAllTests() {
  console.log("\n🎯 Running ALL tests for BOTH layers...\n");
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

  // Final validation
  console.log("\n🔍 FINAL VALIDATION (BOTH LAYERS)\n");
  console.log("═".repeat(80));

  // Layer 1a: Conversations
  const totalConvCount = await cortex.conversations.count();
  const userConvs = await cortex.conversations.list({ userId: TEST_USER_ID });
  const agentConvs = await cortex.conversations.list({ agentId: TEST_AGENT_ID });

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

  console.log("\n✅ Expected:");
  console.log("  Conversations:");
  console.log("    - Total: 2 (1 user-agent + 1 agent-agent)");
  console.log("    - By user: 1");
  console.log("    - By agent: 2");
  console.log("  Immutable:");
  console.log("    - Total: 1 (test article)");
  console.log("    - KB articles: 1");

  console.log("\n📊 Actual:");
  console.log("  Conversations:");
  console.log(`    - Total: ${totalConvCount} ${totalConvCount === 2 ? "✅" : "❌"}`);
  console.log(`    - By user: ${userConvs.length} ${userConvs.length === 1 ? "✅" : "❌"}`);
  console.log(`    - By agent: ${agentConvs.length} ${agentConvs.length === 2 ? "✅" : "❌"}`);
  console.log("  Immutable:");
  console.log(`    - Total: ${totalImmCount} ${totalImmCount === 1 ? "✅" : "❌"}`);
  console.log(`    - KB articles: ${kbArticles.length} ${kbArticles.length === 1 ? "✅" : "❌"}`);

  const allValid = 
    totalConvCount === 2 && 
    userConvs.length === 1 && 
    agentConvs.length === 2 &&
    totalImmCount === 1 &&
    kbArticles.length === 1;
  
  console.log("\n" + "═".repeat(80));
  if (allValid) {
    console.log("✅ ALL TESTS PASSED! Both layers working correctly.");
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

  console.log(`\n🎯 Current entry set to: ${result.type}/${result.id} (v${result.version})`);
  console.log();
}

async function testImmutableGet() {
  if (!currentImmutableType || !currentImmutableId) {
    console.log("\n⚠️  No current entry. Run immutable.store first (option 16).\n");
    return;
  }

  console.log(`\n📖 Testing: immutable.get("${currentImmutableType}", "${currentImmutableId}")...`);

  const result = await cortex.immutable.get(currentImmutableType, currentImmutableId);

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
    console.log("\n⚠️  No current entry. Run immutable.store first (option 16).\n");
    return;
  }

  console.log(`\n🔢 Testing: immutable.getVersion("${currentImmutableType}", "${currentImmutableId}", 1)...`);

  const v1 = await cortex.immutable.getVersion(currentImmutableType, currentImmutableId, 1);

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
    console.log("\n⚠️  No current entry. Run immutable.store first (option 16).\n");
    return;
  }

  console.log(`\n📜 Testing: immutable.getHistory("${currentImmutableType}", "${currentImmutableId}")...`);

  const history = await cortex.immutable.getHistory(currentImmutableType, currentImmutableId);

  console.log(`\n📥 Found ${history.length} version(s)`);
  
  history.forEach((version, i) => {
    console.log(`\n  Version ${version.version}:`);
    console.log(`    Timestamp: ${new Date(version.timestamp).toISOString()}`);
    console.log(`    Data:`, JSON.stringify(version.data).substring(0, 100) + "...");
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
    console.log("\n⚠️  No current entry. Run immutable.store first (option 31).\n");
    return;
  }

  console.log(`\n🗑️  Testing: immutable.purge("${currentImmutableType}", "${currentImmutableId}")...`);

  const result = await cortex.immutable.purge(currentImmutableType, currentImmutableId);

  console.log("\n📥 Result:");
  console.log(`  Deleted: ${result.deleted}`);
  console.log(`  Versions deleted: ${result.versionsDeleted}`);
  
  // Verify deletion
  const check = await cortex.immutable.get(currentImmutableType, currentImmutableId);
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
  console.log("Creating conversation and adding 5 messages, verifying propagation to all APIs\n");

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
  const searchResults = await cortex.conversations.search({ query: "PROPAGATE" });
  const inSearch = searchResults.find((r) => r.conversation.conversationId === conv.conversationId);
  console.log(`✅ search() found with ${inSearch?.matchedMessages.length} matched messages`);

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
    console.log(`     get: ${retrieved!.messageCount}, list: ${inList?.messageCount}, search: ${inSearch?.matchedMessages.length}, history: ${history.messages.length}`);
  }
  console.log();
}

async function testConvManyMessages() {
  console.log("\n🏋️  Testing: Edge Case - 100+ Messages...");
  console.log("Creating conversation with 100 messages and testing pagination\n");

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
  console.log(`✅ getHistory(limit: 20, offset: 0) returned ${page1.messages.length} messages`);
  console.log(`   First message: "${page1.messages[0].content}"`);

  const page2 = await cortex.conversations.getHistory(conv.conversationId, {
    limit: 20,
    offset: 20,
    sortOrder: "asc",
  });
  console.log(`✅ getHistory(limit: 20, offset: 20) returned ${page2.messages.length} messages`);
  console.log(`   First message: "${page2.messages[0].content}"`);

  console.log("\n🎯 Validation:");
  if (page1.messages[0].content !== page2.messages[0].content) {
    console.log("  ✅ Pages are different - Pagination working!");
  } else {
    console.log("  ❌ Pages are the same - Pagination issue!");
  }
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
  console.log(`✅ Step 4: list() ${inList ? "found" : "did not find"} conversation`);

  const search = await cortex.conversations.search({ query: "UNIQUE_INTEGRATION_KEYWORD" });
  const inSearch = search.some((r) => r.conversation.conversationId === conv.conversationId);
  console.log(`✅ Step 5: search() ${inSearch ? "found" : "did not find"} conversation`);

  const count = await cortex.conversations.count({ userId: TEST_USER_ID });
  console.log(`✅ Step 6: count() returned ${count}`);

  const exported = await cortex.conversations.export({
    filters: { userId: TEST_USER_ID },
    format: "json",
  });
  const parsed = JSON.parse(exported.data);
  const inExport = parsed.some((c: any) => c.conversationId === conv.conversationId);
  console.log(`✅ Step 7: export() ${inExport ? "included" : "did not include"} conversation`);

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
  console.log("Updating entry multiple times and verifying changes propagate to all APIs\n");

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
  console.log(`✅ Step 2: search("draft") ${foundDraft ? "found" : "did not find"} entry`);

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
  console.log(`✅ Step 4: get() returned v${current!.version} with status "${current!.data.status}"`);

  // Verify search finds new keyword
  searchResults = await cortex.immutable.search({ query: "published" });
  const foundPublished = searchResults.some((r) => r.entry.id === id);
  console.log(`✅ Step 5: search("published") ${foundPublished ? "found" : "did not find"} entry`);

  // Verify search doesn't find old keyword
  const draftResults = await cortex.immutable.search({ query: "draft" });
  const stillHasDraft = draftResults.some((r) => r.entry.id === id);
  console.log(`✅ Step 6: search("draft") ${stillHasDraft ? "still found" : "no longer finds"} entry`);

  // Verify getVersion(1) still has old data
  const historicalV1 = await cortex.immutable.getVersion(type, id, 1);
  console.log(`✅ Step 7: getVersion(1) still has status "${historicalV1!.data.status}"`);

  console.log("\n🎯 Validation:");
  if (current!.version === 2 && foundPublished && !stillHasDraft && historicalV1!.data.status === "draft") {
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
  console.log("Creating entry with 25 versions and testing version retrieval\n");

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
  console.log(`\n✅ get() returned v${current!.version} with iteration ${current!.data.iteration}`);
  console.log(`   Previous versions stored: ${current!.previousVersions.length}`);

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
  if (current!.version === 25 && history.length === 25 && v1!.data.iteration === 1 && v25!.data.iteration === 25) {
    console.log("  ✅ ALL 25 VERSIONS ACCESSIBLE - Version history working!");
  } else {
    console.log("  ❌ VERSION ISSUE DETECTED!");
  }
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
  const search1 = await cortex.immutable.search({ query: "UNIQUE_IMM_KEYWORD", type });
  const inSearch1 = search1.some((r) => r.entry.id === id);
  console.log(`✅ Step 3: search() ${inSearch1 ? "found" : "did not find"} entry`);

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
  console.log(`✅ Step 6: list() still ${stillInList ? "shows" : "does not show"} entry`);

  // Step 7: Old keyword search should NOT find it
  const searchOld = await cortex.immutable.search({ query: "UNIQUE_IMM_KEYWORD", type });
  const foundOld = searchOld.some((r) => r.entry.id === id);
  console.log(`✅ Step 7: search("UNIQUE_IMM_KEYWORD") ${foundOld ? "still found (BAD)" : "no longer finds (GOOD)"}`);

  // Step 8: New keyword search should find it
  const searchNew = await cortex.immutable.search({ query: "DIFFERENT_KEYWORD", type });
  const foundNew = searchNew.some((r) => r.entry.id === id);
  console.log(`✅ Step 8: search("DIFFERENT_KEYWORD") ${foundNew ? "found (GOOD)" : "did not find (BAD)"}`);

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
  console.log("  29)   🎯 Run All");
  console.log();

  // Layer 1b
  console.log("  💾 LAYER 1B: IMMUTABLE STORE API");
  console.log("  30) [Category Header]");
  console.log("     Core Operations:");
  console.log("  31)   💾 store (create/update)");
  console.log("  32)   📖 get");
  console.log("  33)   🔢 getVersion");
  console.log("  34)   📜 getHistory");
  console.log("  35)   📋 list");
  console.log("  36)   🔍 search");
  console.log("  37)   🔢 count");
  console.log("  38)   🗑️  purge");
  console.log("     Advanced Tests:");
  console.log("  40)   🔄 Propagation (updates)");
  console.log("  41)   🏋️  Edge (25 versions)");
  console.log("  42)   🔗 Integration");
  console.log("  49)   🎯 Run All");
  console.log();

  // Global
  console.log("  🌐 GLOBAL");
  console.log("  99) 🎯 Run All Tests (Both Layers)");
  console.log("   0) ❌ Exit");
  console.log();
  console.log("═".repeat(80));
  
  if (currentConversationId || currentImmutableType) {
    if (currentConversationId) {
      console.log(`🎯 Conversation: ${currentConversationId}`);
    }
    if (currentImmutableType && currentImmutableId) {
      console.log(`🎯 Immutable Entry: ${currentImmutableType}/${currentImmutableId}`);
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

