/**
 * Context Chains Example
 * 
 * Demonstrates hierarchical workflow features (Category B):
 * - Context chain creation
 * - Hierarchical project organization
 * - Context-scoped memory searches
 */

import { Cortex } from '@cortexmemory/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🚀 Context Chains Example\n');

  // Initialize Cortex
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL
  });

  const memorySpaceId = 'team-dev';

  // ============================================================================
  // FEATURE B1: Create hierarchical context chain
  // ============================================================================
  console.log('1. Creating hierarchical context chain\n');

  // Root: Project
  console.log('   Creating project context (root)');
  const project = await cortex.contexts.create({
    purpose: 'Website Redesign',
    description: 'Q4 2025 website overhaul project',
    memorySpaceId,
    parentId: null,  // Root level
    data: {
      deadline: '2025-12-31',
      budget: 50000,
      priority: 'high',
      tags: ['website', 'redesign', 'q4-2025']
    }
  });

  console.log(`   ✓ Project created: ${project.id}\n`);

  // Level 2: Sprint
  console.log('   Creating sprint context (child)');
  const sprint = await cortex.contexts.create({
    purpose: 'Sprint 1: Homepage',
    description: 'Focus on landing page redesign',
    memorySpaceId,
    parentId: project.id,
    data: {
      startDate: '2025-11-01',
      endDate: '2025-11-15',
      sprintGoal: 'Complete homepage redesign',
      tags: ['sprint-1', 'homepage']
    }
  });

  console.log(`   ✓ Sprint created: ${sprint.id}\n`);

  // Level 3: Task
  console.log('   Creating task context (grandchild)');
  const task = await cortex.contexts.create({
    purpose: 'Hero Section Design',
    description: 'Design and implement hero section',
    memorySpaceId,
    parentId: sprint.id,
    data: {
      assignedTo: 'alice-123',
      status: 'in_progress',
      estimatedHours: 8,
      tags: ['hero-section', 'design']
    }
  });

  console.log(`   ✓ Task created: ${task.id}\n`);

  // ============================================================================
  // FEATURE B2: Store memories linked to contexts
  // ============================================================================
  console.log('2. Storing conversations in context hierarchy\n');

  await cortex.memory.remember({
    memorySpaceId,
    conversationId: `conv-hero-${Date.now()}`,
    userMessage: 'Should we use a video or image for the hero section?',
    agentResponse: 'Video creates more engagement but adds ~500ms load time. I recommend a high-quality image with lazy-loaded video option.',
    userId: 'alice-123',
    userName: 'Alice',
    contextId: task.id,  // Link to task context
    importance: 7,
    metadata: {
      decision: 'hero-media-type',
      options: ['video', 'image']
    }
  });

  console.log('   ✓ Stored memory in Hero Section context\n');

  // ============================================================================
  // FEATURE B3: Context-aware search
  // ============================================================================
  console.log('3. Context-scoped search (only Hero Section task)');

  const taskMemories = await cortex.memory.recall({
    memorySpaceId,
    contextId: task.id,  // Search within specific task
    query: 'hero section decisions',
    limit: 10
  });

  console.log(`   ✓ Found ${taskMemories.length} memories in Hero Section context\n`);

  console.log('4. Context-scoped search with parent contexts included');

  const withParents = await cortex.memory.recall({
    memorySpaceId,
    contextId: task.id,
    query: 'project goals',
    includeParentContexts: true,  // Search task + sprint + project
    limit: 10
  });

  console.log(`   ✓ Search includes task, sprint, and project contexts\n`);

  // ============================================================================
  // FEATURE B4: Navigate context chain
  // ============================================================================
  console.log('5. Navigating full context chain');

  const chain = await cortex.contexts.getChain(task.id);

  console.log('   Context hierarchy:');
  console.log(`   ${chain.root.purpose} (root)`);
  console.log(`     ├─ ${chain.parent?.purpose} (parent)`);
  console.log(`     └──── ${chain.current.purpose} (current)`);
  console.log('');

  console.log(`   Ancestors: ${chain.ancestors.length}`);
  console.log(`   Children: ${chain.children.length}`);
  console.log(`   Depth: ${chain.depth}\n`);

  // ============================================================================
  // FEATURE B5: List all contexts
  // ============================================================================
  console.log('6. Listing all contexts for team');

  const allContexts = await cortex.contexts.list({
    memorySpaceId
  });

  console.log(`   ✓ Team has ${allContexts.length} total contexts\n`);

  // Build tree view
  const roots = allContexts.filter(c => !c.parentId);
  console.log('   Project structure:');
  roots.forEach(root => {
    console.log(`   ${root.purpose}`);
    const children = allContexts.filter(c => c.parentId === root.id);
    children.forEach(child => {
      console.log(`     ├─ ${child.purpose}`);
      const grandchildren = allContexts.filter(c => c.parentId === child.id);
      grandchildren.forEach(gc => {
        console.log(`     │  └─ ${gc.purpose}`);
      });
    });
  });
  console.log('');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('✅ Context Chain Features Demonstrated:');
  console.log('   - Hierarchical context creation (project → sprint → task)');
  console.log('   - Context-scoped memory storage');
  console.log('   - Context-aware search');
  console.log('   - Chain navigation and traversal');
  console.log('   - Team collaboration organization');
  console.log('\n🎉 Example complete!\n');

  cortex.close();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

