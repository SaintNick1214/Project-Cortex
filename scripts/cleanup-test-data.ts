#!/usr/bin/env tsx
/**
 * Manual cleanup script for test data
 * Purges all test data from a Convex deployment using admin:clearTable
 * (same method as CLI's `cortex db clear` for consistency)
 *
 * Tables cleared (in order for referential integrity):
 *   1. conversations - conversation history
 *   2. memories - vector store
 *   3. facts - extracted facts
 *   4. contexts - hierarchical contexts
 *   5. memorySpaces - memory space registry
 *   6. immutable - versioned immutable records
 *   7. mutable - operational data
 *   8. agents - agent registry
 *   9. graphSyncQueue - graph sync queue
 *  10. governancePolicies - governance policies
 *  11. governanceEnforcement - enforcement logs
 *  12. sessions - session management
 *  13. factHistory - belief revision audit trail
 */

import { ConvexClient } from "convex/browser";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment
dotenv.config({ path: resolve(process.cwd(), ".env.local"), override: true });

const convexUrl =
  process.argv[2] || process.env.LOCAL_CONVEX_URL || process.env.CONVEX_URL;

if (!convexUrl) {
  console.error("❌ No Convex URL provided");
  console.error("Usage: tsx scripts/cleanup-test-data.ts [convex-url]");
  console.error("Or set LOCAL_CONVEX_URL or CONVEX_URL in .env.local");
  process.exit(1);
}

console.log(`\n🧹 Cleaning up test data from: ${convexUrl}\n`);

const client = new ConvexClient(convexUrl);

// Batch size reduction sequence for handling Convex 16MB read limit
// Starts at 10000, reduces on "Server Error": 10000 -> 500 -> 250 -> 50
// (Same adaptive sizing as CLI's `cortex db clear` command)
const BATCH_SIZE_SEQUENCE = [10000, 500, 250, 50] as const;

/**
 * Clear a table using admin:clearTable mutation (same as CLI)
 * Uses adaptive batch sizing: starts at 10000, reduces on "Too many bytes" errors
 * Loops until all records are deleted
 */
async function clearTable(
  tableName: string,
  displayName: string,
): Promise<number> {
  let totalDeleted = 0;
  let hasMore = true;
  let batchSizeIndex = 0; // Start with largest batch size

  while (hasMore) {
    const batchLimit = BATCH_SIZE_SEQUENCE[batchSizeIndex];
    try {
      // Suppress Convex SDK's console.error during mutation (we handle errors ourselves)
      const originalConsoleError = console.error;
      console.error = () => {};
      let result: { deleted: number; hasMore: boolean };
      try {
        result = (await client.mutation(
          "admin:clearTable" as Parameters<typeof client.mutation>[0],
          { table: tableName, limit: batchLimit },
        )) as { deleted: number; hasMore: boolean };
      } finally {
        console.error = originalConsoleError;
      }
      totalDeleted += result.deleted;
      hasMore = result.hasMore;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      // Check for byte limit error - Convex wraps errors, so check for:
      // 1. Direct "Too many bytes" message (if propagated)
      // 2. Generic "Server Error" from Convex client (common wrapper)
      const isByteLimitError =
        errorMsg.includes("Too many bytes") ||
        errorMsg.includes("Server Error");

      if (isByteLimitError && batchSizeIndex < BATCH_SIZE_SEQUENCE.length - 1) {
        // Reduce batch size and retry
        batchSizeIndex++;
        console.log(
          `   ⚠️  Reducing batch size to ${BATCH_SIZE_SEQUENCE[batchSizeIndex]} for ${tableName}`,
        );
      } else {
        // Either not a retryable error or we've exhausted all batch sizes
        // Table might not exist or be empty
        hasMore = false;
      }
    }
  }

  console.log(`   ✅ Deleted ${totalDeleted} ${displayName}`);
  return totalDeleted;
}

