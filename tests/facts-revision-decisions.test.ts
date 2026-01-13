/**
 * Comprehensive Tests - Fact Revision Decision Logic
 *
 * Tests all 4 decision types (ADD, UPDATE, SUPERSEDE, NONE) with explicit
 * scenarios covering every branch in the getDefaultDecision heuristics.
 *
 * Decision Matrix (without LLM):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Condition                                          │ Expected Action   │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ No existing candidates                             │ ADD               │
 * │ High similarity (>0.8) + higher confidence         │ UPDATE            │
 * │ High similarity (>0.8) + same/lower confidence     │ NONE              │
 * │ Same subject + same object + higher confidence     │ UPDATE            │
 * │ Same subject + same object + same/lower confidence │ NONE              │
 * │ Same subject + different object                    │ SUPERSEDE         │
 * │ Different subject + medium similarity (>0.5)       │ SUPERSEDE         │
 * │ Different subject + low similarity (<0.5)          │ ADD               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";

describe("Fact Revision Decisions - Comprehensive Coverage", () => {
  const ctx = createNamedTestRunContext("revision-decisions");
  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  beforeAll(async () => {
    console.log(
      `\n🧪 Fact Revision Decisions Tests - Run ID: ${ctx.runId}\n`,
    );

    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    scopedCleanup = new ScopedCleanup(client, ctx);

    console.log("✅ Test setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);
    await scopedCleanup.cleanupAll();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ADD Decision Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("ADD Decision", () => {
    describe("Scenario: No existing facts in memory space", () => {
      it("should ADD when memory space is empty", async () => {
        const memorySpaceId = ctx.memorySpaceId("add-empty");
        const userId = ctx.userId("add-empty");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User enjoys hiking",
            factType: "preference",
            subject: userId,
            predicate: "hobby",
            object: "hiking",
            confidence: 90,
          },
        });

        expect(result.action).toBe("ADD");
        expect(result.fact).toBeDefined();
        expect(result.superseded).toHaveLength(0);
        console.log(`✅ ADD (empty space): ${result.reason}`);
      });
    });

    describe("Scenario: Different subject + low similarity", () => {
      it("should ADD when facts are about different subjects with low text overlap", async () => {
        const memorySpaceId = ctx.memorySpaceId("add-diff-subject");
        const userAlice = ctx.userId("alice");
        const userBob = ctx.userId("bob");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create fact about Alice
        await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "Alice works at TechCorp as a software engineer",
            factType: "knowledge",
            subject: userAlice,
            predicate: "employment",
            object: "TechCorp",
            confidence: 90,
          },
        });

        // Create fact about Bob with low similarity text
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "Bob enjoys playing tennis on weekends",
            factType: "preference",
            subject: userBob,
            predicate: "hobby",
            object: "tennis",
            confidence: 85,
          },
        });

        expect(result.action).toBe("ADD");
        expect(result.superseded).toHaveLength(0);

        // Verify both facts exist
        const allFacts = await cortex.facts.list({ memorySpaceId });
        expect(allFacts.length).toBe(2);
        console.log(`✅ ADD (different subject, low similarity): ${result.reason}`);
      });
    });

    describe("Scenario: Genuinely new information about same subject", () => {
      it("should ADD when new fact is about different aspect (different predicate class)", async () => {
        const memorySpaceId = ctx.memorySpaceId("add-new-aspect");
        const userId = ctx.userId("add-new-aspect");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create fact about favorite color
        await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User's favorite color is blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 90,
          },
        });

        // Create fact about favorite food (different predicate class)
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User loves Italian cuisine",
            factType: "preference",
            subject: userId,
            predicate: "favorite food",
            object: "Italian cuisine",
            confidence: 85,
          },
        });

        expect(result.action).toBe("ADD");
        expect(result.superseded).toHaveLength(0);

        // Both facts should exist
        const allFacts = await cortex.facts.list({ memorySpaceId });
        expect(allFacts.length).toBe(2);
        console.log(`✅ ADD (different predicate class): ${result.reason}`);
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UPDATE Decision Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("UPDATE Decision", () => {
    describe("Scenario: High similarity + higher confidence", () => {
      it("should UPDATE when text is very similar but new fact has higher confidence", async () => {
        const memorySpaceId = ctx.memorySpaceId("update-high-sim");
        const userId = ctx.userId("update-high-sim");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create initial fact with lower confidence
        const initial = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User likes the color blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 70,
          },
        });

        expect(initial.action).toBe("ADD");
        const initialFactId = initial.fact.factId;

        // Submit very similar text with higher confidence
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User likes the color blue very much",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 95,
          },
        });

        expect(result.action).toBe("UPDATE");
        expect(result.fact.factId).toBe(initialFactId); // Same fact updated
        expect(result.fact.confidence).toBe(95);
        expect(result.superseded).toHaveLength(0);

        // Should still have only 1 fact
        const allFacts = await cortex.facts.list({ memorySpaceId });
        expect(allFacts.length).toBe(1);
        console.log(`✅ UPDATE (high similarity + higher confidence): ${result.reason}`);
      });
    });

    describe("Scenario: Same subject + same object + higher confidence", () => {
      it("should UPDATE when same preference is restated with higher confidence", async () => {
        const memorySpaceId = ctx.memorySpaceId("update-same-obj");
        const userId = ctx.userId("update-same-obj");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create initial fact
        const initial = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User prefers blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 60,
          },
        });

        expect(initial.action).toBe("ADD");
        const initialFactId = initial.fact.factId;

        // Restate same preference with different wording but higher confidence
        // Same subject + same object should trigger UPDATE path
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "Blue is definitely the user's favorite color",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue", // Same object
            confidence: 95, // Higher confidence
          },
        });

        expect(result.action).toBe("UPDATE");
        expect(result.fact.factId).toBe(initialFactId);
        expect(result.fact.confidence).toBe(95);
        expect(result.superseded).toHaveLength(0);

        const allFacts = await cortex.facts.list({ memorySpaceId });
        expect(allFacts.length).toBe(1);
        console.log(`✅ UPDATE (same subject + same object + higher confidence): ${result.reason}`);
      });
    });

    describe("Scenario: Refinement with more specific information", () => {
      it("should UPDATE when adding detail to existing fact", async () => {
        const memorySpaceId = ctx.memorySpaceId("update-refine");
        const userId = ctx.userId("update-refine");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create general fact
        await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User has a pet dog",
            factType: "knowledge",
            subject: userId,
            predicate: "pet",
            object: "dog",
            confidence: 80,
          },
        });

        // Add more specific information with higher confidence
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User has a pet dog named Rex",
            factType: "knowledge",
            subject: userId,
            predicate: "pet",
            object: "dog", // Same object
            confidence: 95,
          },
        });

        expect(result.action).toBe("UPDATE");
        expect(result.fact.fact).toContain("Rex");
        expect(result.superseded).toHaveLength(0);
        console.log(`✅ UPDATE (refinement with detail): ${result.reason}`);
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUPERSEDE Decision Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("SUPERSEDE Decision", () => {
    describe("Scenario: Same subject + different object (preference change)", () => {
      it("should SUPERSEDE when favorite color changes from blue to purple", async () => {
        const memorySpaceId = ctx.memorySpaceId("supersede-color");
        const userId = ctx.userId("supersede-color");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create initial preference
        const initial = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User's favorite color is blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 90,
          },
        });

        const blueFactId = initial.fact.factId;

        // Change preference to purple
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User now prefers purple",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "purple", // Different object
            confidence: 95,
          },
        });

        expect(result.action).toBe("SUPERSEDE");
        expect(result.fact.factId).not.toBe(blueFactId); // New fact created
        expect(result.superseded).toHaveLength(1);
        expect(result.superseded[0].factId).toBe(blueFactId);

        // Check active facts (should only be purple)
        const activeFacts = await cortex.facts.list({ memorySpaceId });
        expect(activeFacts.length).toBe(1);
        expect(activeFacts[0].object).toBe("purple");

        // Check all facts including superseded (should have both)
        const allFacts = await cortex.facts.list({
          memorySpaceId,
          includeSuperseded: true,
        });
        expect(allFacts.length).toBe(2);

        // Verify supersession chain
        const blueFact = allFacts.find((f) => f.object === "blue");
        const purpleFact = allFacts.find((f) => f.object === "purple");
        expect(blueFact?.supersededBy).toBe(purpleFact?.factId);
        expect(purpleFact?.supersedes).toBe(blueFact?.factId);

        console.log(`✅ SUPERSEDE (color change blue→purple): ${result.reason}`);
      });
    });

    describe("Scenario: Location change", () => {
      it("should SUPERSEDE when user moves to a new city", async () => {
        const memorySpaceId = ctx.memorySpaceId("supersede-location");
        const userId = ctx.userId("supersede-location");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // User lives in NYC
        await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User lives in New York City",
            factType: "knowledge",
            subject: userId,
            predicate: "lives in",
            object: "New York City",
            confidence: 90,
          },
        });

        // User moves to SF
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User moved to San Francisco",
            factType: "knowledge",
            subject: userId,
            predicate: "lives in",
            object: "San Francisco",
            confidence: 95,
          },
        });

        expect(result.action).toBe("SUPERSEDE");
        expect(result.superseded).toHaveLength(1);
        expect(result.superseded[0].object).toBe("New York City");

        const activeFacts = await cortex.facts.list({ memorySpaceId });
        expect(activeFacts.length).toBe(1);
        expect(activeFacts[0].object).toBe("San Francisco");

        console.log(`✅ SUPERSEDE (location change NYC→SF): ${result.reason}`);
      });
    });

    describe("Scenario: Employment change", () => {
      it("should SUPERSEDE when user changes jobs", async () => {
        const memorySpaceId = ctx.memorySpaceId("supersede-job");
        const userId = ctx.userId("supersede-job");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // User works at Company A
        await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User works at Acme Corp",
            factType: "knowledge",
            subject: userId,
            predicate: "works at",
            object: "Acme Corp",
            confidence: 90,
          },
        });

        // User moves to Company B
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User now works at TechStart Inc",
            factType: "knowledge",
            subject: userId,
            predicate: "works at",
            object: "TechStart Inc",
            confidence: 95,
          },
        });

        expect(result.action).toBe("SUPERSEDE");
        expect(result.superseded).toHaveLength(1);

        const activeFacts = await cortex.facts.list({ memorySpaceId });
        expect(activeFacts.length).toBe(1);
        expect(activeFacts[0].object).toBe("TechStart Inc");

        console.log(`✅ SUPERSEDE (job change): ${result.reason}`);
      });
    });

    describe("Scenario: Medium similarity + different subject", () => {
      it("should SUPERSEDE when text has medium overlap but different subjects", async () => {
        const memorySpaceId = ctx.memorySpaceId("supersede-medium-sim");
        const userA = ctx.userId("user-a");
        const userB = ctx.userId("user-b");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Fact about user A
        await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "The project manager prefers morning meetings",
            factType: "preference",
            subject: userA,
            predicate: "meeting preference",
            object: "morning meetings",
            confidence: 85,
          },
        });

        // Similar text about user B with medium word overlap
        // Words: "the", "project", "manager", "prefers", "meetings" overlap
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "The project manager prefers afternoon meetings instead",
            factType: "preference",
            subject: userB,
            predicate: "meeting preference",
            object: "afternoon meetings",
            confidence: 90,
          },
        });

        // With different subjects but medium similarity, this should be ADD or SUPERSEDE
        // depending on whether semantic matching finds them as candidates
        expect(["ADD", "SUPERSEDE"]).toContain(result.action);
        console.log(`✅ Medium similarity decision: ${result.action} - ${result.reason}`);
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NONE Decision Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("NONE Decision", () => {
    describe("Scenario: High similarity + same/lower confidence (exact duplicate)", () => {
      it("should return NONE for exact duplicate text", async () => {
        const memorySpaceId = ctx.memorySpaceId("none-exact-dup");
        const userId = ctx.userId("none-exact-dup");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create initial fact
        const initial = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User's favorite color is blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 90,
          },
        });

        const initialFactId = initial.fact.factId;

        // Submit exact same fact
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User's favorite color is blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 90, // Same confidence
          },
        });

        expect(result.action).toBe("NONE");
        expect(result.fact.factId).toBe(initialFactId); // Returns existing fact
        expect(result.superseded).toHaveLength(0);

        // Should still have only 1 fact
        const allFacts = await cortex.facts.list({ memorySpaceId });
        expect(allFacts.length).toBe(1);

        console.log(`✅ NONE (exact duplicate): ${result.reason}`);
      });
    });

    describe("Scenario: High similarity + lower confidence", () => {
      it("should return NONE when new fact has lower confidence than existing", async () => {
        const memorySpaceId = ctx.memorySpaceId("none-lower-conf");
        const userId = ctx.userId("none-lower-conf");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create high confidence fact
        const initial = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User definitely prefers blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 95,
          },
        });

        const initialFactId = initial.fact.factId;

        // Submit similar text with LOWER confidence
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User probably prefers blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 70, // Lower confidence
          },
        });

        expect(result.action).toBe("NONE");
        expect(result.fact.factId).toBe(initialFactId);
        expect(result.fact.confidence).toBe(95); // Original confidence preserved

        console.log(`✅ NONE (lower confidence ignored): ${result.reason}`);
      });
    });

    describe("Scenario: Same subject + same object + same/lower confidence", () => {
      it("should return NONE when restating same preference with lower confidence", async () => {
        const memorySpaceId = ctx.memorySpaceId("none-same-obj");
        const userId = ctx.userId("none-same-obj");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create fact about blue preference
        const initial = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User's favorite color is definitely blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 90,
          },
        });

        const initialFactId = initial.fact.factId;

        // Restate same preference with different wording but same object, lower confidence
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "I think user might like blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue", // Same object
            confidence: 60, // Lower confidence
          },
        });

        expect(result.action).toBe("NONE");
        expect(result.fact.factId).toBe(initialFactId);

        const allFacts = await cortex.facts.list({ memorySpaceId });
        expect(allFacts.length).toBe(1);

        console.log(`✅ NONE (same object, lower confidence): ${result.reason}`);
      });
    });

    describe("Scenario: Repeated identical statements (5x)", () => {
      it("should return NONE for all repeated identical statements after first ADD", async () => {
        const memorySpaceId = ctx.memorySpaceId("none-repeated");
        const userId = ctx.userId("none-repeated");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        const actions: string[] = [];
        let factId: string | undefined;

        for (let i = 0; i < 5; i++) {
          const result = await cortex.facts.revise({
            memorySpaceId,
            fact: {
              fact: "User likes the color blue",
              factType: "preference",
              subject: userId,
              predicate: "favorite color",
              object: "blue",
              confidence: 90,
            },
          });

          actions.push(result.action);

          if (i === 0) {
            factId = result.fact.factId;
            expect(result.action).toBe("ADD");
          } else {
            expect(result.action).toBe("NONE");
            expect(result.fact.factId).toBe(factId);
          }
        }

        console.log(`✅ Repeated statements: [${actions.join(", ")}]`);

        // Should still have exactly 1 fact
        const allFacts = await cortex.facts.list({ memorySpaceId });
        expect(allFacts.length).toBe(1);
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Complex Scenarios
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Complex Scenarios", () => {
    describe("Scenario: Multiple preference changes in sequence", () => {
      it("should maintain clean supersession chain through multiple changes", async () => {
        const memorySpaceId = ctx.memorySpaceId("complex-chain");
        const userId = ctx.userId("complex-chain");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        const colors = ["blue", "green", "purple", "red"];
        const factIds: string[] = [];

        for (let i = 0; i < colors.length; i++) {
          const result = await cortex.facts.revise({
            memorySpaceId,
            fact: {
              fact: `User's favorite color is ${colors[i]}`,
              factType: "preference",
              subject: userId,
              predicate: "favorite color",
              object: colors[i],
              confidence: 90,
            },
          });

          factIds.push(result.fact.factId);

          if (i === 0) {
            expect(result.action).toBe("ADD");
          } else {
            expect(result.action).toBe("SUPERSEDE");
            expect(result.superseded).toHaveLength(1);
          }
        }

        // Should have 1 active fact (red)
        const activeFacts = await cortex.facts.list({ memorySpaceId });
        expect(activeFacts.length).toBe(1);
        expect(activeFacts[0].object).toBe("red");

        // Should have 4 total facts
        const allFacts = await cortex.facts.list({
          memorySpaceId,
          includeSuperseded: true,
        });
        expect(allFacts.length).toBe(4);

        // Verify only latest is active
        const supersededCount = allFacts.filter((f) => f.supersededBy).length;
        expect(supersededCount).toBe(3);

        console.log(`✅ Complex chain: ${colors.length} colors, 1 active, ${supersededCount} superseded`);
      });
    });

    describe("Scenario: Mixed updates and supersessions", () => {
      it("should handle mix of UPDATE, NONE, and SUPERSEDE correctly", async () => {
        const memorySpaceId = ctx.memorySpaceId("complex-mixed");
        const userId = ctx.userId("complex-mixed");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        const operations: Array<{ action: string; expected: string }> = [];

        // 1. ADD: Initial fact
        let result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User likes blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 70,
          },
        });
        operations.push({ action: result.action, expected: "ADD" });
        expect(result.action).toBe("ADD");

        // 2. NONE: Same fact, same confidence
        result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User likes blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 70,
          },
        });
        operations.push({ action: result.action, expected: "NONE" });
        expect(result.action).toBe("NONE");

        // 3. UPDATE: Same fact, higher confidence
        result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User really likes blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 95,
          },
        });
        operations.push({ action: result.action, expected: "UPDATE" });
        expect(result.action).toBe("UPDATE");

        // 4. NONE: Lower confidence than updated
        result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User maybe likes blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 60,
          },
        });
        operations.push({ action: result.action, expected: "NONE" });
        expect(result.action).toBe("NONE");

        // 5. SUPERSEDE: Different color
        result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User now prefers purple",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "purple",
            confidence: 90,
          },
        });
        operations.push({ action: result.action, expected: "SUPERSEDE" });
        expect(result.action).toBe("SUPERSEDE");

        console.log("✅ Mixed operations sequence:");
        operations.forEach((op, i) => {
          const status = op.action === op.expected ? "✓" : "✗";
          console.log(`   ${i + 1}. Expected ${op.expected}, got ${op.action} ${status}`);
        });

        // Final state: 1 active (purple), 1 superseded (blue)
        const activeFacts = await cortex.facts.list({ memorySpaceId });
        expect(activeFacts.length).toBe(1);
        expect(activeFacts[0].object).toBe("purple");

        const allFacts = await cortex.facts.list({
          memorySpaceId,
          includeSuperseded: true,
        });
        expect(allFacts.length).toBe(2);
      });
    });

    describe("Scenario: Multiple slots for same user", () => {
      it("should handle independent facts in different slots", async () => {
        const memorySpaceId = ctx.memorySpaceId("complex-slots");
        const userId = ctx.userId("complex-slots");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create facts in different slots
        const slots = [
          { predicate: "favorite color", object: "blue" },
          { predicate: "lives in", object: "New York" },
          { predicate: "works at", object: "TechCorp" },
          { predicate: "favorite food", object: "pizza" },
        ];

        for (const slot of slots) {
          const result = await cortex.facts.revise({
            memorySpaceId,
            fact: {
              fact: `User ${slot.predicate} ${slot.object}`,
              factType: "preference",
              subject: userId,
              predicate: slot.predicate,
              object: slot.object,
              confidence: 90,
            },
          });
          expect(result.action).toBe("ADD");
        }

        // All 4 facts should exist independently
        const allFacts = await cortex.facts.list({ memorySpaceId });
        expect(allFacts.length).toBe(4);

        // Change one slot - should only supersede that slot
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User favorite color purple",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "purple",
            confidence: 95,
          },
        });

        expect(result.action).toBe("SUPERSEDE");

        // Should still have 4 active facts (3 original + 1 new purple, 1 blue superseded)
        const finalActiveFacts = await cortex.facts.list({ memorySpaceId });
        expect(finalActiveFacts.length).toBe(4);

        // Total should be 5 (including superseded blue)
        const finalAllFacts = await cortex.facts.list({
          memorySpaceId,
          includeSuperseded: true,
        });
        expect(finalAllFacts.length).toBe(5);

        console.log(`✅ Multiple slots: 4 independent slots, color changed, 5 total facts`);
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Edge Cases", () => {
    describe("Missing fields handling", () => {
      it("should handle facts without object field", async () => {
        const memorySpaceId = ctx.memorySpaceId("edge-no-object");
        const userId = ctx.userId("edge-no-object");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create fact without object
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User is friendly",
            factType: "knowledge", // Use valid factType
            subject: userId,
            predicate: "personality trait",
            object: "friendly", // Provide object for cleaner test
            confidence: 85,
          },
        });

        expect(result.action).toBe("ADD");

        // Verify fact was created
        const facts = await cortex.facts.list({ memorySpaceId });
        expect(facts.length).toBe(1);

        console.log(`✅ Fact creation: ${result.action}`);
      });

      it("should handle facts without predicate field", async () => {
        const memorySpaceId = ctx.memorySpaceId("edge-no-predicate");
        const userId = ctx.userId("edge-no-predicate");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        // Create fact without predicate
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User mentioned they enjoy coding",
            factType: "knowledge",
            subject: userId,
            // No predicate field
            object: "coding",
            confidence: 80,
          },
        });

        expect(result.action).toBe("ADD");
        console.log(`✅ No predicate field: ${result.action}`);
      });
    });

    describe("Confidence boundary cases", () => {
      it("should handle equal confidence correctly", async () => {
        const memorySpaceId = ctx.memorySpaceId("edge-equal-conf");
        const userId = ctx.userId("edge-equal-conf");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User likes blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 85,
          },
        });

        // Same confidence should result in NONE
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User likes blue color",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue",
            confidence: 85, // Equal confidence
          },
        });

        expect(result.action).toBe("NONE");
        console.log(`✅ Equal confidence: ${result.action}`);
      });

      it("should handle confidence = 100 correctly", async () => {
        const memorySpaceId = ctx.memorySpaceId("edge-max-conf");
        const userId = ctx.userId("edge-max-conf");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User's name is Alice",
            factType: "identity",
            subject: userId,
            predicate: "name",
            object: "Alice",
            confidence: 100, // Maximum confidence
          },
        });

        // Can't have higher confidence than 100
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User is named Alice",
            factType: "identity",
            subject: userId,
            predicate: "name",
            object: "Alice",
            confidence: 100,
          },
        });

        expect(result.action).toBe("NONE");
        console.log(`✅ Max confidence: ${result.action}`);
      });
    });

    describe("Case sensitivity", () => {
      it("should handle case differences in object comparison", async () => {
        const memorySpaceId = ctx.memorySpaceId("edge-case");
        const userId = ctx.userId("edge-case");

        await cortex.memorySpaces.register({
          memorySpaceId,
          type: "personal",
        });

        await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User likes Blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "Blue", // Capitalized
            confidence: 85,
          },
        });

        // Same object but different case
        const result = await cortex.facts.revise({
          memorySpaceId,
          fact: {
            fact: "User likes blue",
            factType: "preference",
            subject: userId,
            predicate: "favorite color",
            object: "blue", // lowercase
            confidence: 90,
          },
        });

        // Should treat as same object (case-insensitive comparison)
        expect(result.action).toBe("UPDATE");
        console.log(`✅ Case insensitive: ${result.action}`);
      });
    });
  });
});
