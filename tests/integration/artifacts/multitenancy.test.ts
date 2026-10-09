/**
 * Artifacts API - Multi-tenancy Integration Tests
 *
 * Tests tenant isolation for artifacts:
 * - Artifact isolation between tenants
 * - Cross-tenant access prevention
 * - Global artifacts (no tenant) behavior
 * - List isolation by tenant
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 *
 * Test IDs: INT-MT-001, INT-MT-002
 */

import { expectRefusalNoEffects } from "../../helpers/public-contract";
import { createRuntimeFixture } from "../../helpers/runtime-fixture";
const runtimeFixtures: Array<Awaited<ReturnType<typeof createRuntimeFixture>>> =
  [];
import { Cortex } from "../../../src";
import { createNamedTestRunContext } from "../../helpers/isolation";
import {
  generateTenantId,
  generateTenantUserId,
  generateTenantMemorySpaceId,
  createTenantAuthContext,
  TenantTestContext,
} from "../../helpers/tenancy";

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Artifacts Multi-tenancy Integration", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("artifacts-multitenancy");
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Tenant contexts
  let tenantA: TenantTestContext;
  let tenantB: TenantTestContext;
  let countCortexA: Cortex;
  let countCortexB: Cortex;
  let globalCortex: Cortex; // No tenant context

  // Track created spaces for cleanup
  const createdSpaces: Array<{ spaceId: string; cortex: Cortex }> = [];

  // Helper to setup tenant test context
  const setupTenantContext = async (
    name: string,
  ): Promise<TenantTestContext> => {
    const tenantId = generateTenantId(`${ctx.runId}-${name}`);
    const userId = generateTenantUserId(tenantId);
    const memorySpaceId = generateTenantMemorySpaceId(tenantId);
    const authContext = createTenantAuthContext(tenantId, userId);

    const fixture = await createRuntimeFixture(
      tenantId,
      memorySpaceId,
      userId,
      { enabled: false },
      { registerSpaces: false },
    );
    runtimeFixtures.push(fixture);
    const cortex = new Cortex(
      {
        convexUrl: CONVEX_URL,
        auth: authContext,
        resilience: { enabled: false },
      },
      { initializeTransport: fixture.initializeTransport },
    );

    // Register memory space for this tenant
    await cortex.memorySpaces.register({
      memorySpaceId,
      name: `${name} Test Space`,
      type: "project",
    });

    createdSpaces.push({ spaceId: memorySpaceId, cortex });

    return {
      tenantId,
      userId,
      memorySpaceId,
      cortex,
      authContext,
    };
  };

  beforeAll(async () => {
    console.log(
      `\n🧪 Artifacts Multi-tenancy Integration Tests - Run ID: ${ctx.runId}\n`,
    );

    // Setup two separate tenant contexts
    tenantA = await setupTenantContext("tenant-a");
    tenantB = await setupTenantContext("tenant-b");

    const countA = await createRuntimeFixture(
      tenantA.tenantId,
      `${ctx.runId}-count-space-a`,
      tenantA.userId,
      { enabled: false },
      { registerSpaces: false },
    );
    const countB = await createRuntimeFixture(
      tenantB.tenantId,
      `${ctx.runId}-count-space-b`,
      tenantB.userId,
      { enabled: false },
      { registerSpaces: false },
    );
    runtimeFixtures.push(countA, countB);
    countCortexA = countA.cortex;
    countCortexB = countB.cortex;

    // Setup global context (no tenant)
    globalCortex = new Cortex({ convexUrl: CONVEX_URL });

    console.log(`   Tenant A: ${tenantA.tenantId}`);
    console.log(`   Tenant B: ${tenantB.tenantId}`);
    console.log("✅ Multi-tenant test isolation setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);

    try {
      // Cleanup all memory spaces
      for (const { spaceId, cortex } of createdSpaces) {
        try {
          await cortex.memorySpaces.delete(spaceId, {
            cascade: true,
            reason: "Test cleanup",
          });
        } catch {
          // Public erasure requires an explicit transport.
        }
      }
    } finally {
      await Promise.all([
        ...runtimeFixtures.map((fixture) => fixture.close()),
        tenantA?.cortex.shutdown(),
        tenantB?.cortex.shutdown(),
        globalCortex?.shutdown(),
      ]);
    }

    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-MT-001: Tenant Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-MT-001: Tenant isolation", () => {
    it("should prevent Tenant B from accessing Tenant A artifacts", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "Tenant A secret data - should not be visible to Tenant B",
        title: "Confidential Document",
      });

      expect(artifact.artifactId).toBeDefined();

      // Tenant B cannot get it
      await expectRefusalNoEffects(
        () => tenantB.cortex.artifacts.get(artifact.artifactId),
        runtimeFixtures,
        "artifacts",
        "FORBIDDEN",
      );
    });

    it("should prevent Tenant B from updating Tenant A artifacts", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "Original content",
        title: "Update Prevention Test",
      });

      // Tenant B cannot update it
      await expect(
        tenantB.cortex.artifacts.update(artifact.artifactId, "Hacked content!"),
      ).rejects.toThrow("FORBIDDEN");

      // Verify content is unchanged
      const original = await tenantA.cortex.artifacts.get(artifact.artifactId);
      expect(original?.content).toBe("Original content");
    });

    it("should prevent Tenant B from deleting Tenant A artifacts", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "Important document",
        title: "Delete Prevention Test",
      });

      // Tenant B cannot delete it
      await expect(
        tenantB.cortex.artifacts.delete(artifact.artifactId),
      ).rejects.toThrow("FORBIDDEN");

      // Verify artifact still exists for Tenant A
      const stillExists = await tenantA.cortex.artifacts.get(
        artifact.artifactId,
      );
      expect(stillExists).not.toBeNull();
      expect(stillExists?.content).toBe("Important document");
    });

    it("should isolate list results by tenant", async () => {
      // Use unique marker to identify test artifacts
      const testMarker = `list-isolation-${ctx.runId}`;

      // Both tenants create artifacts in their own spaces
      const _artA1 = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: `Tenant A artifact 1 - ${testMarker}`,
        title: "Tenant A Artifact 1",
      });

      const _artA2 = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: `Tenant A artifact 2 - ${testMarker}`,
        title: "Tenant A Artifact 2",
      });

      const _artB1 = await tenantB.cortex.artifacts.create({
        memorySpaceId: tenantB.memorySpaceId,
        kind: "text",
        content: `Tenant B artifact 1 - ${testMarker}`,
        title: "Tenant B Artifact 1",
      });

      // Tenant A only sees their own (filter by test marker to avoid stale data)
      const listA = await tenantA.cortex.artifacts.list({
        memorySpaceId: tenantA.memorySpaceId,
      });

      // Check that we can find our test artifacts
      const testArtifactsA = listA.filter((a) =>
        a.content?.includes(testMarker),
      );
      expect(testArtifactsA.length).toBe(2);
      expect(testArtifactsA.every((a) => a.content?.includes("Tenant A"))).toBe(
        true,
      );

      // Among test artifacts, ensure no Tenant B artifacts appear
      expect(testArtifactsA.some((a) => a.content?.includes("Tenant B"))).toBe(
        false,
      );

      // Tenant B only sees their own
      const listB = await tenantB.cortex.artifacts.list({
        memorySpaceId: tenantB.memorySpaceId,
      });

      // Check that we can find our test artifact
      const testArtifactsB = listB.filter((a) =>
        a.content?.includes(testMarker),
      );
      expect(testArtifactsB.length).toBe(1);
      expect(testArtifactsB.every((a) => a.content?.includes("Tenant B"))).toBe(
        true,
      );

      // Among test artifacts, ensure no Tenant A artifacts appear
      expect(testArtifactsB.some((a) => a.content?.includes("Tenant A"))).toBe(
        false,
      );
    });

    it("should isolate count by tenant", async () => {
      // Create specific artifacts for counting
      const spaceIdA = `${ctx.runId}-count-space-a`;
      const spaceIdB = `${ctx.runId}-count-space-b`;

      await countCortexA.memorySpaces.register({
        memorySpaceId: spaceIdA,
        name: "Count Test A",
        type: "project",
      });
      createdSpaces.push({ spaceId: spaceIdA, cortex: countCortexA });

      await countCortexB.memorySpaces.register({
        memorySpaceId: spaceIdB,
        name: "Count Test B",
        type: "project",
      });
      createdSpaces.push({ spaceId: spaceIdB, cortex: countCortexB });

      // Create 3 artifacts for A, 1 for B
      for (let i = 0; i < 3; i++) {
        await countCortexA.artifacts.create({
          memorySpaceId: spaceIdA,
          kind: "text",
          content: `A count test ${i}`,
          title: `Count Test A-${i}`,
        });
      }

      await countCortexB.artifacts.create({
        memorySpaceId: spaceIdB,
        kind: "text",
        content: "B count test",
        title: "Count Test B",
      });

      const countA = await countCortexA.artifacts.count({
        memorySpaceId: spaceIdA,
      });
      const countB = await countCortexB.artifacts.count({
        memorySpaceId: spaceIdB,
      });

      expect(countA).toBe(3);
      expect(countB).toBe(1);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-MT-002: Global Artifacts (No Tenant) Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-MT-002: Global artifacts isolation", () => {
    let globalSpaceId: string;

    beforeAll(async () => {
      globalSpaceId = `${ctx.runId}-global-space`;
      await expect(
        globalCortex.memorySpaces.register({
          memorySpaceId: globalSpaceId,
          name: "Global Test Space",
          type: "project",
        }),
      ).rejects.toThrow("UNAUTHENTICATED");
    });

    it("should create global artifacts without tenant context", async () => {
      await expectRefusalNoEffects(
        () =>
          globalCortex.artifacts.create({
            memorySpaceId: globalSpaceId,
            kind: "text",
            content: "Global content - no tenant",
            title: "Unprovisioned global artifact",
          }),
        runtimeFixtures,
        "artifacts",
        "UNAUTHENTICATED",
      );
    });

    it("should isolate global artifacts from tenant artifacts", async () => {
      const artifact = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "Owned tenant data",
        title: "Global isolation",
      });
      await expectRefusalNoEffects(
        () => globalCortex.artifacts.get(artifact.artifactId),
        runtimeFixtures,
        "artifacts",
        "UNAUTHENTICATED",
      );
      await expectRefusalNoEffects(
        () => tenantB.cortex.artifacts.get(artifact.artifactId),
        runtimeFixtures,
        "artifacts",
        "FORBIDDEN",
      );
      expect(
        (await tenantA.cortex.artifacts.get(artifact.artifactId))?.content,
      ).toBe("Owned tenant data");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Streaming Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Streaming operations tenant isolation", () => {
    it("should prevent Tenant B from streaming to Tenant A artifact", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "",
        title: "Streaming Isolation Test",
        streamingState: "draft",
      });

      // Tenant A starts streaming
      const { sessionId } = await tenantA.cortex.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      // Tenant B cannot append to it (even with session ID)
      await expect(
        tenantB.cortex.artifacts.appendContent({
          artifactId: artifact.artifactId,
          sessionId,
          chunk: "Malicious content",
        }),
      ).rejects.toThrow("FORBIDDEN");

      // Tenant B cannot finalize it
      await expect(
        tenantB.cortex.artifacts.finalizeStreaming({
          artifactId: artifact.artifactId,
          sessionId,
        }),
      ).rejects.toThrow("FORBIDDEN");

      // Cleanup - Tenant A finalizes
      await tenantA.cortex.artifacts.cancelStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });
    });

    it("should prevent Tenant B from starting streaming on Tenant A artifact", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "",
        title: "Start Streaming Prevention Test",
        streamingState: "draft",
      });

      // Tenant B cannot start streaming
      await expect(
        tenantB.cortex.artifacts.startStreaming({
          artifactId: artifact.artifactId,
        }),
      ).rejects.toThrow("FORBIDDEN");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Version History Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Version history tenant isolation", () => {
    it("should prevent Tenant B from viewing Tenant A version history", async () => {
      // Tenant A creates and updates artifact
      const artifact = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "v1 - secret",
        title: "History Isolation Test",
      });

      await tenantA.cortex.artifacts.update(
        artifact.artifactId,
        "v2 - also secret",
      );

      // Tenant A can see history
      const historyA = await tenantA.cortex.artifacts.getHistory(
        artifact.artifactId,
      );
      expect(historyA.length).toBe(2);

      // Tenant B gets empty history (artifact not accessible to them)
      // This behavior prevents tenant B from learning whether the artifact exists
      await expectRefusalNoEffects(
        () => tenantB.cortex.artifacts.getHistory(artifact.artifactId),
        runtimeFixtures,
        "artifacts",
        "FORBIDDEN",
      );
    });

    it("should prevent Tenant B from undo/redo on Tenant A artifacts", async () => {
      // Tenant A creates and updates
      const artifact = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "v1",
        title: "Undo Redo Isolation Test",
      });

      await tenantA.cortex.artifacts.update(artifact.artifactId, "v2");

      // Tenant B cannot undo
      await expect(
        tenantB.cortex.artifacts.undo(artifact.artifactId),
      ).rejects.toThrow("FORBIDDEN");

      // Tenant A can undo
      await tenantA.cortex.artifacts.undo(artifact.artifactId);

      // Tenant B cannot redo
      await expect(
        tenantB.cortex.artifacts.redo(artifact.artifactId),
      ).rejects.toThrow("FORBIDDEN");
    });

    it("should prevent Tenant B from getting specific version of Tenant A artifact", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "Secret version 1",
        title: "Version Isolation Test",
      });

      // Tenant A can get version
      const v1A = await tenantA.cortex.artifacts.getVersion(
        artifact.artifactId,
        1,
      );
      expect(v1A?.content).toBe("Secret version 1");

      // Tenant B cannot get version
      await expectRefusalNoEffects(
        () => tenantB.cortex.artifacts.getVersion(artifact.artifactId, 1),
        runtimeFixtures,
        "artifacts",
        "FORBIDDEN",
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Concurrent Multi-Tenant Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Concurrent multi-tenant operations", () => {
    it("should handle concurrent artifact creation from multiple tenants", async () => {
      // Both tenants create artifacts simultaneously
      const [artifactA, artifactB] = await Promise.all([
        tenantA.cortex.artifacts.create({
          memorySpaceId: tenantA.memorySpaceId,
          kind: "text",
          content: "Concurrent A",
          title: "Concurrent A Test",
        }),
        tenantB.cortex.artifacts.create({
          memorySpaceId: tenantB.memorySpaceId,
          kind: "text",
          content: "Concurrent B",
          title: "Concurrent B Test",
        }),
      ]);

      expect(artifactA.artifactId).not.toBe(artifactB.artifactId);

      // Each tenant can only see their own
      const resultA = await tenantA.cortex.artifacts.get(artifactA.artifactId);
      expect(resultA?.content).toBe("Concurrent A");

      const resultB = await tenantB.cortex.artifacts.get(artifactB.artifactId);
      expect(resultB?.content).toBe("Concurrent B");

      // Cross-access fails
      await expectRefusalNoEffects(
        () => tenantA.cortex.artifacts.get(artifactB.artifactId),
        runtimeFixtures,
        "artifacts",
        "FORBIDDEN",
      );

      await expectRefusalNoEffects(
        () => tenantB.cortex.artifacts.get(artifactA.artifactId),
        runtimeFixtures,
        "artifacts",
        "FORBIDDEN",
      );
    });

    it("should handle concurrent updates from multiple tenants on their own artifacts", async () => {
      // Each tenant creates their artifact
      const artifactA = await tenantA.cortex.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "A initial",
        title: "Concurrent Update A",
      });

      const artifactB = await tenantB.cortex.artifacts.create({
        memorySpaceId: tenantB.memorySpaceId,
        kind: "text",
        content: "B initial",
        title: "Concurrent Update B",
      });

      // Concurrent updates
      await Promise.all([
        tenantA.cortex.artifacts.update(artifactA.artifactId, "A updated"),
        tenantB.cortex.artifacts.update(artifactB.artifactId, "B updated"),
      ]);

      // Verify both updates succeeded
      const finalA = await tenantA.cortex.artifacts.get(artifactA.artifactId);
      expect(finalA?.content).toBe("A updated");

      const finalB = await tenantB.cortex.artifacts.get(artifactB.artifactId);
      expect(finalB?.content).toBe("B updated");
    });
  });
});
