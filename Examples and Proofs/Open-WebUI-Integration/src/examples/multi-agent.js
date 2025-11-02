/**
 * Multi-Agent Collaboration Example
 * 
 * Demonstrates multi-agent features (Category C):
 * - Hive Mode (shared memory space)
 * - Agent registry
 * - Cross-agent context awareness
 */

import { Cortex } from '@cortexmemory/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🚀 Multi-Agent Collaboration Example\n');

  // Initialize Cortex
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL
  });

  const hiveSpaceId = 'creative-team-hive';
  const conversationId = `conv-${Date.now()}`;

  // ============================================================================
  // FEATURE C1: Create Hive Mode memory space
  // ============================================================================
  console.log('1. Creating Hive Mode memory space (shared across agents)');

  await cortex.memorySpaces.register({
    memorySpaceId: hiveSpaceId,
    name: 'Creative Team Hive',
    type: 'team',
    participants: ['gpt-4', 'claude-3-opus', 'llama-70b'],
    metadata: {
      team: 'creative',
      project: 'brand-identity',
      mode: 'hive'
    }
  });

  console.log('   ✓ Hive space created with 3 participants\n');

  // ============================================================================
  // FEATURE C2: Register multiple AI agents
  // ============================================================================
  console.log('2. Registering AI agents');

  await cortex.agents.register({
    agentId: 'gpt-4',
    name: 'GPT-4',
    capabilities: ['design', 'reasoning', 'coding'],
    metadata: {
      provider: 'openai',
      model: 'gpt-4-turbo',
      role: 'designer'
    }
  });

  await cortex.agents.register({
    agentId: 'claude-3-opus',
    name: 'Claude 3 Opus',
    capabilities: ['writing', 'analysis', 'reasoning'],
    metadata: {
      provider: 'anthropic',
      model: 'claude-3-opus',
      role: 'copywriter'
    }
  });

  await cortex.agents.register({
    agentId: 'llama-70b',
    name: 'Llama 2 70B',
    capabilities: ['research', 'reasoning'],
    metadata: {
      provider: 'ollama',
      model: 'llama2:70b',
      role: 'researcher',
      selfHosted: true
    }
  });

  console.log('   ✓ Registered 3 agents\n');

  // ============================================================================
  // FEATURE C3: Agents collaborate in shared memory space
  // ============================================================================
  console.log('3. GPT-4 creates logo design (stored in hive)');

  await cortex.memory.remember({
    memorySpaceId: hiveSpaceId,
    conversationId: `${conversationId}-design`,
    userMessage: 'Design a modern logo for our brand',
    agentResponse: 'I created a minimalist design with blue (#2C3E50) as the primary color, representing trust and professionalism.',
    userId: 'demo-user',
    userName: 'Demo User',
    participantId: 'gpt-4',
    importance: 8,
    metadata: {
      task: 'logo-design',
      deliverable: 'logo_v1.svg'
    }
  });

  console.log('   ✓ GPT-4 design stored in shared hive\n');

  // ============================================================================
  // FEATURE C4: Cross-agent context awareness
  // ============================================================================
  console.log('4. Claude accesses GPT-4\'s design (cross-agent recall)');

  const designMemories = await cortex.memory.recall({
    memorySpaceId: hiveSpaceId,
    query: 'logo design blue color',
    participantId: 'claude-3-opus',  // Claude querying
    limit: 5
  });

  console.log(`   ✓ Claude found ${designMemories.length} relevant memories`);
  if (designMemories.length > 0) {
    console.log(`   Design context: "${designMemories[0].content}"`);
  }
  console.log('');

  console.log('5. Claude creates tagline based on GPT-4\'s design');

  await cortex.memory.remember({
    memorySpaceId: hiveSpaceId,
    conversationId: `${conversationId}-tagline`,
    userMessage: 'Write a tagline for the logo',
    agentResponse: 'Based on the modern blue design GPT-4 created: "Simple. Powerful. Yours."',
    userId: 'demo-user',
    userName: 'Demo User',
    participantId: 'claude-3-opus',
    importance: 8,
    metadata: {
      task: 'tagline',
      references: [`${conversationId}-design`]
    }
  });

  console.log('   ✓ Claude\'s tagline builds on GPT-4\'s work\n');

  console.log('6. Llama researches competitors with full context');

  const fullContext = await cortex.memory.recall({
    memorySpaceId: hiveSpaceId,
    query: 'brand identity project',
    participantId: 'llama-70b',
    limit: 10
  });

  console.log(`   ✓ Llama has access to ${fullContext.length} memories from the team`);
  console.log('   ✓ Includes: GPT-4\'s design + Claude\'s tagline\n');

  // ============================================================================
  // FEATURE C5: Agent analytics
  // ============================================================================
  console.log('7. Viewing agent activity');

  const agents = await cortex.agents.list();
  console.log(`   ✓ Total registered agents: ${agents.length}`);
  
  agents.forEach(agent => {
    console.log(`   - ${agent.name} (${agent.capabilities?.join(', ')})`);
  });
  console.log('');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('✅ Multi-Agent Features Demonstrated:');
  console.log('   - Hive Mode (shared memory space)');
  console.log('   - Agent registry with capabilities');
  console.log('   - Cross-agent context awareness');
  console.log('   - Unified memory across AI models');
  console.log('\n🎉 Example complete!\n');

  cortex.close();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