async function cleanup() {
  try {
    console.log(
      "🧹 Starting comprehensive cleanup using admin:clearTable...\n",
    );

    const stats = {
      conversations: 0,
      memories: 0,
      facts: 0,
      contexts: 0,
      memorySpaces: 0,
      immutable: 0,
      mutable: 0,
      agents: 0,
      graphSyncQueue: 0,
      governancePolicies: 0,
      governanceEnforcement: 0,
      sessions: 0,
      factHistory: 0,
    };

    // Clear tables in order (respecting dependencies)
    // Using admin:clearTable - same method as CLI's `cortex db clear`

    console.log("📋 Clearing conversations...");
    stats.conversations = await clearTable("conversations", "conversations");

    console.log("📝 Clearing memories...");
    stats.memories = await clearTable("memories", "memories");

    console.log("📊 Clearing facts...");
    stats.facts = await clearTable("facts", "facts");

    console.log("🔗 Clearing contexts...");
    stats.contexts = await clearTable("contexts", "contexts");

    console.log("🏢 Clearing memory spaces...");
    stats.memorySpaces = await clearTable("memorySpaces", "memory spaces");

    console.log("💾 Clearing immutable store...");
    stats.immutable = await clearTable("immutable", "immutable entries");

    console.log("⚡ Clearing mutable store...");
    stats.mutable = await clearTable("mutable", "mutable entries");

    console.log("👤 Clearing agents registry...");
    stats.agents = await clearTable("agents", "agents");

    console.log("🔄 Clearing graph sync queue...");
    stats.graphSyncQueue = await clearTable(
      "graphSyncQueue",
      "graph sync entries",
    );

    console.log("📜 Clearing governance policies...");
    stats.governancePolicies = await clearTable(
      "governancePolicies",
      "governance policies",
    );

    console.log("📋 Clearing governance enforcement logs...");
    stats.governanceEnforcement = await clearTable(
      "governanceEnforcement",
      "enforcement logs",
    );

    console.log("🔐 Clearing sessions...");
    stats.sessions = await clearTable("sessions", "sessions");

    console.log("📜 Clearing fact history...");
    stats.factHistory = await clearTable("factHistory", "fact history entries");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Summary
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const total =
      stats.conversations +
      stats.memories +
      stats.facts +
      stats.contexts +
      stats.memorySpaces +
      stats.immutable +
      stats.mutable +
      stats.agents +
      stats.graphSyncQueue +
      stats.governancePolicies +
      stats.governanceEnforcement +
      stats.sessions +
      stats.factHistory;

    console.log(`\n${"=".repeat(60)}`);
    console.log("✅ CLEANUP COMPLETE!");
    console.log(`${"=".repeat(60)}`);
    console.log(`📊 Summary:`);
    console.log(
      `   Conversations:         ${stats.conversations.toString().padStart(6)}`,
    );
    console.log(
      `   Memories:              ${stats.memories.toString().padStart(6)}`,
    );
    console.log(
      `   Facts:                 ${stats.facts.toString().padStart(6)}`,
    );
    console.log(
      `   Contexts:              ${stats.contexts.toString().padStart(6)}`,
    );
    console.log(
      `   Memory Spaces:         ${stats.memorySpaces.toString().padStart(6)}`,
    );
    console.log(
      `   Immutable:             ${stats.immutable.toString().padStart(6)}`,
    );
    console.log(
      `   Mutable:               ${stats.mutable.toString().padStart(6)}`,
    );
    console.log(
      `   Agents:                ${stats.agents.toString().padStart(6)}`,
    );
    console.log(
      `   Graph Sync Queue:      ${stats.graphSyncQueue.toString().padStart(6)}`,
    );
    console.log(
      `   Governance Policies:   ${stats.governancePolicies.toString().padStart(6)}`,
    );
    console.log(
      `   Governance Enforce:    ${stats.governanceEnforcement.toString().padStart(6)}`,
    );
    console.log(
      `   Sessions:              ${stats.sessions.toString().padStart(6)}`,
    );
    console.log(
      `   Fact History:          ${stats.factHistory.toString().padStart(6)}`,
    );
    console.log(`   ${"─".repeat(30)}`);
    console.log(`   TOTAL DELETED:         ${total.toString().padStart(6)}`);
    console.log(`${"=".repeat(60)}\n`);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

cleanup().then(() => process.exit(0));
