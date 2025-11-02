/**
 * GDPR Compliance Example
 * 
 * Demonstrates user profile and compliance features (Category B):
 * - User profile management
 * - GDPR cascade deletion
 * - Data export (right to access)
 */

import { Cortex } from '@cortexmemory/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🚀 GDPR Compliance Example\n');

  // Initialize Cortex
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL
  });

  const userId = 'sarah-test-user';
  const conversationId = `conv-${Date.now()}`;

  // ============================================================================
  // FEATURE B1: Create user profile
  // ============================================================================
  console.log('1. Creating comprehensive user profile');

  await cortex.users.create({
    userId,
    name: 'Sarah Chen',
    email: 'sarah.test@example.com',
    metadata: {
      account: {
        plan: 'Pro',
        joined: '2024-03-15',
        company: 'Tech Innovations Inc'
      },
      preferences: {
        theme: 'dark',
        language: 'en',
        timezone: 'America/Los_Angeles',
        notifications: true
      },
      support_tier: 'priority'
    }
  });

  console.log('   ✓ User profile created\n');

  // ============================================================================
  // FEATURE B2: Store user data across multiple conversations
  // ============================================================================
  console.log('2. Storing user data in conversations');

  // Support conversation
  await cortex.memory.remember({
    memorySpaceId: 'support-team',
    conversationId: `${conversationId}-support`,
    userMessage: 'I need help with API rate limits',
    agentResponse: 'Increased your rate limit to 10,000/hour',
    userId,
    userName: 'Sarah Chen',
    importance: 7,
    metadata: {
      ticketId: 'TICKET-001',
      category: 'api',
      resolved: true
    }
  });

  // Personal conversation
  await cortex.memory.remember({
    memorySpaceId: userId,
    conversationId: `${conversationId}-personal`,
    userMessage: 'I prefer Python for data science tasks',
    agentResponse: "I'll remember your Python preference for data science.",
    userId,
    userName: 'Sarah Chen',
    importance: 6,
    extractFacts: true
  });

  console.log('   ✓ Created support conversation');
  console.log('   ✓ Created personal conversation\n');

  // ============================================================================
  // FEATURE B3: Retrieve user profile
  // ============================================================================
  console.log('3. Retrieving user profile');

  const profile = await cortex.users.get(userId);

  console.log(`   Name: ${profile.name}`);
  console.log(`   Email: ${profile.email}`);
  console.log(`   Plan: ${profile.metadata?.account?.plan}`);
  console.log(`   Theme: ${profile.metadata?.preferences?.theme}`);
  console.log(`   Version: ${profile.version}\n`);

  // ============================================================================
  // FEATURE B4: GDPR Right to Access (data export)
  // ============================================================================
  console.log('4. GDPR Right to Access - Exporting user data');

  // Note: In the real API, you'd use cortex.users.export()
  // For this demo, we'll simulate by getting the data
  
  const userData = {
    profile,
    support_conversations: await cortex.memory.recall({
      memorySpaceId: 'support-team',
      query: '',
      userId,
      limit: 100
    }),
    personal_memories: await cortex.memory.recall({
      memorySpaceId: userId,
      query: '',
      limit: 100
    })
  };

  console.log('   ✓ User data export prepared');
  console.log(`   - Profile: 1 record`);
  console.log(`   - Support conversations: ${userData.support_conversations.length} memories`);
  console.log(`   - Personal memories: ${userData.personal_memories.length} memories\n`);

  // ============================================================================
  // FEATURE B5: GDPR Right to be Forgotten (cascade deletion)
  // ============================================================================
  console.log('5. GDPR Right to be Forgotten - Cascade Deletion');
  console.log('   ⚠️  This will delete ALL user data across all layers\n');

  // Preview what will be deleted
  console.log('   Preview deletion:');
  
  const deleteResult = await cortex.users.delete(userId, {
    cascade: true,  // Delete across ALL layers
    verify: true    // Verify completeness
  });

  console.log(`   ✓ User deleted: ${userId}`);
  console.log(`   ✓ Conversations deleted: ${deleteResult.conversationsDeleted || 0}`);
  console.log(`   ✓ Messages deleted: ${deleteResult.conversationMessagesDeleted || 0}`);
  console.log(`   ✓ Vector memories deleted: ${deleteResult.vectorMemoriesDeleted || 0}`);
  console.log(`   ✓ Facts deleted: ${deleteResult.factsDeleted || 0}`);
  console.log(`   ✓ Total records deleted: ${deleteResult.totalDeleted || 0}`);
  console.log(`   ✓ Layers affected: ${deleteResult.deletedLayers?.join(', ') || 'N/A'}`);
  
  if (deleteResult.verification?.complete) {
    console.log('   ✓ Verification: Complete (no orphaned records)\n');
  } else {
    console.log('   ⚠️  Verification issues:', deleteResult.verification?.issues);
  }

  // Verify deletion
  const deletedUser = await cortex.users.get(userId);
  console.log(`   ✓ User profile exists after deletion: ${deletedUser !== null ? 'Yes (ERROR!)' : 'No (correct)'}\n`);

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('✅ GDPR Compliance Features Demonstrated:');
  console.log('   - Rich user profiles with preferences');
  console.log('   - User data storage across conversations');
  console.log('   - GDPR Article 15: Right to access (data export)');
  console.log('   - GDPR Article 17: Right to be forgotten (cascade delete)');
  console.log('   - Complete deletion across all layers');
  console.log('   - Verification of deletion completeness');
  console.log('\n🎉 Example complete!\n');

  cortex.close();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

