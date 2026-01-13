/**
 * Integration Tests - Fact Supersession Behavior
 *
 * Tests validate the expected behavior when:
 * 1. Same fact is stated multiple times (should deduplicate, not supersede)
 * 2. A fact is updated/changed (should supersede old fact)
 *
 * This test helps diagnose issues where facts create unnecessary
 * supersession chains instead of properly deduplicating identical statements.
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";
import type { FactRecord } from "../src/types";

/**
 * Helper to log fact state for debugging
 */
function logFactState(
  phase: string,
  iteration: number,
  activeFacts: FactRecord[],
  allFacts: FactRecord[],
): void {
  console.log(`\n${phase}, Iteration ${iteration}:`);
  console.log(`  - Active facts: ${activeFacts.length}`);
  console.log(`  - Total facts (incl. superseded): ${allFacts.length}`);
  console.log(
    `  - Superseded facts: ${allFacts.filter((f) => f.supersededBy).length}`,
  );

  if (activeFacts.length > 0) {
    console.log(`  - Active fact details:`);
    activeFacts.forEach((f, i) => {
      console.log(`    [${i}] factId: ${f.factId}`);
      console.log(`        fact: "${f.fact}"`);
      console.log(`        object: ${f.object}`);
      console.log(`        supersededBy: ${f.supersededBy || "none"}`);
      console.log(`        validUntil: ${f.validUntil || "none"}`);
    });
  }

  if (allFacts.length > activeFacts.length) {
    const supersededFacts = allFacts.filter((f) => f.supersededBy);
    console.log(`  - Superseded fact details:`);
    supersededFacts.forEach((f, i) => {
      console.log(`    [${i}] factId: ${f.factId}`);
      console.log(`        fact: "${f.fact}"`);
      console.log(`        supersededBy: ${f.supersededBy}`);
      console.log(`        validUntil: ${f.validUntil}`);
    });
  }
}

