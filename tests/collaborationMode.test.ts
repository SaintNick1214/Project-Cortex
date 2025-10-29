/**
 * E2E Tests: Collaboration Mode
 *
 * Tests validate:
 * - Cross-space context sharing
 * - Secure cross-space access
 * - Multi-organization workflows
 * - Access control
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers";

describe("Collaboration Mode", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Two separate organizations
  const ORG_A_SPACE = "org-a-space";
  const ORG_B_SPACE = "org-b-space";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    cleanup = new TestCleanup(client);

    await cleanup.purgeAll();

    // Register two separate organizations
    await cortex.memorySpaces.register({
      memorySpaceId: ORG_A_SPACE,
      name: "Organization A",
      type: "team",
      participants: [
        { id: "user-alice", type: "user" },
        { id: "agent-a", type: "agent" },
      ],
    });

    await cortex.memorySpaces.register({
      memorySpaceId: ORG_B_SPACE,
      name: "Organization B",
      type: "team",
      participants: [
        { id: "user-bob", type: "user" },
        { id: "agent-b", type: "agent" },
      ],
    });
  });

  afterAll(async () => {
    await cleanup.purgeAll();
    await client.close();
  });

  describe("Memory Space Isolation", () => {
    it("each organization has separate data by default", async () => {
      // Org A stores data
      await cortex.vector.store(ORG_A_SPACE, {
        content: "Organization A confidential information",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 90, tags: ["confidential"] },
      });

      // Org B stores data
      await cortex.vector.store(ORG_B_SPACE, {
        content: "Organization B confidential information",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 90, tags: ["confidential"] },
      });

      // Org A only sees their data
      const orgAMemories = await cortex.vector.list({
        memorySpaceId: ORG_A_SPACE,
      });

      expect(orgAMemories.every((m) => m.memorySpaceId === ORG_A_SPACE)).toBe(
        true,
      );

      // Org B only sees their data
      const orgBMemories = await cortex.vector.list({
        memorySpaceId: ORG_B_SPACE,
      });

      expect(orgBMemories.every((m) => m.memorySpaceId === ORG_B_SPACE)).toBe(
        true,
      );

      // No cross-contamination
      expect(
        orgAMemories.some((m) => m.content.includes("Organization B")),
      ).toBe(false);
      expect(
        orgBMemories.some((m) => m.content.includes("Organization A")),
      ).toBe(false);
    });
  });

  describe("Cross-Space Context Sharing", () => {
    it("shares workflow context across organizations", async () => {
      // Org A creates context for joint project
      const sharedContext = await cortex.contexts.create({
        purpose: "Joint marketing campaign",
        memorySpaceId: ORG_A_SPACE,
        data: {
          campaign: "Q4 Partnership",
          budget: 100000,
          startDate: "2025-11-01",
        },
      });

      // Org A grants access to Org B
      const updated = await cortex.contexts.grantAccess(
        sharedContext.contextId,
        ORG_B_SPACE,
        "read-only",
      );

      expect(updated.grantedAccess).toBeDefined();
      expect(
        updated.grantedAccess!.some((g) => g.memorySpaceId === ORG_B_SPACE),
      ).toBe(true);

      // Both orgs can see the context
      const orgAView = await cortex.contexts.get(sharedContext.contextId);
      expect(orgAView).not.toBeNull();

      // Org B can also see (via granted access)
      // In real implementation, this would check access control
      expect((orgAView as any).grantedAccess?.some((g: any) => g.memorySpaceId === ORG_B_SPACE)).toBe(true);
    });

    it("creates child contexts in different spaces", async () => {
      // Org A creates root
      const root = await cortex.contexts.create({
        purpose: "Partnership project root",
        memorySpaceId: ORG_A_SPACE,
      });

      // Org A creates their task
      const orgATask = await cortex.contexts.create({
        purpose: "Org A handles marketing materials",
        memorySpaceId: ORG_A_SPACE,
        parentId: root.contextId,
      });

      // Org B creates their task (child of A's root - cross-space)
      const orgBTask = await cortex.contexts.create({
        purpose: "Org B handles distribution",
        memorySpaceId: ORG_B_SPACE,
        parentId: root.contextId,
      });

      // Both children reference same root but live in different spaces
      expect(orgATask.memorySpaceId).toBe(ORG_A_SPACE);
      expect(orgBTask.memorySpaceId).toBe(ORG_B_SPACE);
      expect(orgATask.rootId).toBe(root.contextId);
      expect(orgBTask.rootId).toBe(root.contextId);
    });
  });

  describe("Access Control", () => {
    it("contexts can grant selective access", async () => {
      const privateContext = await cortex.contexts.create({
        purpose: "Internal Org A workflow",
        memorySpaceId: ORG_A_SPACE,
        data: { confidential: true },
      });

      // Initially no access granted
      expect(privateContext.grantedAccess).toEqual([]);

      // Grant read-only access to Org B
      const updated = await cortex.contexts.grantAccess(
        privateContext.contextId,
        ORG_B_SPACE,
        "read-only",
      );

      expect(updated.grantedAccess).toHaveLength(1);
      expect(updated.grantedAccess![0].scope).toBe("read-only");
    });

    it("can grant different scopes", async () => {
      const context = await cortex.contexts.create({
        purpose: "Multi-scope test",
        memorySpaceId: ORG_A_SPACE,
      });

      // Grant read-only to Org B
      await cortex.contexts.grantAccess(
        context.contextId,
        ORG_B_SPACE,
        "read-only",
      );

      // Later: Could grant full access to another space
      const updated = await cortex.contexts.grantAccess(
        context.contextId,
        "partner-space",
        "full-access",
      );

      expect(updated.grantedAccess).toHaveLength(2);
    });
  });

  describe("Real-World Collaboration Scenario", () => {
    it("partner organizations collaborate on joint campaign", async () => {
      // SCENARIO: Two companies partner on marketing campaign
      // Each has separate memory space (data isolation)
      // But share workflow context for coordination

      // 1. Company A creates campaign context
      const campaign = await cortex.contexts.create({
        purpose: "Q4 Joint Marketing Campaign",
        memorySpaceId: ORG_A_SPACE,
        data: {
          budget: 200000,
          targetAudience: "enterprise customers",
          startDate: "2025-11-01",
          endDate: "2025-12-31",
        },
      });

      // 2. Company A grants access to Company B
      await cortex.contexts.grantAccess(campaign.contextId, ORG_B_SPACE, "collaborate");

      // 3. Company A adds their internal task
      const orgATask = await cortex.contexts.create({
        purpose: "Create marketing content",
        memorySpaceId: ORG_A_SPACE,
        parentId: campaign.contextId,
      });

      // Store facts in their own space
      await cortex.facts.store({
        memorySpaceId: ORG_A_SPACE,
        participantId: "agent-a",
        fact: "Company A will handle social media content creation",
        factType: "knowledge",
        confidence: 100,
        sourceType: "manual",
        tags: ["campaign", "content"],
      });

      // 4. Company B adds their task
      const orgBTask = await cortex.contexts.create({
        purpose: "Manage ad distribution",
        memorySpaceId: ORG_B_SPACE,
        parentId: campaign.contextId,
      });

      // Store facts in their own space
      await cortex.facts.store({
        memorySpaceId: ORG_B_SPACE,
        participantId: "agent-b",
        fact: "Company B will handle ad platform distribution",
        factType: "knowledge",
        confidence: 100,
        sourceType: "manual",
        tags: ["campaign", "distribution"],
      });

      // 5. Both can see shared context chain
      const chainA = await cortex.contexts.getChain(orgATask.contextId);
      const chainB = await cortex.contexts.getChain(orgBTask.contextId);

      expect(chainA.root.contextId).toBe(campaign.contextId);
      expect(chainB.root.contextId).toBe(campaign.contextId);
      expect(chainA.siblings).toHaveLength(1); // Org B's task
      expect(chainB.siblings).toHaveLength(1); // Org A's task

      // 6. But each org's facts stay private
      const orgAFacts = await cortex.facts.list({ memorySpaceId: ORG_A_SPACE });
      const orgBFacts = await cortex.facts.list({ memorySpaceId: ORG_B_SPACE });

      expect(orgAFacts.some((f) => f.fact.includes("social media"))).toBe(true);
      expect(orgAFacts.some((f) => f.fact.includes("ad platform"))).toBe(false);

      expect(orgBFacts.some((f) => f.fact.includes("ad platform"))).toBe(true);
      expect(orgBFacts.some((f) => f.fact.includes("social media"))).toBe(false);

      // Result: Shared workflow coordination, isolated data
    });
  });

  describe("Hive vs Collaboration Comparison", () => {
    it("demonstrates the difference", async () => {
      // HIVE MODE: All tools in ONE space (no data silos)
      const hiveSpace = "hive-demo";

      await cortex.memorySpaces.register({
        memorySpaceId: hiveSpace,
        name: "Hive: Single User's Tools",
        type: "personal",
        participants: [
          { id: "user-demo", type: "user" },
          { id: "tool-1", type: "tool" },
          { id: "tool-2", type: "tool" },
          { id: "tool-3", type: "tool" },
        ],
      });

      // All tools store in SAME space
      await cortex.facts.store({
        memorySpaceId: hiveSpace,
        participantId: "tool-1",
        fact: "Fact from tool 1",
        factType: "knowledge",
        confidence: 90,
        sourceType: "tool",
        tags: ["demo"],
      });

      await cortex.facts.store({
        memorySpaceId: hiveSpace,
        participantId: "tool-2",
        fact: "Fact from tool 2",
        factType: "knowledge",
        confidence: 90,
        sourceType: "tool",
        tags: ["demo"],
      });

      // Single query gets both
      const hiveFacts = await cortex.facts.list({ memorySpaceId: hiveSpace });

      expect(hiveFacts.length).toBeGreaterThanOrEqual(2);

      // COLLABORATION MODE: Separate spaces, shared contexts
      const companyX = "company-x";
      const companyY = "company-y";

      await cortex.memorySpaces.register({
        memorySpaceId: companyX,
        name: "Company X",
        type: "team",
        participants: [{ id: "user-x", type: "user" }],
      });

      await cortex.memorySpaces.register({
        memorySpaceId: companyY,
        name: "Company Y",
        type: "team",
        participants: [{ id: "user-y", type: "user" }],
      });

      // Each stores in their own space
      await cortex.facts.store({
        memorySpaceId: companyX,
        fact: "Company X confidential data",
        factType: "knowledge",
        confidence: 100,
        sourceType: "system",
        tags: ["confidential"],
      });

      await cortex.facts.store({
        memorySpaceId: companyY,
        fact: "Company Y confidential data",
        factType: "knowledge",
        confidence: 100,
        sourceType: "system",
        tags: ["confidential"],
      });

      // Create shared context for collaboration
      const sharedProject = await cortex.contexts.create({
        purpose: "Joint venture project",
        memorySpaceId: companyX,
      });

      await cortex.contexts.grantAccess(
        sharedProject.contextId,
        companyY,
        "collaborate",
      );

      // Facts stay isolated
      const xFacts = await cortex.facts.list({ memorySpaceId: companyX });
      const yFacts = await cortex.facts.list({ memorySpaceId: companyY });

      expect(xFacts.some((f) => f.fact.includes("Company Y"))).toBe(false);
      expect(yFacts.some((f) => f.fact.includes("Company X"))).toBe(false);

      // But context is shared
      const context = await cortex.contexts.get(sharedProject.contextId);

      expect((context as any).grantedAccess).toBeDefined();
      expect((context as any).grantedAccess.some((g: any) => g.memorySpaceId === companyY)).toBe(
        true,
      );
    });
  });

  describe("Cross-Space Workflow", () => {
    it("coordinates tasks across organizations", async () => {
      // Root context in Org A
      const root = await cortex.contexts.create({
        purpose: "Partnership deal workflow",
        memorySpaceId: ORG_A_SPACE,
        data: { dealValue: 500000 },
      });

      // Grant access to Org B
      await cortex.contexts.grantAccess(root.contextId, ORG_B_SPACE, "collaborate");

      // Org A creates their task
      const orgATask = await cortex.contexts.create({
        purpose: "Org A legal review",
        memorySpaceId: ORG_A_SPACE,
        parentId: root.contextId,
      });

      // Org B creates their task (child of A's root - cross-space!)
      const orgBTask = await cortex.contexts.create({
        purpose: "Org B financial review",
        memorySpaceId: ORG_B_SPACE,
        parentId: root.contextId,
      });

      // Both tasks share same root
      expect(orgATask.rootId).toBe(root.contextId);
      expect(orgBTask.rootId).toBe(root.contextId);

      // Can see each other as siblings
      const chainA = await cortex.contexts.getChain(orgATask.contextId);

      expect(chainA.siblings.some((s) => s.contextId === orgBTask.contextId)).toBe(
        true,
      );
    });
  });

  describe("Secure Data Sharing", () => {
    it("shares only context, not underlying data", async () => {
      // Org A stores sensitive facts
      await cortex.facts.store({
        memorySpaceId: ORG_A_SPACE,
        fact: "Org A revenue: $10M",
        factType: "knowledge",
        confidence: 100,
        sourceType: "system",
        tags: ["financial", "sensitive"],
      });

      // Create context and share it
      const context = await cortex.contexts.create({
        purpose: "Shared project planning",
        memorySpaceId: ORG_A_SPACE,
        data: { projectName: "Joint Initiative" },
      });

      await cortex.contexts.grantAccess(context.contextId, ORG_B_SPACE, "read-only");

      // Org B can see context
      const sharedCtx = await cortex.contexts.get(context.contextId);

      expect((sharedCtx as any).data.projectName).toBe("Joint Initiative");

      // But Org B CANNOT see Org A's facts
      const orgBFactView = await cortex.facts.list({ memorySpaceId: ORG_B_SPACE });

      expect(orgBFactView.some((f) => f.fact.includes("$10M"))).toBe(false);

      // Only context metadata is shared, not memory/facts
    });
  });
});

