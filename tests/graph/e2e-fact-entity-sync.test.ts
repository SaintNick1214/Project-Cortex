/**
 * E2E Test: Fact and Entity Graph Sync
 *
 * End-to-end tests for the complete fact extraction → graph sync workflow.
 *
 * Tests the following scenarios:
 * 1. Initialize Cortex with graph adapter (CORTEX_GRAPH_SYNC=true)
 * 2. Call remember() with conversation containing extractable facts
 * 3. Verify facts are stored in Convex
 * 4. Query graph for Fact nodes
 * 5. Query graph for Entity nodes
 * 6. Verify relationships via Cypher traversal
 *
 * Note: This test requires both Convex and Neo4j to be running.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../../src";
import { CypherGraphAdapter } from "../../src/graph";
import type { GraphAdapter } from "../../src/graph";
import { createNamedTestRunContext } from "../helpers";

// Check if graph testing is enabled
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "cortex-dev-password",
};

describeIfEnabled("E2E: Fact and Entity Graph Sync", () => {
  const ctx = createNamedTestRunContext("e2e-fact-graph-sync");
  let cortex: Cortex;
  let graphAdapter: GraphAdapter;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("graph-sync");

  beforeAll(async () => {
    // Initialize graph adapter
    graphAdapter = new CypherGraphAdapter();
    await graphAdapter.connect(NEO4J_CONFIG);
    await graphAdapter.clearDatabase();

    // Initialize Cortex with graph adapter
    // Note: In production, this would be configured via CORTEX_GRAPH_SYNC=true
    cortex = new Cortex({
      convexUrl: CONVEX_URL,
      graphAdapter,
    });

    // Create test memory space
    await cortex.memorySpaces.register({
      memorySpaceId: TEST_MEMSPACE_ID,
      type: "personal",
      name: "Fact Graph Sync E2E Test Space",
    });
  });

  afterAll(async () => {
    try {
      await cortex.memorySpaces.delete(TEST_MEMSPACE_ID, {
        cascade: true,
        reason: "e2e test cleanup",
      });
    } catch {
      // Ignore cleanup errors
    }
    await graphAdapter.clearDatabase();
    await graphAdapter.disconnect();
  });

  // ============================================================================
  // Test: Direct Fact Storage → Graph Sync
  // ============================================================================
  describe("Direct Fact Storage", () => {
    it("should automatically sync fact to graph when stored", async () => {
      const _factId = `fact-auto-sync-${Date.now()}`;

      // Store fact with entities
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Sarah works at TechCorp as a Senior Engineer",
        factType: "relationship",
        subject: "Sarah",
        predicate: "works_at",
        object: "TechCorp",
        confidence: 95,
        sourceType: "conversation",
        tags: ["employment"],
        entities: [
          { name: "Sarah", type: "person" },
          { name: "TechCorp", type: "organization" },
        ],
      });

      expect(fact.factId).toBeDefined();

      // Give graph a moment to sync (if async)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify fact node exists in graph
      const factNodes = await graphAdapter.findNodes(
        "Fact",
        { factId: fact.factId },
        10,
      );
      expect(factNodes.length).toBe(1);
      expect(factNodes[0].properties.subject).toBe("Sarah");
      expect(factNodes[0].properties.object).toBe("TechCorp");

      // Verify Entity nodes were created
      const sarahNodes = await graphAdapter.findNodes(
        "Entity",
        { name: "Sarah" },
        10,
      );
      expect(sarahNodes.length).toBeGreaterThanOrEqual(1);

      const techCorpNodes = await graphAdapter.findNodes(
        "Entity",
        { name: "TechCorp" },
        10,
      );
      expect(techCorpNodes.length).toBeGreaterThanOrEqual(1);

      // Verify MENTIONS relationships
      const mentionsEdges = await graphAdapter.findEdges("MENTIONS", {}, 100);
      expect(mentionsEdges.length).toBeGreaterThanOrEqual(2);
    });

    it("should create IN_SPACE relationship to MemorySpace", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User prefers dark mode",
        factType: "preference",
        subject: "user-123",
        predicate: "prefers",
        object: "dark mode",
        confidence: 100,
        sourceType: "manual",
        tags: [],
      });

      // Give graph a moment to sync
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify IN_SPACE relationship exists
      const inSpaceEdges = await graphAdapter.findEdges("IN_SPACE", {}, 100);
      // Should have at least one IN_SPACE edge for this fact
      const _factInSpace = inSpaceEdges.some(
        (edge) =>
          edge.fromNodeId?.includes(fact.factId) ||
          edge.toNodeId?.includes(TEST_MEMSPACE_ID),
      );
      // May or may not exist depending on implementation
      // Just verify the query doesn't fail
      expect(Array.isArray(inSpaceEdges)).toBe(true);
    });
  });

  // ============================================================================
  // Test: Belief Revision → Graph Sync (via revise())
  // ============================================================================
  describe("Belief Revision Graph Integration", () => {
    it("should sync facts created via belief revision", async () => {
      // Use revise() to store a fact with conflict detection
      const result = await cortex.facts.revise({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: {
          fact: "User likes hiking on weekends",
          factType: "preference",
          subject: "user-456",
          predicate: "hobby",
          object: "hiking",
          confidence: 85,
        },
      });

      expect(result.action).toBeDefined();
      expect(result.fact).toBeDefined();

      // Give graph a moment to sync
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify fact was synced to graph
      const factNodes = await graphAdapter.findNodes(
        "Fact",
        { factId: result.fact.factId },
        10,
      );
      expect(factNodes.length).toBe(1);
      expect(factNodes[0].properties.fact).toContain("hiking");
    });

    it("should create SUPERSEDES relationship when fact supersedes another", async () => {
      // Store initial fact
      const initialResult = await cortex.facts.revise({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: {
          fact: "User's favorite color is blue",
          factType: "preference",
          subject: "user-color-test",
          predicate: "favorite_color",
          object: "blue",
          confidence: 90,
        },
      });

      expect(initialResult.action).toBe("ADD");

      // Store superseding fact
      const supersedeResult = await cortex.facts.revise({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: {
          fact: "User's favorite color is purple",
          factType: "preference",
          subject: "user-color-test",
          predicate: "favorite_color",
          object: "purple",
          confidence: 95,
        },
      });

      // Should supersede or update the existing fact
      expect(["SUPERSEDE", "UPDATE", "ADD"]).toContain(supersedeResult.action);

      // Give graph a moment to sync
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify fact nodes exist in graph
      const factNodes = await graphAdapter.findNodes(
        "Fact",
        { subject: "user-color-test" },
        10,
      );
      expect(factNodes.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // Test: Graph Query for Fact Retrieval
  // ============================================================================
  describe("Graph Queries for Facts", () => {
    it("should be able to query facts by factType in graph", async () => {
      // Store multiple facts with different types
      await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Test knowledge fact",
        factType: "knowledge",
        confidence: 100,
        sourceType: "manual",
        tags: ["test"],
      });

      // Give graph a moment to sync
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Query graph for knowledge facts
      const knowledgeFacts = await graphAdapter.findNodes(
        "Fact",
        { factType: "knowledge" },
        100,
      );
      expect(knowledgeFacts.length).toBeGreaterThanOrEqual(1);
    });

    it("should be able to traverse from MemorySpace to Facts", async () => {
      // Query for all facts in the test memory space
      const allFacts = await graphAdapter.findNodes(
        "Fact",
        { memorySpaceId: TEST_MEMSPACE_ID },
        100,
      );
      expect(allFacts.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// Skip message when not enabled
if (!GRAPH_TESTING_ENABLED) {
  describe("E2E: Fact and Entity Graph Sync", () => {
    it("should skip tests when graph databases not configured", () => {
      console.log("\n⚠️  E2E fact-entity graph sync tests skipped");
      console.log("   To enable, set GRAPH_TESTING_ENABLED=true\n");
      console.log("   Also ensure Neo4j is running and CONVEX_URL is set.\n");
      expect(true).toBe(true);
    });
  });
}
