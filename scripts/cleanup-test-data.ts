#!/usr/bin/env tsx
/**
 * Manual cleanup script for test data
 * Purges all test data from a Convex deployment
 */

import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import dotenv from "dotenv";
import { resolve } from "path";

// Load environment
dotenv.config({ path: resolve(process.cwd(), ".env.local"), override: true });

const convexUrl = process.argv[2] || process.env.LOCAL_CONVEX_URL || process.env.CONVEX_URL;

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
    // Get all conversations
    const conversations = await client.query(api.conversations.list, {});
    console.log(`📋 Found ${conversations.length} conversations`);
    
    for (const conv of conversations) {
      try {
        await client.mutation(api.conversations.deleteConversation, {
          conversationId: conv.conversationId,
        });
      } catch (e) {
        // Ignore if already deleted
      }
    }
    
    // Get all memories from common test agent IDs
    const testAgentIds = [
      "agent-test-l3",
      "test-agent-1",
      "test-agent-2",
      "test-agent-3",
      "another-test-agent",
      "agent-vector-test",
    ];
    
    let totalMemories = 0;
    for (const agentId of testAgentIds) {
      try {
        const memories = await client.query(api.memories.list, { agentId });
        totalMemories += memories.length;
        console.log(`📝 Found ${memories.length} memories for ${agentId}`);
        
        for (const memory of memories) {
          try {
            await client.mutation(api.memories.deleteMemory, {
              agentId: memory.agentId,
              memoryId: memory.memoryId,
            });
          } catch (e) {
            // Ignore if already deleted
          }
        }
      } catch (e) {
        // Agent might not exist
      }
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   - Deleted ${conversations.length} conversations`);
    console.log(`   - Deleted ${totalMemories} memories`);
    
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

cleanup().then(() => process.exit(0));

