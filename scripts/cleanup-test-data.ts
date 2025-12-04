#!/usr/bin/env tsx
/**
 * Manual cleanup script for test data
 * Purges all test data from a Convex deployment
 *
 * Tables purged (in order for referential integrity):
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
 */

import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
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

async function cleanup() {
  try {
    console.log("🧹 Starting comprehensive cleanup across all 11 tables...\n");

    let stats = {
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
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 1: Conversations
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("📋 Purging conversations...");
    try {
      const conversations = await client.query(api.conversations.list, {
        limit: 10000, // Fetch all conversations (default is 100)
      });
      stats.conversations = conversations.length;

      for (const conv of conversations) {
        try {
          await client.mutation(api.conversations.deleteConversation, {
            conversationId: conv.conversationId,
          });
        } catch (e) {
          // Ignore if already deleted
        }
      }
      console.log(`   ✅ Deleted ${stats.conversations} conversations`);
    } catch (e: any) {
      console.error(`   ⚠️  Conversations cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 2: Memories (use purgeAll for efficiency)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("📝 Purging memories...");
    try {
      const result = await client.mutation(api.memories.purgeAll, {});
      stats.memories = result.deleted;
      console.log(`   ✅ Deleted ${stats.memories} memories`);
    } catch (e: any) {
      console.error(`   ⚠️  Memories cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 3: Facts
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("📊 Purging facts...");
    try {
      const result = await client.mutation(api.facts.purgeAll, {});
      stats.facts = result.deleted;
      console.log(`   ✅ Deleted ${stats.facts} facts`);
    } catch (e: any) {
      console.error(`   ⚠️  Facts cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 4: Contexts
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("🔗 Purging contexts...");
    try {
      const result = await client.mutation(api.contexts.purgeAll, {});
      stats.contexts = result.deleted;
      console.log(`   ✅ Deleted ${stats.contexts} contexts`);
    } catch (e: any) {
      console.error(`   ⚠️  Contexts cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 5: Memory Spaces
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("🏢 Purging memory spaces...");
    try {
      const result = await client.mutation(api.memorySpaces.purgeAll, {});
      stats.memorySpaces = result.deleted;
      console.log(`   ✅ Deleted ${stats.memorySpaces} memory spaces`);
    } catch (e: any) {
      console.error(`   ⚠️  Memory spaces cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 6: Immutable Store
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("💾 Purging immutable store...");
    try {
      const result = await client.mutation(api.immutable.purgeAll, {});
      stats.immutable = result.deleted;
      console.log(`   ✅ Deleted ${stats.immutable} immutable entries`);
    } catch (e: any) {
      console.error(`   ⚠️  Immutable cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 7: Mutable Store
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("⚡ Purging mutable store...");
    try {
      const result = await client.mutation(api.mutable.purgeAll, {});
      stats.mutable = result.deleted;
      console.log(`   ✅ Deleted ${stats.mutable} mutable entries`);
    } catch (e: any) {
      console.error(`   ⚠️  Mutable cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 8: Agents Registry
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("👤 Purging agents registry...");
    try {
      const result = await client.mutation(api.agents.purgeAll, {});
      stats.agents = result.deleted;
      console.log(`   ✅ Deleted ${stats.agents} agents`);
    } catch (e: any) {
      console.error(`   ⚠️  Agents cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 9: Graph Sync Queue
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("🔄 Purging graph sync queue...");
    try {
      const result = await client.mutation(api.graphSync.purgeAll, {});
      stats.graphSyncQueue = result.deleted;
      console.log(`   ✅ Deleted ${stats.graphSyncQueue} graph sync entries`);
    } catch (e: any) {
      console.error(`   ⚠️  Graph sync cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 10: Governance Policies
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("📜 Purging governance policies...");
    try {
      const result = await client.mutation(api.governance.purgeAllPolicies, {});
      stats.governancePolicies = result.deleted;
      console.log(
        `   ✅ Deleted ${stats.governancePolicies} governance policies`,
      );
    } catch (e: any) {
      console.error(`   ⚠️  Governance policies cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 11: Governance Enforcement Logs
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("📋 Purging governance enforcement logs...");
    try {
      const result = await client.mutation(
        api.governance.purgeAllEnforcement,
        {},
      );
      stats.governanceEnforcement = result.deleted;
      console.log(
        `   ✅ Deleted ${stats.governanceEnforcement} enforcement logs`,
      );
    } catch (e: any) {
      console.error(
        `   ⚠️  Governance enforcement cleanup failed: ${e.message}`,
      );
    }

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
      stats.governanceEnforcement;

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
    console.log(`   ${"─".repeat(30)}`);
    console.log(`   TOTAL DELETED:         ${total.toString().padStart(6)}`);
    console.log(`${"=".repeat(60)}\n`);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

cleanup().then(() => process.exit(0));
