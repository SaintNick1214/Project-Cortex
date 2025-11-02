/**
 * Basic Chat Example with Cortex Memory
 * 
 * Demonstrates core memory features (Category A):
 * - Conversation storage with ACID guarantees
 * - Semantic search and recall
 * - Automatic versioning
 */

import { Cortex } from '@cortexmemory/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🚀 Basic Chat with Cortex Memory Example\n');

  // Initialize Cortex
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL
  });

  const userId = 'alice-123';
  const conversationId = `conv-${Date.now()}`;

  console.log('📝 Simulating a conversation...\n');

  // ============================================================================
  // FEATURE A1: Store conversation with ACID guarantees
  // ============================================================================
  console.log('1. Storing conversation (ACID transaction)');
  
  const result1 = await cortex.memory.remember({
    memorySpaceId: userId,
    conversationId,
    userMessage: 'I prefer TypeScript for all my new projects',
    agentResponse: "Got it! I'll remember your TypeScript preference.",
    userId,
    userName: 'Alice',
    importance: 8,
    metadata: {
      category: 'preference',
      topic: 'programming'
    }
  });

  console.log(`   ✓ Stored conversation: ${result1.conversationId}`);
  console.log(`   ✓ Memory ID: ${result1.memoryId}\n`);

  // Store another message
  await cortex.memory.remember({
    memorySpaceId: userId,
    conversationId,
    userMessage: 'I also prefer VS Code as my editor',
    agentResponse: "Noted! You prefer VS Code for editing.",
    userId,
    userName: 'Alice',
    importance: 7,
    metadata: {
      category: 'preference',
      topic: 'tools'
    }
  });

  console.log('   ✓ Stored second message\n');

  // ============================================================================
  // FEATURE A2: Semantic search across conversation history
  // ============================================================================
  console.log('2. Semantic search for preferences');

  const memories = await cortex.memory.recall({
    memorySpaceId: userId,
    query: 'what are my programming language preferences?',
    limit: 5
  });

  console.log(`   ✓ Found ${memories.length} relevant memories:`);
  memories.forEach((mem, i) => {
    console.log(`   ${i+1}. ${mem.content}`);
    console.log(`      Similarity: ${(mem.similarity * 100).toFixed(1)}%`);
  });
  console.log('');

  // ============================================================================
  // FEATURE A3: Temporal queries
  // ============================================================================
  console.log('3. Query recent memories (last hour)');

  const recentMemories = await cortex.memory.recall({
    memorySpaceId: userId,
    query: 'preferences',
    startDate: new Date(Date.now() - 3600000), // Last hour
    limit: 10
  });

  console.log(`   ✓ Found ${recentMemories.length} memories from last hour\n`);

  // ============================================================================
  // FEATURE A4: Automatic versioning
  // ============================================================================
  console.log('4. Demonstrating automatic versioning');

  // Update a memory (creates version 2)
  if (memories.length > 0) {
    const memoryId = memories[0].memoryId;
    
    console.log(`   Original content: "${memories[0].content}"`);
    
    await cortex.memory.update(userId, memoryId, {
      content: 'I strongly prefer TypeScript and use it exclusively',
      metadata: { updated: true, version: 2 }
    });

    console.log('   ✓ Updated memory (v2 created, v1 preserved)');
    
    // Get version history
    const history = await cortex.memory.getHistory(userId, memoryId);
    console.log(`   ✓ Memory now has ${history.length} versions\n`);
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('✅ Core Memory Features Demonstrated:');
  console.log('   - ACID conversation storage');
  console.log('   - Semantic search and recall');
  console.log('   - Temporal queries');
  console.log('   - Automatic versioning');
  console.log('\n🎉 Example complete!\n');

  cortex.close();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

