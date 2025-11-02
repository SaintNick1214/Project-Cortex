/**
 * Facts Extraction Example
 * 
 * Demonstrates knowledge extraction features (Category B):
 * - Automatic fact extraction
 * - Structured knowledge queries
 * - Storage optimization (60-90% savings)
 */

import { Cortex } from '@cortexmemory/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🚀 Facts Extraction Example\n');

  // Initialize Cortex
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL
  });

  const memorySpaceId = 'company-kb';
  const conversationId = `conv-${Date.now()}`;

  // ============================================================================
  // FEATURE B1: Automatic fact extraction during conversation
  // ============================================================================
  console.log('1. Storing conversation with automatic fact extraction');

  const richContent = `Alice works at Acme Corp as a Senior Engineer specializing in TypeScript. She joined in 2020 and has been leading the platform team since 2022. She's based in San Francisco and reports to the CTO.`;

  const result = await cortex.memory.remember({
    memorySpaceId,
    conversationId,
    userMessage: richContent,
    agentResponse: "Got it! I'll remember all that information about Alice.",
    userId: 'hr-bot',
    userName: 'HR Bot',
    importance: 8,
    extractFacts: true,  // Enable automatic extraction
    metadata: {
      category: 'employee-info',
      source: 'hr-system'
    }
  });

  console.log(`   ✓ Conversation stored: ${result.conversationId}`);
  console.log(`   ✓ Facts extracted: ${result.extractedFacts?.length || 0}\n`);

  // ============================================================================
  // FEATURE B2: Query structured facts
  // ============================================================================
  console.log('2. Querying facts about Alice');

  const aliceFacts = await cortex.facts.list({
    memorySpaceId,
    subject: 'Alice',
    limit: 20
  });

  console.log(`   ✓ Found ${aliceFacts.length} facts about Alice:`);
  aliceFacts.forEach((fact, i) => {
    if (fact.attribute && fact.value) {
      console.log(`   ${i+1}. ${fact.attribute}: ${fact.value}`);
      console.log(`      Confidence: ${fact.confidence}%`);
    }
  });
  console.log('');

  // ============================================================================
  // FEATURE B3: Query by specific attribute
  // ============================================================================
  console.log('3. Finding all employees at Acme Corp');

  const acmeEmployees = await cortex.facts.query({
    memorySpaceId,
    attribute: 'employer',
    value: 'Acme Corp',
    limit: 50
  });

  console.log(`   ✓ Found ${acmeEmployees.length} employees at Acme Corp\n`);

  // ============================================================================
  // FEATURE B4: Manual fact extraction
  // ============================================== ==============================
  console.log('4. Manually extracting facts from text');

  const bobInfo = 'Bob lives in Seattle and loves coffee. He works remotely as a data scientist.';
  
  const extractedFacts = await cortex.facts.extract({
    content: bobInfo,
    memorySpaceId,
    extractorType: 'llm',
    metadata: { source: 'manual' }
  });

  console.log(`   ✓ Extracted ${extractedFacts.length} facts from manual text:`);
  extractedFacts.forEach((fact, i) => {
    console.log(`   ${i+1}. ${fact.fact}`);
  });
  console.log('');

  // ============================================================================
  // FEATURE B5: Storage efficiency comparison
  // ============================================================================
  console.log('5. Storage efficiency analysis');

  const originalTokens = richContent.split(' ').length * 1.3; // ~tokens
  const factsCount = aliceFacts.length;
  const factsTokens = factsCount * 10; // ~tokens per fact

  console.log(`   Original conversation: ~${Math.round(originalTokens)} tokens`);
  console.log(`   Extracted facts: ~${factsTokens} tokens (${factsCount} facts)`);
  console.log(`   Storage savings: ${Math.round((1 - factsTokens/originalTokens) * 100)}%\n`);

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('✅ Facts Extraction Features Demonstrated:');
  console.log('   - Automatic fact extraction from conversations');
  console.log('   - Structured fact queries (entity, attribute, value)');
  console.log('   - Manual fact extraction from text');
  console.log('   - 60-90% storage reduction');
  console.log('   - Queryable knowledge base');
  console.log('\n🎉 Example complete!\n');

  cortex.close();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

