/**
 * Cortex Memory SDK - Getting Started
 * 
 * This is a simple example to get you started with Cortex.
 * Your AI agent now has persistent memory!
 */

import { Cortex } from '@cortexmemory/sdk';

// Initialize Cortex with your Convex deployment
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});

async function main() {
  console.log('🧠 Cortex Memory SDK - Example');
  console.log('================================\n');

  // Define your memory space (isolation boundary)
  const memorySpaceId = 'my-first-agent';
  const conversationId = 'conversation-1';

  try {
    // Store a memory (remember() auto-creates conversation if needed!)
    console.log('💾 Storing a memory...');
    await cortex.memory.remember({
      memorySpaceId,
      conversationId,
      userMessage: 'I prefer dark mode and TypeScript',
      agentResponse: "Got it! I'll remember your preferences.",
      userId: 'user-123',
      userName: 'User',
    });
    console.log('✓ Memory stored!\n');

    // Search for memories
    console.log('🔍 Searching memories...');
    const results = await cortex.memory.search(
      memorySpaceId,
      'what are the user preferences?'
    );
    
    console.log(`✓ Found ${results.length} relevant memories:`);
    results.forEach((memory, i) => {
      console.log(`\n${i + 1}. ${memory.content}`);
      console.log(`   Importance: ${memory.importance}`);
    });

    // Get conversation history
    console.log('\n📜 Getting conversation history...');
    const conversation = await cortex.conversations.get(conversationId);
    
    if (conversation) {
      console.log(`✓ Conversation has ${conversation.messages.length} messages`);
    }

    console.log('\n🎉 Success! Your AI agent has persistent memory.');
    console.log('\n📚 Next steps:');
    console.log('   - Explore the API: https://github.com/SaintNick1214/Project-Cortex');
    console.log('   - Add vector embeddings for semantic search');
    console.log('   - Set up graph database for advanced queries');
    console.log('   - Build multi-agent systems with context chains\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    // Cleanup
    cortex.close();
  }
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

