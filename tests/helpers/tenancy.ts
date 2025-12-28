/**
 * Multi-Tenancy Test Helpers
 *
 * Utilities for testing multi-tenant scenarios including:
 * - Tenant isolation verification
 * - Cross-tenant access prevention
 * - TenantId propagation across APIs
 */

import { Cortex } from "../../src";
import type { AuthContext } from "../../src/auth/types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Context Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TenantTestContext {
  tenantId: string;
  userId: string;
  memorySpaceId: string;
  cortex: Cortex;
  authContext: AuthContext;
}

export interface MultiTenantTestSetup {
  tenantA: TenantTestContext;
  tenantB: TenantTestContext;
  sharedMemorySpaceId?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tenant ID Generators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate unique tenant ID for testing
 */
export function generateTenantId(prefix = "tenant"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate multiple unique tenant IDs
 */
export function generateTenantIds(count: number, prefix = "tenant"): string[] {
  return Array.from({ length: count }, (_, i) =>
    generateTenantId(`${prefix}_${i}`)
  );
}

/**
 * Generate a test user ID scoped to a tenant
 */
export function generateTenantUserId(tenantId: string): string {
  return `user_${tenantId}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate a memory space ID scoped to a tenant
 */
export function generateTenantMemorySpaceId(tenantId: string): string {
  return `space_${tenantId}_${Math.random().toString(36).substring(2, 8)}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AuthContext Builders
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create an auth context for a tenant user
 */
export function createTenantAuthContext(
  tenantId: string,
  userId: string,
  options: {
    organizationId?: string;
    sessionId?: string;
    authProvider?: string;
    claims?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  } = {}
): AuthContext {
  return {
    userId,
    tenantId,
    organizationId: options.organizationId,
    sessionId: options.sessionId || `sess_${Date.now()}`,
    authProvider: options.authProvider || "test",
    authMethod: "jwt",
    authenticatedAt: Date.now(),
    claims: options.claims || {},
    metadata: options.metadata || {},
  };
}

/**
 * Create auth contexts for multiple tenants
 */
export function createMultiTenantAuthContexts(
  count: number
): Array<AuthContext & { tenantId: string }> {
  const tenantIds = generateTenantIds(count);
  return tenantIds.map((tenantId) => ({
    ...createTenantAuthContext(tenantId, generateTenantUserId(tenantId)),
    tenantId, // Ensure tenantId is included in returned type
  }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Setup Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a full tenant test context with Cortex instance
 */
export async function createTenantTestContext(
  convexUrl: string,
  tenantId?: string
): Promise<TenantTestContext> {
  const effectiveTenantId = tenantId || generateTenantId();
  const userId = generateTenantUserId(effectiveTenantId);
  const memorySpaceId = generateTenantMemorySpaceId(effectiveTenantId);

  const authContext = createTenantAuthContext(effectiveTenantId, userId);

  const cortex = new Cortex({
    convexUrl,
    auth: authContext,
  });

  return {
    tenantId: effectiveTenantId,
    userId,
    memorySpaceId,
    cortex,
    authContext,
  };
}

/**
 * Create a multi-tenant test setup with two isolated tenants
 */
export async function createMultiTenantTestSetup(
  convexUrl: string
): Promise<MultiTenantTestSetup> {
  const tenantA = await createTenantTestContext(convexUrl);
  const tenantB = await createTenantTestContext(convexUrl);

  return {
    tenantA,
    tenantB,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Isolation Verification
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Verify that data created by tenantA is not visible to tenantB
 */
export async function verifyTenantIsolation(
  tenantA: TenantTestContext,
  tenantB: TenantTestContext,
  options: {
    dataType: "conversations" | "memories" | "facts" | "users" | "immutable" | "mutable";
    recordId: string;
  }
): Promise<{
  isolated: boolean;
  details: string;
}> {
  const { dataType, recordId } = options;

  try {
    let result: unknown;

    switch (dataType) {
      case "conversations":
        result = await tenantB.cortex.conversations.get(recordId);
        break;

      case "memories":
        const memories = await tenantB.cortex.memory.list({
          memorySpaceId: tenantA.memorySpaceId,
          limit: 100,
        });
        result = (memories as { memoryId: string }[]).find((m) => m.memoryId === recordId);
        break;

      case "facts":
        const facts = await tenantB.cortex.facts.list({
          memorySpaceId: tenantA.memorySpaceId,
          limit: 100,
        });
        result = facts.find((f: { factId: string }) => f.factId === recordId);
        break;

      case "users":
        result = await tenantB.cortex.users.get(recordId);
        break;

      case "immutable":
        result = await tenantB.cortex.immutable.get(
          tenantA.memorySpaceId,
          recordId
        );
        break;

      case "mutable":
        result = await tenantB.cortex.mutable.get(
          tenantA.memorySpaceId,
          recordId
        );
        break;

      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }

    // If we got data, isolation failed
    if (result !== null && result !== undefined) {
      return {
        isolated: false,
        details: `TenantB could access TenantA's ${dataType} record: ${recordId}`,
      };
    }

    return {
      isolated: true,
      details: `TenantB correctly cannot access TenantA's ${dataType} record`,
    };
  } catch (error) {
    // Access denied errors indicate proper isolation
    if (
      error instanceof Error &&
      (error.message.includes("not found") ||
        error.message.includes("access denied") ||
        error.message.includes("unauthorized"))
    ) {
      return {
        isolated: true,
        details: `Access properly denied: ${error.message}`,
      };
    }

    // Other errors might indicate issues
    return {
      isolated: false,
      details: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Data Fixtures
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create test data for a tenant
 */
export interface TenantTestData {
  conversationId?: string;
  memoryIds?: string[];
  factIds?: string[];
  immutableIds?: string[];
  mutableKeys?: string[];
}

/**
 * Seed test data for a tenant
 */
export async function seedTenantTestData(
  context: TenantTestContext,
  options: {
    conversations?: number;
    memories?: number;
    facts?: number;
    immutableRecords?: number;
    mutableRecords?: number;
  } = {}
): Promise<TenantTestData> {
  const data: TenantTestData = {};
  const {
    conversations = 0,
    memories = 0,
    facts = 0,
    immutableRecords = 0,
    mutableRecords = 0,
  } = options;

  // Create conversations
  if (conversations > 0) {
    const conv = await context.cortex.conversations.create({
      memorySpaceId: context.memorySpaceId,
      type: "user-agent",
      participants: { userId: context.userId, agentId: `agent_${context.tenantId}` },
    });
    data.conversationId = conv.conversationId;
  }

  // Create memories
  if (memories > 0) {
    data.memoryIds = [];
    for (let i = 0; i < memories; i++) {
      const result = await context.cortex.memory.remember({
        memorySpaceId: context.memorySpaceId,
        conversationId: data.conversationId || `conv_${i}`,
        userMessage: `Test memory ${i} for tenant ${context.tenantId}`,
        agentResponse: `Response ${i}`,
        userId: context.userId,
      });
      if (result.memories[0]) {
        data.memoryIds.push(result.memories[0]._id);
      }
    }
  }

  // Create facts
  if (facts > 0) {
    data.factIds = [];
    for (let i = 0; i < facts; i++) {
      const fact = await context.cortex.facts.store({
        memorySpaceId: context.memorySpaceId,
        fact: `Test fact ${i}: Tenant ${context.tenantId} has property ${i}`,
        factType: "knowledge",
        confidence: 85,
        sourceType: "manual",
        userId: context.userId,
      });
      data.factIds.push(fact.factId);
    }
  }

  // Create immutable records
  if (immutableRecords > 0) {
    data.immutableIds = [];
    for (let i = 0; i < immutableRecords; i++) {
      const result = await context.cortex.immutable.store({
        type: "test",
        id: `test_key_${i}_${Date.now()}`,
        data: { data: `Test data ${i}`, tenant: context.tenantId },
        metadata: { index: i },
      });
      data.immutableIds.push(result.id);
    }
  }

  // Create mutable records
  if (mutableRecords > 0) {
    data.mutableKeys = [];
    for (let i = 0; i < mutableRecords; i++) {
      const key = `mutable_${i}`;
      await context.cortex.mutable.set(
        context.memorySpaceId,
        key,
        { data: `Mutable data ${i}`, tenant: context.tenantId }
      );
      data.mutableKeys.push(key);
    }
  }

  return data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cleanup Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Clean up test data for a tenant
 */
export async function cleanupTenantTestData(
  context: TenantTestContext,
  data: TenantTestData
): Promise<void> {
  // Clean up in reverse order of dependencies

  // Delete mutable records
  if (data.mutableKeys) {
    for (const key of data.mutableKeys) {
      try {
        await context.cortex.mutable.delete(context.memorySpaceId, key);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  // Delete immutable records (if purge is supported)
  // Note: Immutable records typically can't be deleted

  // Delete facts
  if (data.factIds) {
    for (const factId of data.factIds) {
      try {
        await context.cortex.facts.delete(context.memorySpaceId, factId);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  // Delete memories - use deleteMany with userId filter or delete individually
  if (data.memoryIds && data.memoryIds.length > 0) {
    try {
      // deleteMany works with filters, not specific IDs
      // For test cleanup, we delete by userId which should clean up test memories
      await context.cortex.memory.deleteMany({
        memorySpaceId: context.memorySpaceId,
        userId: context.userId,
      });
    } catch {
      // Ignore cleanup errors
    }
  }

  // Delete conversation
  if (data.conversationId) {
    try {
      await context.cortex.conversations.delete(data.conversationId);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Assertion Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Assert that a record has the expected tenantId
 */
export function assertTenantId(
  record: { tenantId?: string },
  expectedTenantId: string
): void {
  if (record.tenantId !== expectedTenantId) {
    throw new Error(
      `TenantId mismatch: expected ${expectedTenantId}, got ${record.tenantId}`
    );
  }
}

/**
 * Assert that all records in a list belong to the expected tenant
 */
export function assertAllRecordsHaveTenantId(
  records: Array<{ tenantId?: string }>,
  expectedTenantId: string
): void {
  const mismatched = records.filter((r) => r.tenantId !== expectedTenantId);
  if (mismatched.length > 0) {
    throw new Error(
      `${mismatched.length} records have incorrect tenantId. Expected: ${expectedTenantId}`
    );
  }
}

/**
 * Assert that no records from another tenant are present
 */
export function assertNoTenantLeakage(
  records: Array<{ tenantId?: string }>,
  forbiddenTenantId: string
): void {
  const leaked = records.filter((r) => r.tenantId === forbiddenTenantId);
  if (leaked.length > 0) {
    throw new Error(
      `Tenant isolation breach: ${leaked.length} records from tenant ${forbiddenTenantId} leaked`
    );
  }
}
