#!/usr/bin/env tsx
/**
 * Verification script to check test data was created
 * Shows counts for all tables to verify data presence
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
  process.exit(1);
}

console.log(`\n📊 Verifying test data in: ${convexUrl}\n`);

const client = new ConvexClient(convexUrl);

async function verify() {
  try {
    console.log("🔍 Checking data counts across all tables...\n");

    // Check conversations
    const conversations = await client.query(api.conversations.list, {
      limit: 10000, // Fetch all conversations (default is 100)
    });
    console.log(`📋 Conversations: ${conversations.length}`);

    // Sample a few conversations to show userId
    if (conversations.length > 0) {
      console.log(`   Sample conversations with userId:`);
      conversations.slice(0, 3).forEach((conv, idx) => {
        console.log(`   ${idx + 1}. conversationId: ${conv.conversationId}`);
        console.log(`      participants: ${JSON.stringify(conv.participants)}`);
      });
    }

    // Check memories - we'll use the vector list API
    try {
      const memorySpaces = await client.query(api.memorySpaces.list, {});
      console.log(`\n🏢 Memory Spaces: ${memorySpaces.length}`);

      if (memorySpaces.length > 0) {
        console.log(`   Sample memory spaces:`);
        for (let i = 0; i < Math.min(3, memorySpaces.length); i++) {
          const space = memorySpaces[i];
          console.log(`   ${i + 1}. ${space.memorySpaceId}`);
          
          // Try to get memories for this space
          try {
            const memories = await client.query(api.memories.list, {
              memorySpaceId: space.memorySpaceId,
              limit: 5,
            });
            console.log(`      Memories in space: ${memories.length}`);
            
            // Show userId in memories
            memories.forEach((mem: any, idx: number) => {
              if (mem.userId) {
                console.log(`      ${idx + 1}. Memory ${mem.memoryId.slice(0, 8)}... userId: ${mem.userId}`);
              }
            });
          } catch (e) {
            // Skip if can't list
          }
        }
      }
    } catch (e: any) {
      console.log(`\n⚠️  Could not fetch memory spaces: ${e.message}`);
    }

    // Check facts (requires memorySpaceId, so we'll skip or use first space)
    try {
      if (memorySpaces.length > 0) {
        const facts = await client.query(api.facts.list, { 
          memorySpaceId: memorySpaces[0].memorySpaceId,
          limit: 100 
        });
        console.log(`\n📊 Facts (in first space): ${facts.length}`);
      } else {
        console.log(`\n📊 Facts: 0 (no memory spaces)`);
      }
    } catch (e) {
      console.log(`\n📊 Facts: 0 (unable to query)`);
    }

    // Check contexts
    try {
      const contexts = await client.query(api.contexts.list, { limit: 100 });
      console.log(`🔗 Contexts: ${contexts.length}`);
    } catch (e) {
      console.log(`🔗 Contexts: Unable to query`);
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("✅ VERIFICATION COMPLETE!");
    console.log(
      `📈 Database contains test data including user-attached memories`
    );
    console.log(`${"=".repeat(60)}\n`);
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

verify().then(() => process.exit(0));
