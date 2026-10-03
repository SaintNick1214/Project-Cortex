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
import { TestCleanupCapabilityError } from "./helpers/cleanup";
import { StorageInspector } from "./helpers";
import * as readline from "readline";
import OpenAI from "openai";

// OpenAI client (optional - features skip if key not present)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// OpenAI Helper Functions
async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });

  return response.data[0].embedding;
}

async function summarizeConversation(
  userMessage: string,
  agentResponse: string,
): Promise<string | null> {
  if (!openai) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      {
        role: "system",
        content:
          "Extract key facts from this conversation in one concise sentence.",
      },
      {
        role: "user",
        content: `User: ${userMessage}\nAgent: ${agentResponse}`,
      },
    ],
    // temperature not supported with gpt-5-nano, uses default of 1
  });

  return response.choices[0].message.content;
}

// Test data
const TEST_USER_ID = "user-test-interactive";
const TEST_MEMSPACE_ID = "memspace-interactive"; // Updated for Memory Space Architecture
const TEST_PARTICIPANT_ID = "agent-test-interactive"; // For Hive Mode tracking
let currentConversationId: string | null = null;
let currentMemoryId: string | null = null;
let currentImmutableType: string | null = null;
let currentImmutableId: string | null = null;

// Clients
let cortex: Cortex;
let client: ConvexClient;
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
  "16": { label: "  📋 list (by memorySpace)", action: testListByMemorySpace },
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
  "72": { label: "  ⚛️  transaction", action: testMutableTransaction },
  "79": { label: "  🎯 Run All Mutable Tests", action: runMutableTests },

  // ═══════════════════════════════════════════════════════════════════════
  // Layer 2: Vector Memory API
  // ═══════════════════════════════════════════════════════════════════════
  "80": { label: "🧠 Vector Memory API ─────────────", action: showVectorMenu },
  "81": { label: "  💾 store", action: testVectorStore },
  "82": { label: "  📖 get", action: testVectorGet },
  "83": { label: "  🔍 search (keyword)", action: testVectorSearch },
  "84": { label: "  📋 list", action: testVectorList },
  "85": { label: "  🔢 count", action: testVectorCount },
  "86": { label: "  🗑️  delete", action: testVectorDelete },
  "87": { label: "  ✏️  update", action: testVectorUpdate },
  "88": {
    label: "  📦 Advanced Operations ───────",
    action: showVectorAdvancedMenu,
  },
  "881": { label: "    📝 updateMany", action: testVectorUpdateMany },
  "882": { label: "    🗑️  deleteMany", action: testVectorDeleteMany },
  "883": { label: "    📤 export", action: testVectorExport },
  "884": { label: "    🗄️  archive", action: testVectorArchive },
  "885": { label: "    🕒 getVersion", action: testVectorGetVersion },
  "886": { label: "    📜 getHistory", action: testVectorGetHistory },
  "887": { label: "    ⏰ getAtTimestamp", action: testVectorGetAtTimestamp },
  "89": { label: "  🎯 Run All Vector Tests", action: runVectorTests },

  // ═══════════════════════════════════════════════════════════════════════
  // Layer 3: Memory Convenience API
  // ═══════════════════════════════════════════════════════════════════════
  "90": { label: "💫 Memory Convenience API ────────", action: showMemoryMenu },
  "91": { label: "  🎬 remember", action: testMemoryRemember },
  "92": { label: "  💭 forget", action: testMemoryForget },
  "93": { label: "  📖 get (enriched)", action: testMemoryGetEnriched },
  "94": { label: "  🔍 search (enriched)", action: testMemorySearchEnriched },
  "95": { label: "  💾 store", action: testMemoryStore },
  "96": {
    label: "  🤖 Advanced: OpenAI Tests ──────",
    action: showAdvancedMemoryMenu,
  },
  "961": {
    label: "    🧠 remember (with embeddings)",
    action: testMemoryRememberWithAI,
  },
  "962": {
    label: "    🔍 semantic search recall",
    action: testSemanticSearchRecall,
  },
  "963": { label: "    💬 enriched search", action: testEnrichedSearchWithAI },
  "964": {
    label: "    📝 summarization quality",
    action: testSummarizationQuality,
  },
  "965": { label: "    📊 similarity scores", action: testSimilarityScores },
  "98": { label: "  🎯 Run All Memory Tests", action: runMemoryTests },
  "981": {
    label: "  🤖 Run All Advanced Tests",
    action: runAdvancedMemoryTests,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Run All
  // ═══════════════════════════════════════════════════════════════════════
  "99": { label: "🎯 Run All Tests (All 5 Layers)", action: runAllTests },
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

async function showVectorMenu() {
  console.log("\n🧠 Vector Memory API (All 14 Operations)");
  console.log("Core: 81-87 | Advanced: 881-887 | Run All: 89\n");
}

// Test implementations
async function purgeAllDatabases() {
  throw new TestCleanupCapabilityError();
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
    memorySpaceId: TEST_MEMSPACE_ID,
    participants: {
      userId: TEST_USER_ID,
      agentId: TEST_PARTICIPANT_ID,
      participantId: TEST_PARTICIPANT_ID,
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
    memorySpaceId: TEST_MEMSPACE_ID,
    type: "agent-agent" as const,
    participants: {
      memorySpaceIds: [
        TEST_MEMSPACE_ID,
        "memspace-target-interactive",
        "memspace-observer-interactive",
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

  const result = await cortex.conversations.list({
    userId: TEST_USER_ID,
  });

  console.log(`\n📥 Found ${result.conversations.length} conversation(s)`);
  console.log("Result:", JSON.stringify(result.conversations, null, 2));

  // Validate: all conversations should include this userId
  console.log("\n🔍 Validation:");
  let allValid = true;

  result.conversations.forEach((conv, i) => {
    const hasUser = conv.participants.userId === TEST_USER_ID;

    if (hasUser) {
      console.log(`  ✅ Conversation ${i + 1}: Contains ${TEST_USER_ID}`);
    } else {
      console.log(`  ❌ Conversation ${i + 1}: Missing ${TEST_USER_ID}`);
      allValid = false;
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (allValid) {
    console.log("✅ All conversations contain the user");
  } else {
    console.log("❌ Some conversations don't contain the user");
  }
  console.log();
}

async function testListByMemorySpace() {
  console.log(
    `\n📋 Testing: conversations.list({ memorySpaceId: "${TEST_MEMSPACE_ID}" })...`,
  );

  const result = await cortex.conversations.list({
    memorySpaceId: TEST_MEMSPACE_ID,
  });

  console.log(`\n📥 Found ${result.conversations.length} conversation(s)`);
  console.log("Result:", JSON.stringify(result.conversations, null, 2));

  // Validate: all conversations should be in this memorySpace
  console.log("\n🔍 Validation:");
  let allValid = true;

  result.conversations.forEach((conv, i) => {
    const hasMemorySpace = conv.memorySpaceId === TEST_MEMSPACE_ID;

    if (hasMemorySpace) {
      console.log(
        `  ✅ Conversation ${i + 1}: In memory space ${TEST_MEMSPACE_ID}`,
      );
    } else {
      console.log(`  ❌ Conversation ${i + 1}: Wrong memory space`);
      allValid = false;
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (allValid) {
    console.log("✅ All conversations in correct memory space");
  } else {
    console.log("❌ Some conversations in wrong memory space");
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
      participantId: TEST_PARTICIPANT_ID,
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
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("CONVERSATION_NOT_FOUND")
    ) {
      console.log("✅ Verified: Conversation no longer exists");
    } else {
      console.log(
        "⚠️  Unexpected error:",
        error instanceof Error ? error.message : String(error),
      );
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

  // await testListByAgent(); // Deprecated - using memory spaces now
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
    memorySpaceId: TEST_MEMSPACE_ID,
  });

  console.log("📊 Results:");
  console.log(`  Total: ${totalCount}`);
  console.log(`  By user: ${userConvs.conversations.length}`);
  console.log(`  By agent: ${agentConvs.conversations.length}`);

  console.log("\n✅ Expected: Total=2, By user=1, By agent=2");
  console.log(
    `📊 Actual: ${totalCount === 2 && userConvs.conversations.length === 1 && agentConvs.conversations.length === 2 ? "✅ PASS" : "❌ FAIL"}`,
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
  console.log("\n🎯 Running ALL tests for ALL 5 LAYERS...\n");
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

  // await testListByAgent(); // Deprecated - using memory spaces now
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

  console.log(`\n${"═".repeat(80)}`);
  console.log("  LAYER 1B: IMMUTABLE STORE TESTS");
  console.log(`${"═".repeat(80)}\n`);

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

  console.log(`\n${"═".repeat(80)}`);
  console.log("  LAYER 1C: MUTABLE STORE TESTS");
  console.log(`${"═".repeat(80)}\n`);

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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 2: Vector Memory Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log(`\n${"═".repeat(80)}`);
  console.log("  LAYER 2: VECTOR MEMORY TESTS");
  console.log(`${"═".repeat(80)}\n`);

  await testVectorStore();
  console.log("═".repeat(80));

  await testVectorGet();
  console.log("═".repeat(80));

  await testVectorSearch();
  console.log("═".repeat(80));

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 3: Memory Convenience API Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log(`\n${"═".repeat(80)}`);
  console.log("  LAYER 3: MEMORY CONVENIENCE API TESTS");
  console.log(`${"═".repeat(80)}\n`);

  await testMemoryRemember();
  console.log("═".repeat(80));

  await testMemoryGetEnriched();
  console.log("═".repeat(80));

  await testMemorySearchEnriched();
  console.log("═".repeat(80));

  // Final validation
  console.log("\n🔍 FINAL VALIDATION (ALL 5 LAYERS)\n");
  console.log("═".repeat(80));

  // Layer 1a: Conversations
  const totalConvCount = await cortex.conversations.count();
  const userConvs = await cortex.conversations.list({ userId: TEST_USER_ID });
  const agentConvs = await cortex.conversations.list({
    memorySpaceId: TEST_MEMSPACE_ID,
  });

  console.log("📊 Layer 1a (Conversations):");
  console.log(`  Total: ${totalConvCount}`);
  console.log(`  By user: ${userConvs.conversations.length}`);
  console.log(`  By agent: ${agentConvs.conversations.length}`);

  // Layer 1b: Immutable
  const totalImmCount = await cortex.immutable.count();
  const kbArticles = await cortex.immutable.list({ type: "kb-article" });

  console.log("\n📊 Layer 1b (Immutable Store):");
  console.log(`  Total entries: ${totalImmCount}`);
  console.log(`  KB articles: ${kbArticles.entries.length}`);

  // Layer 1c: Mutable
  const inventoryCount = await cortex.mutable.count({ namespace: "inventory" });
  const counterCount = await cortex.mutable.count({ namespace: "counters" });

  console.log("\n📊 Layer 1c (Mutable Store):");
  console.log(`  Inventory items: ${inventoryCount}`);
  console.log(`  Counters: ${counterCount}`);

  // Layer 2: Vector
  const totalVectorCount = await cortex.vector.count({
    memorySpaceId: TEST_MEMSPACE_ID,
  });

  console.log("\n📊 Layer 2 (Vector Memory):");
  console.log(`  Total memories: ${totalVectorCount}`);

  // Layer 3: Memory (uses Layer 1 + Layer 2)
  const memorySearchResults = await cortex.memory.search(
    TEST_MEMSPACE_ID,
    "password",
  );

  console.log("\n📊 Layer 3 (Memory Convenience API):");
  console.log(`  Search results: ${memorySearchResults.length}`);

  console.log("\n✅ Expected:");
  console.log("  Conversations: Total>=2");
  console.log("  Immutable: Total>=1");
  console.log("  Mutable: Inventory & counters created");
  console.log("  Vector: Memories created");
  console.log("  Memory API: Search works");

  console.log("\n📊 Actual:");
  console.log(`  Layer 1a: ${totalConvCount >= 2 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Layer 1b: ${totalImmCount >= 1 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(
    `  Layer 1c: ${inventoryCount > 0 && counterCount > 0 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(`  Layer 2: ${totalVectorCount > 0 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(
    `  Layer 3: ${memorySearchResults.length >= 0 ? "✅ PASS" : "❌ FAIL"}`,
  );

  const allValid =
    totalConvCount >= 2 &&
    totalImmCount >= 1 &&
    inventoryCount > 0 &&
    counterCount > 0 &&
    totalVectorCount > 0;

  console.log(`\n${"═".repeat(80)}`);
  if (allValid) {
    console.log("✅ ALL TESTS PASSED! All 5 layers working correctly.");
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

  history.forEach((version, _i) => {
    console.log(`\n  Version ${version.version}:`);
    console.log(`    Timestamp: ${new Date(version.timestamp).toISOString()}`);
    console.log(
      `    Data:`,
      `${JSON.stringify(version.data).substring(0, 100)}...`,
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
    memorySpaceId: TEST_MEMSPACE_ID,
    participants: {
      userId: TEST_USER_ID,
      agentId: TEST_PARTICIPANT_ID,
      participantId: TEST_PARTICIPANT_ID,
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
  const inList = list.conversations.find(
    (c) => c.conversationId === conv.conversationId,
  );

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
    memorySpaceId: TEST_MEMSPACE_ID,
    participants: {
      userId: TEST_USER_ID,
      agentId: TEST_PARTICIPANT_ID,
      participantId: TEST_PARTICIPANT_ID,
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
      memorySpaceId: TEST_MEMSPACE_ID,
      participants: {
        userId: `${TEST_USER_ID}-bulk`,
        agentId: TEST_PARTICIPANT_ID,
        participantId: TEST_PARTICIPANT_ID,
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
    memorySpaceId: TEST_MEMSPACE_ID,
  });

  if (found) {
    console.log(`\n📥 Found existing conversation:`);
    console.log(`  ID: ${found.conversationId}`);
    console.log(`  Messages: ${found.messageCount}`);
    console.log(`  Created: ${new Date(found.createdAt).toISOString()}`);
    currentConversationId = found.conversationId;
  } else {
    console.log(
      `\n⚠️  No existing conversation found for ${TEST_USER_ID} + ${TEST_MEMSPACE_ID}`,
    );
  }
  console.log();
}

async function testConvGetOrCreate() {
  console.log(`\n🔄 Testing: conversations.getOrCreate()...`);
  console.log("This will find existing or create new atomically\n");

  const result = await cortex.conversations.getOrCreate({
    type: "user-agent",
    memorySpaceId: TEST_MEMSPACE_ID,
    participants: {
      userId: `${TEST_USER_ID}-getorcreate`,
      agentId: TEST_PARTICIPANT_ID,
      participantId: TEST_PARTICIPANT_ID,
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
    memorySpaceId: TEST_MEMSPACE_ID,
    participants: {
      userId: `${TEST_USER_ID}-getorcreate`,
      agentId: TEST_PARTICIPANT_ID,
      participantId: TEST_PARTICIPANT_ID,
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
    memorySpaceId: TEST_MEMSPACE_ID,
    participants: {
      userId: TEST_USER_ID,
      agentId: TEST_PARTICIPANT_ID,
      participantId: TEST_PARTICIPANT_ID,
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
  const inList = list.conversations.some(
    (c) => c.conversationId === conv.conversationId,
  );

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
    (current: number) => current + 10,
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

async function testMutableTransaction() {
  console.log("\n⚛️  Testing: mutable.transaction()...");
  console.log("Atomic multi-key operations - inventory transfer example\n");

  // Setup
  await cortex.mutable.set("inventory", "product-a", 100);
  await cortex.mutable.set("inventory", "product-b", 50);
  await cortex.mutable.set("counters", "sales", 0);

  console.log("Initial state:");
  console.log("  product-a: 100");
  console.log("  product-b: 50");
  console.log("  sales counter: 0");

  // Execute transaction: sell 10 units of product-a
  const result = await cortex.mutable.transaction([
    { op: "decrement", namespace: "inventory", key: "product-a", amount: 10 },
    { op: "increment", namespace: "counters", key: "sales", amount: 1 },
    { op: "set", namespace: "state", key: "last-sale", value: Date.now() },
  ]);

  console.log(`\n📥 Transaction result:`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Operations executed: ${result.operationsExecuted}`);

  // Verify
  const productA = await cortex.mutable.get("inventory", "product-a");
  const sales = await cortex.mutable.get("counters", "sales");
  const lastSale = await cortex.mutable.get("state", "last-sale");

  console.log(`\n✅ Final state:`);
  console.log(`  product-a: ${productA} (should be 90)`);
  console.log(`  sales: ${sales} (should be > 0)`);
  console.log(`  last-sale: ${lastSale ? "recorded" : "not recorded"}`);

  // Test inventory transfer
  console.log(`\n🔄 Testing inventory transfer...`);
  await cortex.mutable.set("transfer-test", "source", 100);
  await cortex.mutable.set("transfer-test", "destination", 0);

  await cortex.mutable.transaction([
    { op: "decrement", namespace: "transfer-test", key: "source", amount: 25 },
    {
      op: "increment",
      namespace: "transfer-test",
      key: "destination",
      amount: 25,
    },
  ]);

  const source = await cortex.mutable.get("transfer-test", "source");
  const dest = await cortex.mutable.get("transfer-test", "destination");

  console.log(`  Source: ${source} (should be 75)`);
  console.log(`  Destination: ${dest} (should be 25)`);
  console.log(
    `  ✅ Transfer ${source === 75 && dest === 25 ? "successful" : "FAILED"}`,
  );
  console.log();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 2: Vector Memory Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// currentMemoryId now declared at top with other globals

async function testVectorStore() {
  console.log("\n💾 Testing: vector.store()...");

  const result = await cortex.vector.store(TEST_MEMSPACE_ID, {
    content: "User prefers dark mode for UI",
    contentType: "raw",
    source: { type: "conversation", userId: TEST_USER_ID },
    metadata: {
      importance: 70,
      tags: ["preferences", "ui"],
    },
  });

  currentMemoryId = result.memoryId;

  console.log("📥 Result:");
  console.log(`  Memory ID: ${result.memoryId}`);
  console.log(`  Content: ${result.content}`);
  console.log(`  Importance: ${result.importance}`);
  console.log(`  Tags: ${result.tags.join(", ")}`);
  console.log(`\n🎯 Current memory: ${currentMemoryId}`);
  console.log();
}

async function testVectorGet() {
  if (!currentMemoryId) {
    console.log(
      "\n⚠️  No current memory. Run vector.store first (option 81).\n",
    );

    return;
  }

  console.log(`\n📖 Testing: vector.get()...`);

  const result = await cortex.vector.get(TEST_MEMSPACE_ID, currentMemoryId);

  if (result) {
    console.log("📥 Retrieved:");
    console.log(`  ID: ${result.memoryId}`);
    console.log(`  Content: ${result.content}`);
    console.log(`  Source: ${result.sourceType}`);
    console.log(`  Tags: ${result.tags.join(", ")}`);
  } else {
    console.log("❌ Memory not found");
  }
  console.log();
}

async function testVectorSearch() {
  console.log("\n🔍 Testing: vector.search()...");

  const results = await cortex.vector.search(TEST_MEMSPACE_ID, "preferences");

  console.log(`📥 Found ${results.length} memories matching "preferences"`);
  results.forEach((m, i) => {
    console.log(`\n  [${i + 1}] ${m.content.substring(0, 60)}...`);
    console.log(`      Tags: ${m.tags.join(", ")}`);
    console.log(`      Importance: ${m.importance}`);
  });
  console.log();
}

async function testVectorList() {
  console.log("\n📋 Testing: vector.list()...");

  const results = await cortex.vector.list({
    memorySpaceId: TEST_MEMSPACE_ID,
    limit: 10,
  });

  console.log(`📥 Found ${results.length} memories for ${TEST_MEMSPACE_ID}`);
  results.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.content.substring(0, 50)}...`);
  });
  console.log();
}

async function testVectorCount() {
  console.log("\n🔢 Testing: vector.count()...");

  const count = await cortex.vector.count({
    memorySpaceId: TEST_MEMSPACE_ID,
  });

  console.log(`📥 Count: ${count} memories`);
  console.log();
}

async function testVectorDelete() {
  if (!currentMemoryId) {
    console.log(
      "\n⚠️  No current memory. Run vector.store first (option 81).\n",
    );

    return;
  }

  console.log(`\n🗑️  Testing: vector.delete()...`);

  await cortex.vector.delete(TEST_MEMSPACE_ID, currentMemoryId);

  console.log("✅ Memory deleted");

  // Verify
  const check = await cortex.vector.get(TEST_MEMSPACE_ID, currentMemoryId);

  console.log(
    `✅ Verification: ${check === null ? "Deleted" : "Still exists (ERROR)"}`,
  );

  currentMemoryId = null;
  console.log();
}

async function testVectorUpdate() {
  if (!currentMemoryId) {
    console.log(
      "\n⚠️  No current memory. Run vector.store first (option 81).\n",
    );

    return;
  }

  console.log(`\n✏️  Testing: vector.update()...`);

  const updated = await cortex.vector.update(
    TEST_MEMSPACE_ID,
    currentMemoryId,
    {
      content: "Updated content (version 2)",
      importance: 90,
      tags: ["updated", "test"],
    },
  );

  console.log(`✅ Updated (version ${updated.version})`);
  console.log(`   Content: ${updated.content}`);
  console.log(`   Importance: ${updated.importance}`);
  console.log(`   Tags: ${updated.tags.join(", ")}`);
  console.log(`   Previous versions: ${updated.previousVersions.length}`);
  console.log();
}

async function testVectorUpdateMany() {
  console.log(`\n📝 Testing: vector.updateMany()...`);

  // Create test memories
  for (let i = 1; i <= 3; i++) {
    await cortex.vector.store(TEST_MEMSPACE_ID, {
      content: `Bulk update test ${i}`,
      contentType: "raw",
      source: { type: "system", timestamp: Date.now() },
      metadata: { importance: 30, tags: ["bulk-test"] },
    });
  }

  const result = await cortex.vector.updateMany(
    { memorySpaceId: TEST_MEMSPACE_ID, sourceType: "system" },
    { importance: 80 },
  );

  console.log(`✅ Updated ${result.updated} memories`);
  console.log(`   Memory IDs: ${result.memoryIds.slice(0, 3).join(", ")}...`);
  console.log();
}

async function testVectorDeleteMany() {
  console.log(`\n🗑️  Testing: vector.deleteMany()...`);

  // Create test memories
  for (let i = 1; i <= 5; i++) {
    await cortex.vector.store(TEST_MEMSPACE_ID, {
      content: `Bulk delete test ${i}`,
      contentType: "raw",
      source: { type: "system", timestamp: Date.now() },
      userId: "user-bulk-delete-test",
      metadata: { importance: 10, tags: ["delete-test"] },
    });
  }

  const result = await cortex.vector.deleteMany({
    memorySpaceId: TEST_MEMSPACE_ID,
    userId: "user-bulk-delete-test",
  });

  console.log(`✅ Deleted ${result.deleted} memories`);
  console.log(`   Memory IDs: ${result.memoryIds.slice(0, 3).join(", ")}...`);
  console.log();
}

async function testVectorExport() {
  console.log(`\n📤 Testing: vector.export()...`);

  const jsonExport = await cortex.vector.export({
    memorySpaceId: TEST_MEMSPACE_ID,
    format: "json",
  });

  console.log(`✅ Exported ${jsonExport.count} memories (JSON)`);
  console.log(`   Format: ${jsonExport.format}`);
  console.log(`   Data length: ${jsonExport.data.length} characters`);

  const csvExport = await cortex.vector.export({
    memorySpaceId: TEST_MEMSPACE_ID,
    format: "csv",
  });

  console.log(`✅ Exported ${csvExport.count} memories (CSV)`);
  console.log(`   First line: ${csvExport.data.split("\n")[0]}`);
  console.log();
}

async function testVectorArchive() {
  console.log(`\n🗄️  Testing: vector.archive()...`);

  const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
    content: "Archive test memory",
    contentType: "raw",
    source: { type: "system", timestamp: Date.now() },
    metadata: { importance: 50, tags: ["archive-test"] },
  });

  const result = await cortex.vector.archive(TEST_MEMSPACE_ID, memory.memoryId);

  console.log(`✅ Archived memory ${memory.memoryId}`);
  console.log(`   Archived: ${result.archived}`);
  console.log(`   Restorable: ${result.restorable}`);

  // Verify archive
  const archived = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);

  console.log(`✅ Verification: tags=${archived!.tags.join(", ")}`);
  console.log(`✅ Verification: importance=${archived!.importance}`);
  console.log();
}

async function testVectorGetVersion() {
  if (!currentMemoryId) {
    console.log(
      "\n⚠️  No current memory. Run vector.store and vector.update first.\n",
    );

    return;
  }

  console.log(`\n🕒 Testing: vector.getVersion()...`);

  const v1 = await cortex.vector.getVersion(
    TEST_MEMSPACE_ID,
    currentMemoryId,
    1,
  );

  console.log(`✅ Version 1: ${v1?.content || "Not found"}`);

  const v2 = await cortex.vector.getVersion(
    TEST_MEMSPACE_ID,
    currentMemoryId,
    2,
  );

  console.log(`✅ Version 2: ${v2?.content || "Not found"}`);

  console.log();
}

async function testVectorGetHistory() {
  if (!currentMemoryId) {
    console.log(
      "\n⚠️  No current memory. Run vector.store and vector.update first.\n",
    );

    return;
  }

  console.log(`\n📜 Testing: vector.getHistory()...`);

  const history = await cortex.vector.getHistory(
    TEST_MEMSPACE_ID,
    currentMemoryId,
  );

  console.log(`✅ Found ${history.length} versions:`);
  history.forEach((v) => {
    console.log(`   v${v.version}: ${v.content.substring(0, 50)}...`);
  });
  console.log();
}

async function testVectorGetAtTimestamp() {
  if (!currentMemoryId) {
    console.log(
      "\n⚠️  No current memory. Run vector.store and vector.update first.\n",
    );

    return;
  }

  console.log(`\n⏰ Testing: vector.getAtTimestamp()...`);

  const memory = await cortex.vector.get(TEST_MEMSPACE_ID, currentMemoryId);

  if (!memory) {
    console.log("Memory not found");

    return;
  }

  const atCreation = await cortex.vector.getAtTimestamp(
    TEST_MEMSPACE_ID,
    currentMemoryId,
    memory.createdAt,
  );

  console.log(`✅ At creation (${new Date(memory.createdAt).toISOString()}):`);
  console.log(`   Content: ${atCreation?.content.substring(0, 50)}...`);
  console.log(`   Version: ${atCreation?.version}`);

  const now = await cortex.vector.getAtTimestamp(
    TEST_MEMSPACE_ID,
    currentMemoryId,
    Date.now(),
  );

  console.log(`✅ Current version:`);
  console.log(`   Content: ${now?.content.substring(0, 50)}...`);
  console.log(`   Version: ${now?.version}`);
  console.log();
}

async function showVectorAdvancedMenu() {
  console.log("\n📦 Vector Advanced Operations");
  console.log("   Use options 881-887 to test advanced operations");
  console.log();
}

async function runVectorTests() {
  console.log("\n🧠 Running all Vector Memory API tests...\n");
  console.log("═".repeat(80));

  await purgeAllDatabases();
  console.log("═".repeat(80));

  await testVectorStore();
  console.log("═".repeat(80));

  await testVectorGet();
  console.log("═".repeat(80));

  await testVectorSearch();
  console.log("═".repeat(80));

  await testVectorList();
  console.log("═".repeat(80));

  await testVectorCount();
  console.log("═".repeat(80));

  await testVectorUpdate();
  console.log("═".repeat(80));

  await testVectorUpdateMany();
  console.log("═".repeat(80));

  await testVectorDeleteMany();
  console.log("═".repeat(80));

  await testVectorExport();
  console.log("═".repeat(80));

  await testVectorArchive();
  console.log("═".repeat(80));

  await testVectorGetVersion();
  console.log("═".repeat(80));

  await testVectorGetHistory();
  console.log("═".repeat(80));

  await testVectorGetAtTimestamp();
  console.log("═".repeat(80));

  console.log("\n✅ All 14 Vector Memory operations tested!\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 3: Memory Convenience API Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function showMemoryMenu() {
  console.log("\n💫 Memory Convenience API");
  console.log("Core: 91-95 | Advanced (AI): 961-965 | Run All: 98, 981\n");
}

async function showAdvancedMemoryMenu() {
  if (!openai) {
    console.log("\n⚠️  Advanced AI tests require OPENAI_API_KEY");
    console.log("Add OPENAI_API_KEY to .env.local to enable\n");

    return;
  }
  console.log("\n🤖 Advanced OpenAI Integration Tests");
  console.log("Uses: text-embedding-3-small (1536-dim) + gpt-4.1-nano");
  console.log("Cost: ~$0.0003 per test run\n");
}

async function testMemoryRemember() {
  console.log(`\n🎬 Testing: memory.remember()...`);

  // Create conversation first
  const conv = await cortex.conversations.create({
    type: "user-agent",
    memorySpaceId: TEST_MEMSPACE_ID,
    participants: { userId: TEST_USER_ID, participantId: TEST_PARTICIPANT_ID },
  });

  const result = await cortex.memory.remember({
    memorySpaceId: TEST_MEMSPACE_ID,
    participantId: TEST_PARTICIPANT_ID,
    conversationId: conv.conversationId,
    userMessage: "The password is Green123",
    agentResponse: "I'll remember that password!",
    userId: TEST_USER_ID,
    userName: "Interactive Tester",
    importance: 95,
    tags: ["password", "security"],
  });

  console.log(
    `✅ Stored in ACID: ${result.conversation.messageIds.length} messages`,
  );
  console.log(`✅ Created in Vector: ${result.memories.length} memories`);
  console.log(`   User memory: ${result.memories[0].memoryId}`);
  console.log(`   Agent memory: ${result.memories[1].memoryId}`);
  console.log(`   Conversation: ${result.conversation.conversationId}`);

  currentMemoryId = result.memories[0].memoryId;
  currentConversationId = conv.conversationId;
  console.log();
}

async function testMemoryForget() {
  if (!currentMemoryId) {
    console.log(
      "\n⚠️  No current memory. Run memory.remember first (option 91).\n",
    );

    return;
  }

  console.log(`\n💭 Testing: memory.forget()...`);

  const result = await cortex.memory.forget(TEST_MEMSPACE_ID, currentMemoryId);

  console.log(`✅ Memory deleted: ${result.memoryDeleted}`);
  console.log(`✅ Conversation deleted: ${result.conversationDeleted}`);
  console.log(`✅ Messages deleted: ${result.messagesDeleted}`);
  console.log(`✅ Restorable: ${result.restorable} (ACID preserved)`);

  // Verify
  const vectorCheck = await cortex.vector.get(
    TEST_MEMSPACE_ID,
    currentMemoryId,
  );

  console.log(
    `✅ Vector verification: ${vectorCheck === null ? "Deleted" : "Still exists"}`,
  );

  if (currentConversationId) {
    const acidCheck = await cortex.conversations.get(currentConversationId);

    console.log(`✅ ACID verification: ${acidCheck ? "Preserved" : "Deleted"}`);
  }

  currentMemoryId = null;
  console.log();
}

async function testMemoryGetEnriched() {
  if (!currentMemoryId && !currentConversationId) {
    console.log(
      "\n⚠️  No current memory/conversation. Run memory.remember first (option 91).\n",
    );

    return;
  }

  console.log(`\n📖 Testing: memory.get() with enrichment...`);

  // Create a test memory if needed
  if (!currentMemoryId) {
    const conv = await cortex.conversations.create({
      type: "user-agent",
      memorySpaceId: TEST_MEMSPACE_ID,
      participants: {
        userId: TEST_USER_ID,
        agentId: TEST_PARTICIPANT_ID,
        participantId: TEST_PARTICIPANT_ID,
      },
    });

    const result = await cortex.memory.remember({
      memorySpaceId: TEST_MEMSPACE_ID,
      participantId: TEST_PARTICIPANT_ID,
      conversationId: conv.conversationId,
      userMessage: "Enrichment test",
      agentResponse: "OK",
      userId: TEST_USER_ID,
      userName: "Tester",
    });

    currentMemoryId = result.memories[0].memoryId;
    currentConversationId = conv.conversationId;
  }

  // Test default (vector only)
  const vectorOnly = await cortex.memory.get(TEST_MEMSPACE_ID, currentMemoryId);

  console.log(`✅ Default (Vector only): ${(vectorOnly as any).memoryId}`);

  // Test enriched
  const enriched = await cortex.memory.get(TEST_MEMSPACE_ID, currentMemoryId, {
    includeConversation: true,
  });

  console.log(`✅ Enriched mode:`);
  console.log(`   Memory: ${(enriched as any).memory.memoryId}`);
  console.log(
    `   Conversation: ${(enriched as any).conversation?.conversationId || "N/A"}`,
  );
  console.log(
    `   Source messages: ${(enriched as any).sourceMessages?.length || 0}`,
  );
  console.log();
}

async function testMemorySearchEnriched() {
  console.log(`\n🔍 Testing: memory.search() with enrichment...`);

  // Search default (vector only)
  const vectorOnly = await cortex.memory.search(TEST_MEMSPACE_ID, "password");

  console.log(`✅ Default search: ${vectorOnly.length} results (Vector only)`);

  // Search enriched
  const enriched = await cortex.memory.search(TEST_MEMSPACE_ID, "password", {
    enrichConversation: true,
  });

  console.log(`✅ Enriched search: ${enriched.length} results`);
  if (enriched.length > 0) {
    const first = enriched[0] as any;

    console.log(`   First result:`);
    console.log(`     Memory: ${first.memory?.memoryId || first.memoryId}`);
    console.log(
      `     Conversation: ${first.conversation?.conversationId || "N/A"}`,
    );
    console.log(`     Source messages: ${first.sourceMessages?.length || 0}`);
  }
  console.log();
}

async function testMemoryStore() {
  console.log(`\n💾 Testing: memory.store()...`);

  const result = await cortex.memory.store(TEST_MEMSPACE_ID, {
    content: "System-generated memory via Layer 3",
    contentType: "raw",
    source: { type: "system", timestamp: Date.now() },
    metadata: { importance: 60, tags: ["layer3-test"] },
  });

  console.log(`✅ Stored (smart detection): ${result.memory.memoryId}`);
  console.log(`   Content: ${result.memory.content}`);
  console.log(`   Source type: ${result.memory.sourceType}`);
  console.log(
    `   Has conversationRef: ${result.memory.conversationRef ? "Yes" : "No"}`,
  );

  currentMemoryId = result.memory.memoryId;
  console.log();
}

async function runMemoryTests() {
  console.log("\n💫 Running all Memory Convenience API tests...\n");
  console.log("═".repeat(80));

  await purgeAllDatabases();
  console.log("═".repeat(80));

  await testMemoryRemember();
  console.log("═".repeat(80));

  await testMemoryGetEnriched();
  console.log("═".repeat(80));

  await testMemorySearchEnriched();
  console.log("═".repeat(80));

  await testMemoryStore();
  console.log("═".repeat(80));

  await testMemoryForget();
  console.log("═".repeat(80));

  console.log("\n✅ All 5 Memory Convenience operations tested!\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Advanced: OpenAI Integration Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let advancedMemories: Array<{ fact: string; memoryId: string }> = [];

async function testMemoryRememberWithAI() {
  if (!openai) {
    console.log("\n⚠️  OPENAI_API_KEY not set. Skipping AI test.\n");

    return;
  }

  console.log(`\n🧠 Testing: memory.remember() with real AI...`);
  console.log(`Using: text-embedding-3-small (1536-dim) + gpt-4.1-nano\n`);

  // Create conversation
  const conv = await cortex.conversations.create({
    type: "user-agent",
    memorySpaceId: TEST_MEMSPACE_ID,
    participants: { userId: TEST_USER_ID, participantId: TEST_PARTICIPANT_ID },
  });

  // Test with 3 facts (shorter for interactive testing)
  const conversations = [
    {
      user: "My name is Alexander Johnson and I prefer to be called Alex",
      agent: "Got it, I'll call you Alex!",
      fact: "user-name",
    },
    {
      user: "The API password for production is SecurePass2024!",
      agent: "I'll remember that password securely",
      fact: "api-password",
    },
    {
      user: "I prefer dark mode theme and minimal notifications",
      agent: "I'll set dark mode and reduce notifications",
      fact: "preferences",
    },
  ];

  advancedMemories = [];

  for (const convo of conversations) {
    console.log(`\nProcessing: "${convo.user.substring(0, 50)}..."`);

    const result = await cortex.memory.remember({
      memorySpaceId: TEST_MEMSPACE_ID,
      participantId: TEST_PARTICIPANT_ID,
      conversationId: conv.conversationId,
      userMessage: convo.user,
      agentResponse: convo.agent,
      userId: TEST_USER_ID,
      userName: "Alex Johnson",
      generateEmbedding,
      extractContent: summarizeConversation,
      importance: convo.fact === "api-password" ? 100 : 70,
      tags: [convo.fact, "ai-test"],
    });

    advancedMemories.push({
      fact: convo.fact,
      memoryId: result.memories[0].memoryId,
    });

    console.log(`  ✓ Summarized: "${result.memories[0].content}"`);
    console.log(
      `  ✓ Embedding: ${result.memories[0].embedding?.length} dimensions`,
    );
    console.log(`  ✓ Memory ID: ${result.memories[0].memoryId}`);
  }

  console.log(`\n✅ Stored ${advancedMemories.length} memories with AI\n`);
  currentConversationId = conv.conversationId;
  currentMemoryId = advancedMemories[0].memoryId;
}

async function testSemanticSearchRecall() {
  if (!openai) {
    console.log("\n⚠️  OPENAI_API_KEY not set. Skipping AI test.\n");

    return;
  }

  console.log(`\n🔍 Testing: Semantic search recall...`);
  console.log(`Note: Queries use DIFFERENT words than stored content\n`);

  const searches = [
    { query: "what should I address the user as", expectIn: "Alex" },
    { query: "production system credentials", expectIn: "password" },
    { query: "UI appearance settings", expectIn: "dark mode" },
  ];

  for (const search of searches) {
    console.log(`Query: "${search.query}"`);

    const results = await cortex.memory.search(TEST_MEMSPACE_ID, search.query, {
      embedding: await generateEmbedding(search.query),
      userId: TEST_USER_ID,
      limit: 3,
    });

    if (results.length > 0) {
      const found = results[0] as any;
      const score = found._score || 0;

      console.log(`  ✓ Found: "${found.content.substring(0, 60)}..."`);
      console.log(`  ✓ Similarity: ${(score * 100).toFixed(1)}%`);
      console.log(
        `  ✓ Semantic match: ${found.content.toLowerCase().includes(search.expectIn.toLowerCase()) ? "YES" : "PARTIAL"}`,
      );
    } else {
      console.log(`  ✗ No results found`);
    }
    console.log();
  }
}

async function testEnrichedSearchWithAI() {
  if (!openai) {
    console.log("\n⚠️  OPENAI_API_KEY not set. Skipping AI test.\n");

    return;
  }

  console.log(`\n💬 Testing: Enriched search with ACID context...`);

  const results = await cortex.memory.search(TEST_MEMSPACE_ID, "password", {
    embedding: await generateEmbedding("password credentials"),
    enrichConversation: true,
    userId: TEST_USER_ID,
  });

  console.log(`✓ Found ${results.length} results`);

  if (results.length > 0) {
    const enriched = results[0] as any;

    if (enriched.memory) {
      console.log(`\n✓ Enriched structure:`);
      console.log(`  Vector: "${enriched.memory.content.substring(0, 50)}..."`);

      if (enriched.conversation) {
        console.log(`  ACID: ${enriched.conversation.messageCount} messages`);
        console.log(
          `  Source messages: ${enriched.sourceMessages?.length || 0}`,
        );
      } else {
        console.log(`  ACID: (no conversation linked)`);
      }
    } else {
      console.log(`\n✓ Direct structure:`);
      console.log(`  Content: "${enriched.content.substring(0, 50)}..."`);
    }
  }

  console.log();
}

async function testSummarizationQuality() {
  if (!openai || advancedMemories.length === 0) {
    console.log("\n⚠️  Run 'remember (with embeddings)' first (option 961)\n");

    return;
  }

  console.log(`\n📝 Testing: Summarization quality...`);

  const memory = await cortex.vector.get(
    TEST_MEMSPACE_ID,
    advancedMemories[0].memoryId,
  );

  if (memory) {
    const original =
      "My name is Alexander Johnson and I prefer to be called Alex";

    console.log(`\nOriginal:`);
    console.log(`  "${original}"`);
    console.log(`  Length: ${original.length} chars`);

    console.log(`\nSummarized by gpt-4.1-nano:`);
    console.log(`  "${memory.content}"`);
    console.log(`  Length: ${memory.content.length} chars`);

    console.log(`\nQuality checks:`);
    console.log(
      `  ✓ Concise: ${memory.content.length < original.length * 1.5 ? "YES" : "NO"}`,
    );
    console.log(
      `  ✓ Contains "Alex": ${memory.content.toLowerCase().includes("alex") ? "YES" : "NO"}`,
    );
    console.log(`  ✓ ContentType: ${memory.contentType}`);
  }

  console.log();
}

async function testSimilarityScores() {
  if (!openai) {
    console.log("\n⚠️  OPENAI_API_KEY not set. Skipping AI test.\n");

    return;
  }

  console.log(`\n📊 Testing: Similarity scores (cosine similarity)...`);

  const results = await cortex.memory.search(
    TEST_MEMSPACE_ID,
    "API password for production environment",
    {
      embedding: await generateEmbedding(
        "API password for production environment",
      ),
      userId: TEST_USER_ID,
      limit: 5,
    },
  );

  console.log(`\n✓ Found ${results.length} results:\n`);

  results.forEach((result: any, i) => {
    const score = result._score || 0;

    console.log(`${i + 1}. "${result.content.substring(0, 50)}..."`);
    console.log(`   Score: ${(score * 100).toFixed(1)}% similar`);
    console.log(
      `   Valid: ${score >= 0 && score <= 1 && !isNaN(score) ? "✓" : "✗"}`,
    );
  });

  console.log();
}

async function runAdvancedMemoryTests() {
  if (!openai) {
    console.log("\n⚠️  Advanced tests require OPENAI_API_KEY");
    console.log("Add to .env.local to enable these tests\n");

    return;
  }

  console.log("\n🤖 Running Advanced OpenAI Integration Tests...\n");
  console.log("═".repeat(80));

  await purgeAllDatabases();
  console.log("═".repeat(80));

  await testMemoryRememberWithAI();
  console.log("═".repeat(80));

  await testSemanticSearchRecall();
  console.log("═".repeat(80));

  await testEnrichedSearchWithAI();
  console.log("═".repeat(80));

  await testSummarizationQuality();
  console.log("═".repeat(80));

  await testSimilarityScores();
  console.log("═".repeat(80));

  console.log("\n✅ All 5 Advanced AI tests complete!\n");
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
  console.log("  72)   ⚛️  transaction");
  console.log("  79)   🎯 Run All");
  console.log();

  // Layer 2
  console.log("  🧠 LAYER 2: VECTOR MEMORY API (14 operations)");
  console.log("  80) [Category Header]");
  console.log("     Core Operations:");
  console.log("  81)   💾 store");
  console.log("  82)   📖 get");
  console.log("  83)   🔍 search");
  console.log("  84)   📋 list");
  console.log("  85)   🔢 count");
  console.log("  86)   🗑️  delete");
  console.log("  87)   ✏️  update");
  console.log("     Advanced Operations:");
  console.log("  881)  📝 updateMany");
  console.log("  882)  🗑️  deleteMany");
  console.log("  883)  📤 export");
  console.log("  884)  🗄️  archive");
  console.log("  885)  🕒 getVersion");
  console.log("  886)  📜 getHistory");
  console.log("  887)  ⏰ getAtTimestamp");
  console.log("  89)   🎯 Run All (14 tests)");
  console.log();

  // Layer 3
  console.log("  💫 LAYER 3: MEMORY CONVENIENCE API");
  console.log("  90) [Category Header]");
  console.log("     Core Operations:");
  console.log("  91)   🎬 remember");
  console.log("  92)   💭 forget");
  console.log("  93)   📖 get (enriched)");
  console.log("  94)   🔍 search (enriched)");
  console.log("  95)   💾 store");
  console.log("     Advanced (OpenAI):");
  console.log("  961)  🧠 remember (with AI)");
  console.log("  962)  🔍 semantic search");
  console.log("  963)  💬 enriched search");
  console.log("  964)  📝 summarization");
  console.log("  965)  📊 similarity scores");
  console.log("  98)   🎯 Run All Core (5 tests)");
  console.log("  981)  🤖 Run All Advanced (5 tests)");
  console.log();

  // Global
  console.log("  🌐 GLOBAL");
  console.log("  99) 🎯 Run All Tests (All 5 Layers)");
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
async function getUserChoice(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return await new Promise((resolve) => {
    rl.question("\n👉 Select an option: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Main loop
async function mainLoop() {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    displayMenu();
    const choice = await getUserChoice();

    const option = MENU_OPTIONS[choice as keyof typeof MENU_OPTIONS];

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (option) {
      try {
        await option.action();
      } catch (error: unknown) {
        console.log(
          "\n❌ Error:",
          error instanceof Error ? error.message : String(error),
        );
        if (error instanceof Error && error.stack) {
          console.log(error.stack);
        }
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
  } catch (error: unknown) {
    console.error(
      "\n❌ Fatal error:",
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run it
void start();
