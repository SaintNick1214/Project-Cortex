#!/usr/bin/env tsx
/**
 * Manual cleanup script for test data
 * Purges all test data from a Convex deployment
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
    console.log("🧹 Starting comprehensive cleanup across all 8 tables...\n");

    let stats = {
      conversations: 0,
      memories: 0,
      facts: 0,
      contexts: 0,
      memorySpaces: 0,
      immutable: 0,
      mutable: 0,
      agents: 0,
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 1: Conversations
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("📋 Purging conversations...");
    try {
      const conversations = await client.query(api.conversations.list, {});
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
    // Table 3: Facts (NEW)
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
    // Table 4: Contexts (NEW)
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
    // Table 5: Memory Spaces (NEW)
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
      if ((api.immutable as any).purgeAll) {
        const result = await client.mutation((api.immutable as any).purgeAll, {});
        stats.immutable = result.deleted;
        console.log(`   ✅ Deleted ${stats.immutable} immutable entries`);
      } else {
        console.log(`   ⏭️  No purgeAll available (shared table)`);
      }
    } catch (e: any) {
      console.error(`   ⚠️  Immutable cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 7: Mutable Store
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("⚡ Purging mutable store...");
    try {
      if ((api.mutable as any).purgeAll) {
        const result = await client.mutation((api.mutable as any).purgeAll, {});
        stats.mutable = result.deleted;
        console.log(`   ✅ Deleted ${stats.mutable} mutable entries`);
      } else {
        console.log(`   ⏭️  No purgeAll available (shared table)`);
      }
    } catch (e: any) {
      console.error(`   ⚠️  Mutable cleanup failed: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Table 8: Agents Registry (DEPRECATED but still cleaned)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("👤 Purging agents registry (deprecated)...");
    try {
      // Agents table doesn't have purgeAll, so we skip it
      // It's deprecated and will be removed in future versions
      stats.agents = 0;
      console.log(`   ⏭️  Skipped (deprecated table)`);
    } catch (e: any) {
      console.error(`   ⚠️  Agents cleanup failed: ${e.message}`);
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
      stats.mutable;

    console.log(`\n${"=".repeat(60)}`);
    console.log("✅ CLEANUP COMPLETE!");
    console.log(`${"=".repeat(60)}`);
    console.log(`📊 Summary:`);
    console.log(`   Conversations:   ${stats.conversations.toString().padStart(6)}`);
    console.log(`   Memories:        ${stats.memories.toString().padStart(6)}`);
    console.log(`   Facts:           ${stats.facts.toString().padStart(6)} (NEW)`);
    console.log(`   Contexts:        ${stats.contexts.toString().padStart(6)} (NEW)`);
    console.log(`   Memory Spaces:   ${stats.memorySpaces.toString().padStart(6)} (NEW)`);
    console.log(`   Immutable:       ${stats.immutable.toString().padStart(6)}`);
    console.log(`   Mutable:         ${stats.mutable.toString().padStart(6)}`);
    console.log(`   ${"─".repeat(26)}`);
    console.log(`   TOTAL DELETED:   ${total.toString().padStart(6)}`);
    console.log(`${"=".repeat(60)}\n`);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

cleanup().then(() => process.exit(0));
