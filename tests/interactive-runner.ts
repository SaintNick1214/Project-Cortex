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
  "1": { label: "🧹 Purge Database (conversations)", action: purgeDatabase },
  "2": { label: "📊 Inspect Database State", action: inspectDatabase },
  "3": { label: "➕ Test: conversations.create (user-agent)", action: testCreateUserAgent },
  "4": { label: "➕ Test: conversations.create (agent-agent)", action: testCreateAgentAgent },
  "5": { label: "📖 Test: conversations.get", action: testGet },
  "6": { label: "💬 Test: conversations.addMessage", action: testAddMessage },
  "7": { label: "📋 Test: conversations.list (by user)", action: testListByUser },
  "8": { label: "📋 Test: conversations.list (by agent)", action: testListByAgent },
  "9": { label: "🔢 Test: conversations.count", action: testCount },
  "10": { label: "📜 Test: conversations.getHistory", action: testGetHistory },
  "11": { label: "🔍 Test: conversations.search", action: testSearch },
  "12": { label: "💾 Test: conversations.export (JSON)", action: testExportJSON },
  "13": { label: "📊 Test: conversations.export (CSV)", action: testExportCSV },
  "14": { label: "🗑️  Test: conversations.delete", action: testDelete },
  "15": { label: "🎯 Run All Tests (Sequential)", action: runAllTests },
  "0": { label: "❌ Exit", action: exit },
};

// Test implementations
async function purgeDatabase() {
  console.log("\n🧹 Purging conversations table...");
  const deleted = await cleanup.purgeConversations();
  await cleanup.verifyConversationsEmpty();
  currentConversationId = null;
  console.log(`✅ Purged ${deleted} conversation(s)`);
  console.log("✅ Database is clean\n");
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

async function runAllTests() {
  console.log("\n🎯 Running all tests sequentially...\n");
  console.log("═".repeat(80));

  await purgeDatabase();
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

  // Final validation
  console.log("\n🔍 FINAL VALIDATION\n");
  console.log("═".repeat(80));

  const totalCount = await cortex.conversations.count();
  console.log(`Total conversations: ${totalCount}`);
  
  const userConvs = await cortex.conversations.list({ userId: TEST_USER_ID });
  console.log(`User conversations: ${userConvs.length}`);
  
  const agentConvs = await cortex.conversations.list({ agentId: TEST_AGENT_ID });
  console.log(`Agent conversations: ${agentConvs.length}`);

  console.log("\n✅ Expected:");
  console.log("  - Total: 2 (1 user-agent + 1 agent-agent)");
  console.log("  - By user: 1 (only user-agent conversation)");
  console.log("  - By agent: 2 (user-agent + agent-agent)");

  console.log("\n📊 Actual:");
  console.log(`  - Total: ${totalCount} ${totalCount === 2 ? "✅" : "❌"}`);
  console.log(`  - By user: ${userConvs.length} ${userConvs.length === 1 ? "✅" : "❌"}`);
  console.log(`  - By agent: ${agentConvs.length} ${agentConvs.length === 2 ? "✅" : "❌"}`);

  const allValid = totalCount === 2 && userConvs.length === 1 && agentConvs.length === 2;
  
  console.log("\n" + "═".repeat(80));
  if (allValid) {
    console.log("✅ ALL TESTS PASSED! All counts match expected values.");
  } else {
    console.log("❌ SOME TESTS FAILED! Counts don't match expected values.");
  }
  console.log("═".repeat(80));

  console.log("\n💡 Tip: You can now inspect or clean up using the menu\n");
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

  for (const [key, option] of Object.entries(MENU_OPTIONS)) {
    console.log(`  ${key.padStart(2, " ")}) ${option.label}`);
  }

  console.log();
  console.log("═".repeat(80));
  
  if (currentConversationId) {
    console.log(`🎯 Current Conversation: ${currentConversationId}`);
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