describe("Fact Supersession Behavior", () => {
  const ctx = createNamedTestRunContext("supersession-behavior");
  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  const TEST_MEMSPACE_ID = ctx.memorySpaceId("test");
  const TEST_USER_ID = ctx.userId("user");

  beforeAll(async () => {
    console.log(
      `\n🧪 Fact Supersession Behavior Tests - Run ID: ${ctx.runId}\n`,
    );

    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    scopedCleanup = new ScopedCleanup(client, ctx);

    // Create test memory space
    await cortex.memorySpaces.register({
      memorySpaceId: TEST_MEMSPACE_ID,
      type: "personal",
    });

    console.log("✅ Test setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);
    await scopedCleanup.cleanupAll();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  /**
   * Helper to get active facts (excludes superseded)
   */
  async function getActiveFacts(): Promise<FactRecord[]> {
    return cortex.facts.list({
      memorySpaceId: TEST_MEMSPACE_ID,
      predicate: "favorite color",
    });
  }

  /**
   * Helper to get ALL facts including superseded ones
   */
  async function getAllFacts(): Promise<FactRecord[]> {
    return cortex.facts.list({
      memorySpaceId: TEST_MEMSPACE_ID,
      predicate: "favorite color",
      includeSuperseded: true,
    });
  }

  describe("Phase 1: Repeated Identical Statements (5x)", () => {
    it("should deduplicate identical facts, not create supersession chain", async () => {
      console.log("\n📝 Phase 1: Stating 'I like the color blue' 5 times...\n");

      const results: Array<{
        iteration: number;
        action: string;
        factId: string;
        activeCount: number;
        totalCount: number;
      }> = [];

      for (let i = 1; i <= 5; i++) {
        // State the same fact
        const result = await cortex.facts.revise({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: {
            fact: "User likes the color blue",
            factType: "preference",
            subject: TEST_USER_ID,
            predicate: "favorite color",
            object: "blue",
            confidence: 90,
          },
        });

        // Check state after each statement
        const activeFacts = await getActiveFacts();
        const allFacts = await getAllFacts();

        logFactState("Phase 1", i, activeFacts, allFacts);

        results.push({
          iteration: i,
          action: result.action,
          factId: result.fact.factId,
          activeCount: activeFacts.length,
          totalCount: allFacts.length,
        });

        // Assertions for each iteration
        // After the first statement, we should have exactly 1 fact
        // Subsequent statements should NOT create new facts
        if (i === 1) {
          expect(activeFacts.length).toBe(1);
          expect(allFacts.length).toBe(1);
          expect(result.action).toBe("ADD");
        } else {
          // On subsequent iterations, expecting NONE (duplicate detected)
          // or at worst UPDATE (same fact updated)
          // But NOT ADD or SUPERSEDE
          expect(activeFacts.length).toBe(1);
          expect(allFacts.length).toBe(1);
          // The action should be NONE for duplicate detection
          expect(["NONE", "UPDATE"]).toContain(result.action);
        }
      }

      // Final summary
      console.log("\n📊 Phase 1 Results Summary:");
      console.table(results);

      // Final assertions
      const finalActive = await getActiveFacts();
      const finalAll = await getAllFacts();

      expect(finalActive.length).toBe(1);
      expect(finalAll.length).toBe(1);
      expect(finalActive[0].supersededBy).toBeUndefined();
      expect(finalActive[0].validUntil).toBeUndefined();
    });
  });

  describe("Phase 2: Retrieval Queries (5x)", () => {
    it("should not create facts when querying", async () => {
      console.log('\n🔍 Phase 2: Asking "What\'s my favorite color?" 5 times...\n');

      // Get baseline state
      const baselineActive = await getActiveFacts();
      const baselineAll = await getAllFacts();

      console.log(
        `Baseline: ${baselineActive.length} active, ${baselineAll.length} total`,
      );

      for (let i = 1; i <= 5; i++) {
        // Query facts (this is a read operation)
        const activeFacts = await getActiveFacts();
        const allFacts = await getAllFacts();

        logFactState("Phase 2", i, activeFacts, allFacts);

        // Verify no change from baseline
        expect(activeFacts.length).toBe(baselineActive.length);
        expect(allFacts.length).toBe(baselineAll.length);

        // Verify the active fact is still the blue preference
        expect(activeFacts[0].object).toBe("blue");
        expect(activeFacts[0].supersededBy).toBeUndefined();
      }

      console.log("\n✅ Phase 2 complete - no new facts created during queries");
    });
  });

  describe("Phase 3: Preference Update (1x)", () => {
    it("should supersede old fact when preference changes", async () => {
      console.log('\n🔄 Phase 3: Stating "I like purple better now"...\n');

      // Get state before update
      const beforeActive = await getActiveFacts();
      const beforeAll = await getAllFacts();
      const blueFact = beforeActive[0];

      console.log(`Before update: ${beforeActive.length} active, ${beforeAll.length} total`);
      console.log(`Blue fact ID: ${blueFact.factId}`);

      // State the NEW preference
      const result = await cortex.facts.revise({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: {
          fact: "User prefers purple",
          factType: "preference",
          subject: TEST_USER_ID,
          predicate: "favorite color",
          object: "purple",
          confidence: 95,
        },
      });

      console.log(`\nRevise result: action=${result.action}, factId=${result.fact.factId}`);

      // Get state after update
      const afterActive = await getActiveFacts();
      const afterAll = await getAllFacts();

      logFactState("Phase 3", 1, afterActive, afterAll);

      // Assertions
      // Should have 1 active fact (purple) and 2 total (purple + superseded blue)
      expect(afterActive.length).toBe(1);
      expect(afterAll.length).toBe(2);

      // The action should be SUPERSEDE
      expect(result.action).toBe("SUPERSEDE");

      // The active fact should be purple
      expect(afterActive[0].object).toBe("purple");
      expect(afterActive[0].supersededBy).toBeUndefined();
      expect(afterActive[0].validUntil).toBeUndefined();

      // The blue fact should be superseded
      const supersededBlueFact = afterAll.find((f) => f.object === "blue");
      expect(supersededBlueFact).toBeDefined();
      expect(supersededBlueFact?.supersededBy).toBe(result.fact.factId);
      expect(supersededBlueFact?.validUntil).toBeDefined();

      console.log("\n✅ Phase 3 complete - old fact superseded correctly");
    });
  });

  describe("Phase 4: Post-Update Retrieval (5x)", () => {
    it("should consistently return updated preference", async () => {
      console.log('\n🔍 Phase 4: Asking "What\'s my favorite color?" 5 times after update...\n');

      for (let i = 1; i <= 5; i++) {
        const activeFacts = await getActiveFacts();
        const allFacts = await getAllFacts();

        logFactState("Phase 4", i, activeFacts, allFacts);

        // Should always have exactly 1 active fact (purple)
        expect(activeFacts.length).toBe(1);
        expect(activeFacts[0].object).toBe("purple");

        // Should have exactly 2 total facts (purple active, blue superseded)
        expect(allFacts.length).toBe(2);

        // Verify supersession chain
        const purpleFact = allFacts.find((f) => f.object === "purple");
        const blueFact = allFacts.find((f) => f.object === "blue");

        expect(purpleFact?.supersededBy).toBeUndefined();
        expect(purpleFact?.supersedes).toBe(blueFact?.factId);
        expect(blueFact?.supersededBy).toBe(purpleFact?.factId);
      }

      console.log("\n✅ Phase 4 complete - consistent state across retrievals");
    });
  });

  describe("Full Scenario Summary", () => {
    it("should have clean final state", async () => {
      console.log("\n📊 Final State Summary\n");

      const activeFacts = await getActiveFacts();
      const allFacts = await getAllFacts();

      console.log("Active facts:", activeFacts.length);
      console.log("Total facts (including superseded):", allFacts.length);

      // Print full fact details
      console.log("\nAll facts in detail:");
      allFacts.forEach((f, i) => {
        console.log(`\n[${i}] ${f.factId}`);
        console.log(`    fact: "${f.fact}"`);
        console.log(`    object: ${f.object}`);
        console.log(`    createdAt: ${new Date(f.createdAt).toISOString()}`);
        console.log(`    supersedes: ${f.supersedes || "none"}`);
        console.log(`    supersededBy: ${f.supersededBy || "none"}`);
        console.log(`    validFrom: ${f.validFrom ? new Date(f.validFrom).toISOString() : "none"}`);
        console.log(`    validUntil: ${f.validUntil ? new Date(f.validUntil).toISOString() : "none"}`);
      });

      // Final assertions
      expect(activeFacts.length).toBe(1);
      expect(activeFacts[0].object).toBe("purple");
      expect(allFacts.length).toBe(2);

      // Check supersession chain is clean (depth of 1)
      const supersededFacts = allFacts.filter((f) => f.supersededBy);
      expect(supersededFacts.length).toBe(1);

      // The superseded fact should be blue
      expect(supersededFacts[0].object).toBe("blue");
    });
  });
});
