#!/usr/bin/env tsx
/**
 * Verification script for multi-user chatbot data
 * Shows detailed breakdown of memories per user
 */

import { Cortex } from "../src/index";
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

console.log(`\n📊 Verifying multi-user data in: ${convexUrl}\n`);

const cortex = new Cortex({ convexUrl });

const userIds = [
  "user-alice-001",
  "user-bob-002",
  "user-carol-003",
  "user-david-004",
  "user-emma-005",
];

async function verify() {
  try {
    const memorySpaceId = "chatbot-space-multiuser";

    console.log(`🔍 Checking Memory Space: ${memorySpaceId}\n`);

    let totalMemories = 0;

    // Check memories for each user
    for (const userId of userIds) {
      try {
        const memories = await cortex.vector.list({
          memorySpaceId,
          userId,
          limit: 1000,
        });

        totalMemories += memories.length;

        console.log(`👤 ${userId}:`);
        console.log(`   Memories: ${memories.length}`);

        // Sample a few memories
        if (memories.length > 0) {
          console.log(`   Sample memories:`);
          memories.slice(0, 3).forEach((mem, idx) => {
            const preview =
              mem.content.length > 60
                ? mem.content.substring(0, 60) + "..."
                : mem.content;
            console.log(`   ${idx + 1}. "${preview}"`);
          });
        }
        console.log();
      } catch (e: any) {
        console.log(`👤 ${userId}: Error - ${e.message}\n`);
      }
    }

    console.log(`${"=".repeat(60)}`);
    console.log("✅ VERIFICATION COMPLETE!");
    console.log(`${"=".repeat(60)}`);
    console.log(`📊 Summary:`);
    console.log(`   Memory Space:          ${memorySpaceId}`);
    console.log(`   Users checked:         ${userIds.length}`);
    console.log(`   Total Memories:        ${totalMemories}`);
    console.log(
      `   Avg Memories per User: ${(totalMemories / userIds.length).toFixed(1)}`,
    );
    console.log(`${"=".repeat(60)}\n`);
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  } finally {
    cortex.close();
  }
}

verify().then(() => process.exit(0));
