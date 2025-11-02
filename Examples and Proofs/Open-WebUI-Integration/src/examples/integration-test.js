/**
 * Integration Test Script
 * 
 * Verifies that the Cortex Bridge is working correctly
 * Tests all API endpoints and features
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const BRIDGE_URL = process.env.CORTEX_BRIDGE_URL || 'http://localhost:3000';
const TEST_USER_ID = `test-user-${Date.now()}`;
const TEST_CONV_ID = `test-conv-${Date.now()}`;

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

async function test(name, fn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log(`   ✅ PASS\n`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`   ❌ FAIL: ${error.message}\n`);
  }
}

async function main() {
  console.log('========================================');
  console.log('Cortex Bridge Integration Tests');
  console.log('========================================\n');
  console.log(`Bridge URL: ${BRIDGE_URL}\n`);

  // ============================================================================
  // Health Check
  // ============================================================================
  await test('Health Check', async () => {
    const response = await fetch(`${BRIDGE_URL}/health`);
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (data.status !== 'healthy') throw new Error('Service not healthy');
    console.log(`   Status: ${data.status}`);
    console.log(`   Cortex: ${data.cortex}`);
  });

  // ============================================================================
  // Memory Operations
  // ============================================================================
  await test('Memory: Remember', async () => {
    const response = await fetch(`${BRIDGE_URL}/api/memory/remember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        conversationId: TEST_CONV_ID,
        userMessage: 'Test message for integration testing',
        agentResponse: 'Test response',
        importance: 5
      })
    });

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Remember failed');
    console.log(`   Conversation ID: ${data.conversationId}`);
    console.log(`   Memory ID: ${data.memoryId}`);
  });

  await test('Memory: Recall', async () => {
    const response = await fetch(`${BRIDGE_URL}/api/memory/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        query: 'test message',
        limit: 10
      })
    });

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Recall failed');
    console.log(`   Memories found: ${data.count}`);
  });

  // ============================================================================
  // User Operations
  // ============================================================================
  await test('Users: Create', async () => {
    const response = await fetch(`${BRIDGE_URL}/api/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        name: 'Test User',
        email: 'test@example.com',
        metadata: { test: true }
      })
    });

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('User creation failed');
    console.log(`   User ID: ${data.userId}`);
  });

  await test('Users: Get', async () => {
    const response = await fetch(`${BRIDGE_URL}/api/users/${TEST_USER_ID}`);

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (!data.success || !data.user) throw new Error('User retrieval failed');
    console.log(`   User: ${data.user.name}`);
  });

  // ============================================================================
  // Context Operations
  // ============================================================================
  await test('Contexts: Create', async () => {
    const response = await fetch(`${BRIDGE_URL}/api/contexts/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Project',
        memorySpaceId: TEST_USER_ID,
        description: 'Integration test project',
        metadata: { test: true }
      })
    });

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (!data.success || !data.context) throw new Error('Context creation failed');
    console.log(`   Context ID: ${data.context.id}`);
  });

  await test('Contexts: List', async () => {
    const response = await fetch(`${BRIDGE_URL}/api/contexts/${TEST_USER_ID}`);

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Context listing failed');
    console.log(`   Contexts found: ${data.contexts?.length || 0}`);
  });

  // ============================================================================
  // Agent Operations
  // ============================================================================
  await test('Agents: Register', async () => {
    const response = await fetch(`${BRIDGE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'test-agent',
        name: 'Test Agent',
        capabilities: ['testing'],
        metadata: { test: true }
      })
    });

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Agent registration failed');
    console.log(`   Agent ID: ${data.agentId}`);
  });

  await test('Agents: List', async () => {
    const response = await fetch(`${BRIDGE_URL}/api/agents`);

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Agent listing failed');
    console.log(`   Agents found: ${data.agents?.length || 0}`);
  });

  // ============================================================================
  // Facts Operations
  // ============================================================================
  await test('Facts: Extract', async () => {
    const response = await fetch(`${BRIDGE_URL}/api/facts/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Alice works at Acme Corp as a Senior Engineer',
        memorySpaceId: TEST_USER_ID,
        extractorType: 'llm'
      })
    });

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Facts extraction failed');
    console.log(`   Facts extracted: ${data.count}`);
  });

  await test('Facts: Query', async () => {
    const response = await fetch(`${BRIDGE_URL}/api/facts/${TEST_USER_ID}`);

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error('Facts query failed');
    console.log(`   Facts found: ${data.count}`);
  });

  // ============================================================================
  // Results
  // ============================================================================
  console.log('\n========================================');
  console.log('Test Results Summary');
  console.log('========================================\n');
  
  testResults.tests.forEach(test => {
    const icon = test.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });

  console.log(`\n📊 Total: ${testResults.passed + testResults.failed} tests`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);

  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! Integration is working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n💥 Test suite error:', error);
  process.exit(1);
});

