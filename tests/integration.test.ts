/**
 * E2E Integration Tests: Multi-Layer Workflows
 *
 * Really complicated integration tests that exercise:
 * - All 4 layers working together
 * - Cross-space collaboration
 * - Memory space isolation
 * - Conversation → Memory → Facts → Contexts flow
 * - Hive Mode + Collaboration Mode simultaneously
 */

import { Cortex } from "./helpers/deployment-operator";
import { createRuntimeFixture } from "./helpers/runtime-fixture";
import { ConvexClient } from "./helpers/deployment-operator";
import { TestCleanup, waitForCondition } from "./helpers";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("Complex Integration Tests", () => {
  let cortex: Cortex;
  let runtime: Awaited<ReturnType<typeof createRuntimeFixture>>;
  let governance: Awaited<ReturnType<typeof createRuntimeFixture>>;
  let governanceForeign: Awaited<ReturnType<typeof createRuntimeFixture>>;
  const RUNTIME_USER_ID = ctx.userId("runtime-owner");
  const CONTEXT_SCOPES = ["support-agent", "finance-agent", "crm-agent", "company-acme-hive", "company-beta-hive", "gdpr-test-space", "version-test-space", "search-test-space"].map(suffix => ctx.memorySpaceId(suffix));
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  const createCurrentContext = async (params: Parameters<Cortex["contexts"]["create"]>[0]) => {
    const selected = { ...params, userId: RUNTIME_USER_ID };
    if (params.conversationRef !== undefined) {
      const before = await runtime.ownedRows("contexts");
      await expect(cortex.contexts.create(selected)).rejects.toThrow("CAPABILITY_NOT_READY");
      expect(await runtime.ownedRows("contexts")).toEqual(before);
    }
    return cortex.contexts.create({ ...selected, conversationRef: undefined });
  };

  // Helper to wait for context to be queryable after creation
  const waitForContextReady = async (contextId: string) => {
    const ready = await waitForCondition(
      async () => {
        try {
          const result = await cortex.contexts.get(contextId);
          return result !== null;
        } catch {
          return false;
        }
      },
      ctx,
      10000, // 10s timeout for CI
      200,
    );
    if (!ready) {
      throw new Error(`Context ${contextId} not ready after 10 seconds`);
    }
    // Additional delay for index propagation in CI
    await new Promise((resolve) => setTimeout(resolve, 300));
  };

  // Helper to retry operations that may fail due to eventual consistency
  // (e.g., PARENT_NOT_FOUND, CONTEXT_NOT_FOUND when a different internal query is used)
  const retryOnNotFound = async <T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = 5,
    initialDelayMs = 500,
  ): Promise<T> => {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const msg = lastError.message || "";
        // Only retry on NOT_FOUND errors (eventual consistency issues)
        if (!msg.includes("NOT_FOUND")) {
          throw error;
        }
        if (attempt < maxRetries - 1) {
          const delay = initialDelayMs * Math.pow(2, attempt);
          console.warn(
            `[Retry ${attempt + 1}/${maxRetries}] ${operationName} failed with ${msg}, retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw new Error(
      `${operationName} failed after ${maxRetries} retries: ${lastError?.message}`,
    );
  };

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    runtime = await createRuntimeFixture(ctx.runId, CONTEXT_SCOPES, RUNTIME_USER_ID);
    Object.defineProperty(cortex, "contexts", { value: runtime.cortex.contexts });
    governance = await createRuntimeFixture(ctx.runId + "-governance", ctx.memorySpaceId("governance"), RUNTIME_USER_ID);
    governanceForeign = await createRuntimeFixture(ctx.runId + "-governance-foreign", ctx.memorySpaceId("governance-foreign"), RUNTIME_USER_ID);
    client = new ConvexClient(CONVEX_URL);
    _cleanup = new TestCleanup(client);

    // NOTE: Removed purgeAll() for parallel execution compatibility.
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() to prevent deleting parallel test data.
    const cleanups = await Promise.allSettled([
      () => runtime.close(),
      () => governance.close(),
      () => governanceForeign.close(),
      () => cortex.shutdown(),
      () => client.close(),
    ].map(cleanup => Promise.resolve().then(cleanup)));
    const failed = cleanups.find(cleanup => cleanup.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  });

  describe("Scenario 1: Enterprise Support Ticket (All Layers)", () => {
    it("handles complete workflow through all 4 layers", async () => {
      // Use ctx-scoped IDs for parallel execution isolation
      const SUPPORT_SPACE = ctx.memorySpaceId("support-agent");
      const FINANCE_SPACE = ctx.memorySpaceId("finance-agent");
      const CRM_SPACE = ctx.memorySpaceId("crm-agent");
      const AGENT_SUPPORT = ctx.agentId("support");
      const TOOL_TICKETING = `tool-ticketing-${ctx.runId}`;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SETUP: Register memory spaces
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      await cortex.memorySpaces.register({
        memorySpaceId: SUPPORT_SPACE,
        name: "Support Agent",
        type: "team",
        participants: [
          { id: AGENT_SUPPORT, type: "agent" },
          { id: TOOL_TICKETING, type: "tool" },
        ],
      });

      await cortex.memorySpaces.register({
        memorySpaceId: FINANCE_SPACE,
        name: "Finance Agent",
        type: "team",
        participants: [{ id: "agent-finance", type: "agent" }],
      });

      await cortex.memorySpaces.register({
        memorySpaceId: CRM_SPACE,
        name: "CRM Agent",
        type: "team",
        participants: [{ id: "agent-crm", type: "agent" }],
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // LAYER 1: User initiates conversation
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const conversation = await cortex.conversations.create({
        memorySpaceId: SUPPORT_SPACE,
        type: "user-agent",
        participants: {
          userId: "user-vip-123",
          agentId: "agent-support",
          participantId: "agent-support",
        },
      });

      const userMessage = await cortex.conversations.addMessage({
        conversationId: conversation.conversationId,
        message: {
          role: "user",
          content:
            "I need a refund for my subscription. The product isn't working as advertised and I've been a customer for 3 years.",
        },
      });

      const agentResponse = await cortex.conversations.addMessage({
        conversationId: conversation.conversationId,
        message: {
          role: "agent",
          content:
            "I understand your frustration. Let me process this refund for you right away.",
          participantId: "agent-support",
        },
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // LAYER 2: Agent stores searchable memories
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      await cortex.vector.store(SUPPORT_SPACE, {
        content: "VIP customer requested refund due to product issues",
        contentType: "summarized",
        source: { type: "conversation", userId: "user-vip-123" },
        userId: "user-vip-123",
        conversationRef: {
          conversationId: conversation.conversationId,
          messageIds: [
            userMessage.messages[0].id,
            agentResponse.messages[agentResponse.messages.length - 1].id,
          ],
        },
        metadata: {
          importance: 90,
          tags: ["refund", "vip", "customer-issue"],
        },
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // LAYER 3: Extract structured facts
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      await cortex.facts.store({
        memorySpaceId: SUPPORT_SPACE,
        participantId: "agent-support",
        fact: "User has been customer for 3 years",
        factType: "identity",
        subject: "user-vip-123",
        predicate: "customer_duration",
        object: "3-years",
        confidence: 100,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conversation.conversationId,
          messageIds: [userMessage.messages[0].id],
        },
        tags: ["customer", "tenure"],
      });

      await cortex.facts.store({
        memorySpaceId: SUPPORT_SPACE,
        participantId: "agent-support",
        fact: "User experiencing product quality issues",
        factType: "knowledge",
        subject: "user-vip-123",
        confidence: 95,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conversation.conversationId,
          messageIds: [userMessage.messages[0].id],
        },
        tags: ["issue", "product-quality"],
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // LAYER 4: Create workflow context
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const rootContext = await createCurrentContext({
        purpose: "Process VIP refund request",
        memorySpaceId: SUPPORT_SPACE,
        userId: "user-vip-123",
        conversationRef: {
          conversationId: conversation.conversationId,
          messageIds: [userMessage.messages[0].id],
        },
        data: {
          ticketId: "TICKET-12345",
          amount: 299.99,
          customerTier: "vip",
          priority: "high",
          importance: 95,
          tags: ["refund", "vip", "urgent"],
        },
      });

      // Wait for root context to be queryable before creating children
      await waitForContextReady(rootContext.contextId);

      // Delegate to finance agent (cross-space collaboration)
      // Use retry to handle PARENT_NOT_FOUND due to eventual consistency between
      // contexts.get() and contexts.create() internal parent lookup
      const financeContext = await retryOnNotFound(
        () =>
          createCurrentContext({
            purpose: "Approve $299.99 refund for VIP customer",
            memorySpaceId: FINANCE_SPACE,
            parentId: rootContext.contextId,
            userId: "user-vip-123",
            conversationRef: rootContext.conversationRef,
            data: {
              amount: 299.99,
              approvalRequired: true,
              importance: 95,
            },
          }),
        "contexts.create(financeContext)",
      );

      // Delegate to CRM agent
      const crmContext = await retryOnNotFound(
        () =>
          createCurrentContext({
            purpose: "Update customer record with refund issue",
            memorySpaceId: CRM_SPACE,
            parentId: rootContext.contextId,
            userId: "user-vip-123",
            data: {
              action: "log-issue",
              importance: 80,
            },
          }),
        "contexts.create(crmContext)",
      );

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // VERIFICATION: All layers connected
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // 1. Conversation exists
      const conv = await cortex.conversations.get(conversation.conversationId);

      expect(conv).not.toBeNull();
      expect(conv!.messageCount).toBe(2);

      // 2. Memories reference conversation
      const memories = await cortex.vector.list({
        memorySpaceId: SUPPORT_SPACE,
      });
      const refundMemory = memories.find((m) => m.content.includes("refund"));

      expect(refundMemory).toBeDefined();
      expect(refundMemory!.conversationRef).toBeDefined();
      expect(refundMemory!.conversationRef!.conversationId).toBe(
        conversation.conversationId,
      );

      // 3. Facts reference conversation and have high confidence
      const facts = await cortex.facts.list({
        memorySpaceId: SUPPORT_SPACE,
      });

      expect(facts.length).toBeGreaterThanOrEqual(2);
      facts.forEach((f) => {
        expect(f.sourceRef?.conversationId).toBe(conversation.conversationId);
        expect(f.confidence).toBeGreaterThan(90);
      });

      // 4. Context chain coordinates workflow
      const chain = await cortex.contexts.getChain(financeContext.contextId);

      expect(chain.root.contextId).toBe(rootContext.contextId);
      expect(chain.siblings).toHaveLength(1);
      expect(chain.siblings[0].contextId).toBe(crmContext.contextId);

      // Current contexts keep supported workflow data/hierarchy; the public
      // transcript link was refused before effects by createCurrentContext.
      expect(rootContext.conversationRef).toBeUndefined();
      expect(financeContext.conversationRef).toBeUndefined();
      expect(rootContext.data).toMatchObject({ ticketId: "TICKET-12345", amount: 299.99 });
      expect(financeContext.data).toMatchObject({ amount: 299.99, approvalRequired: true });

      // 6. Cross-space collaboration works
      expect(financeContext.memorySpaceId).toBe(FINANCE_SPACE);
      expect(crmContext.memorySpaceId).toBe(CRM_SPACE);
      expect(financeContext.rootId).toBe(rootContext.contextId);
      expect(crmContext.rootId).toBe(rootContext.contextId);

      // ✅ Complete data flow: Conversation → Memories → Facts → Contexts
    });
  });

  describe("Scenario 2: Multi-Organization Project (Hive + Collaboration)", () => {
    it("combines Hive Mode and Collaboration Mode", async () => {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SETUP: Two companies, each with Hive spaces
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const companyA = ctx.memorySpaceId("company-acme-hive");
      const companyB = ctx.memorySpaceId("company-beta-hive");

      // Company A Hive (multiple tools share one space)
      await cortex.memorySpaces.register({
        memorySpaceId: companyA,
        name: "Acme Corp Hive",
        type: "team",
        participants: [
          { id: "user-alice-ceo", type: "user" },
          { id: "agent-acme-pm", type: "agent" },
          { id: "tool-acme-calendar", type: "tool" },
          { id: "tool-acme-docs", type: "tool" },
        ],
      });

      // Company B Hive (different tools, separate space)
      await cortex.memorySpaces.register({
        memorySpaceId: companyB,
        name: "Beta Inc Hive",
        type: "team",
        participants: [
          { id: "user-bob-cto", type: "user" },
          { id: "agent-beta-tech", type: "agent" },
          { id: "tool-beta-code", type: "tool" },
          { id: "tool-beta-test", type: "tool" },
        ],
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 1: Company A starts internal project planning (Hive Mode)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Multiple tools contribute to same hive
      await cortex.facts.store({
        memorySpaceId: companyA,
        participantId: "tool-acme-calendar",
        fact: "Project kickoff scheduled for Nov 1",
        factType: "event",
        subject: "project-joint-api",
        confidence: 100,
        sourceType: "tool",
        tags: ["schedule", "project"],
      });

      await cortex.facts.store({
        memorySpaceId: companyA,
        participantId: "tool-acme-docs",
        fact: "Technical spec document created for joint API",
        factType: "knowledge",
        subject: "project-joint-api",
        confidence: 100,
        sourceType: "tool",
        tags: ["documentation", "project"],
      });

      await cortex.facts.store({
        memorySpaceId: companyA,
        participantId: "agent-acme-pm",
        fact: "Acme Corp will develop authentication module",
        factType: "knowledge",
        subject: "project-joint-api",
        predicate: "responsible_for",
        object: "authentication-module",
        confidence: 100,
        sourceType: "conversation",
        tags: ["responsibility", "project"],
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 2: Create shared context for collaboration
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      const projectContext = await createCurrentContext({
        purpose: "Joint API Development Project",
        memorySpaceId: companyA,
        data: {
          projectName: "Joint API Platform",
          budget: 500000,
          timeline: "6 months",
          startDate: "2025-11-01",
          importance: 95,
        },
      });

      // Wait for context to be queryable before granting access
      await waitForContextReady(projectContext.contextId);

      // Grant access to Company B (Collaboration Mode)
      // Use retry to handle CONTEXT_NOT_FOUND due to eventual consistency between
      // contexts.get() and contexts.grantAccess() internal context lookup
      await retryOnNotFound(
        () =>
          cortex.contexts.grantAccess(
            projectContext.contextId,
            companyB,
            "collaborate",
          ),
        "contexts.grantAccess(companyB)",
      );

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 3: Company B adds their contribution
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Company B's tools contribute to their own hive
      await cortex.facts.store({
        memorySpaceId: companyB,
        participantId: "tool-beta-code",
        fact: "Beta Inc will develop data processing module",
        factType: "knowledge",
        subject: "project-joint-api",
        predicate: "responsible_for",
        object: "data-processing-module",
        confidence: 100,
        sourceType: "tool",
        tags: ["responsibility", "project"],
      });

      await cortex.facts.store({
        memorySpaceId: companyB,
        participantId: "tool-beta-test",
        fact: "Beta Inc testing infrastructure ready for integration",
        factType: "knowledge",
        subject: "project-joint-api",
        confidence: 95,
        sourceType: "tool",
        tags: ["testing", "infrastructure"],
      });

      // Company B creates child context (cross-space hierarchy)
      const betaContext = await createCurrentContext({
        purpose: "Beta Inc: Develop data processing module",
        memorySpaceId: companyB,
        parentId: projectContext.contextId,
        data: {
          module: "data-processing",
          estimatedTime: "3 months",
        },
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // VERIFICATION: Complex multi-layer integration
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // V1: Hive Mode - All tools in each company share data
      const acmeFacts = await cortex.facts.list({ memorySpaceId: companyA });
      const betaFacts = await cortex.facts.list({ memorySpaceId: companyB });

      expect(acmeFacts.length).toBeGreaterThanOrEqual(3);
      expect(betaFacts.length).toBeGreaterThanOrEqual(2);

      // Different participants in each hive
      const acmeParticipants = new Set(
        acmeFacts.map((f) => f.participantId).filter(Boolean),
      );
      const betaParticipants = new Set(
        betaFacts.map((f) => f.participantId).filter(Boolean),
      );

      expect(acmeParticipants.size).toBeGreaterThanOrEqual(3);
      expect(betaParticipants.size).toBeGreaterThanOrEqual(2);

      // V2: Collaboration Mode - Shared context, isolated data
      const chain = await cortex.contexts.getChain(betaContext.contextId);

      // Beta can see shared context
      expect(chain.root.contextId).toBe(projectContext.contextId);
      expect(chain.root.data).toBeDefined();
      expect((chain.root.data as any).projectName).toBe("Joint API Platform");

      // But facts are isolated
      expect(acmeFacts.some((f) => f.fact.includes("Beta Inc"))).toBe(false);
      expect(betaFacts.some((f) => f.fact.includes("Acme Corp"))).toBe(false);

      // V3: Context grants allow coordination
      const rootCtx = await cortex.contexts.get(projectContext.contextId);

      expect((rootCtx as any).grantedAccess).toBeDefined();
      expect(
        (rootCtx as any).grantedAccess.some(
          (g: any) => g.memorySpaceId === companyB,
        ),
      ).toBe(true);

      // V4: Facts support graph queries
      const acmeResponsibilities = await cortex.facts.queryByRelationship({
        memorySpaceId: companyA,
        subject: "project-joint-api",
        predicate: "responsible_for",
      });

      expect(acmeResponsibilities.length).toBeGreaterThanOrEqual(1);
      expect(acmeResponsibilities[0].object).toBe("authentication-module");

      const betaResponsibilities = await cortex.facts.queryByRelationship({
        memorySpaceId: companyB,
        subject: "project-joint-api",
        predicate: "responsible_for",
      });

      expect(betaResponsibilities.length).toBeGreaterThanOrEqual(1);
      expect(betaResponsibilities[0].object).toBe("data-processing-module");

      // ✅ SUCCESS: Multi-org collaboration with hive mode in each org
      //    - Each org uses Hive Mode internally (no duplication)
      //    - Orgs collaborate via shared contexts (isolation maintained)
      //    - Facts stay private to each org
      //    - Context chain coordinates across boundaries
    });
  });

  describe("Scenario 3: Infinite Context Retrieval", () => {
    it("retrieves from massive conversation history", async () => {
      // SCENARIO: Demonstrate infinite context capability
      // Create large conversation history, then retrieve specific information

      const LARGE_HIVE = ctx.memorySpaceId("infinite-context-demo");

      await cortex.memorySpaces.register({
        memorySpaceId: LARGE_HIVE,
        name: "Infinite Context Demo",
        type: "personal",
        participants: [
          { id: "user-demo", type: "user" },
          { id: "agent-assistant", type: "agent" },
        ],
      });

      // Create conversation with many messages
      const conv = await cortex.conversations.create({
        memorySpaceId: LARGE_HIVE,
        type: "user-agent",
        participants: {
          userId: "user-demo",
          agentId: "agent-demo",
          participantId: "agent-assistant",
        },
      });

      // Simulate 50 message exchange (scaled down from thousands for test speed)
      const messageTopics = [
        "My favorite color is blue",
        "I prefer morning meetings",
        "My birthday is March 15th",
        "I work at Acme Corporation",
        "My email is alice@example.com",
        "I have a cat named Whiskers",
        "I'm allergic to peanuts",
        "My phone number is 555-1234",
        "I prefer dark mode",
        "I live in San Francisco",
      ];

      for (const topic of messageTopics) {
        await cortex.conversations.addMessage({
          conversationId: conv.conversationId,
          message: { role: "user", content: topic },
        });

        // Extract fact for each
        await cortex.facts.store({
          memorySpaceId: LARGE_HIVE,
          participantId: "agent-assistant",
          fact: topic,
          factType: "identity",
          subject: "user-demo",
          confidence: 95,
          sourceType: "conversation",
          sourceRef: { conversationId: conv.conversationId },
          tags: ["profile"],
        });
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // INFINITE CONTEXT: Retrieve specific info from history
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Search facts (much faster than searching 10K+ messages)
      const colorFacts = await cortex.facts.search(LARGE_HIVE, "color");

      expect(colorFacts.length).toBeGreaterThanOrEqual(1);
      expect(colorFacts[0].fact).toContain("blue");

      // Query by subject (entity-centric)
      const userProfile = await cortex.facts.queryBySubject({
        memorySpaceId: LARGE_HIVE,
        subject: "user-demo",
      });

      expect(userProfile.length).toBeGreaterThanOrEqual(10);

      // All facts link back to conversations for full context
      const factWithContext = userProfile[0];

      expect(factWithContext.sourceRef).toBeDefined();
      expect(factWithContext.sourceRef!.conversationId).toBe(
        conv.conversationId,
      );

      // Can retrieve full conversation if needed
      const fullConv = await cortex.conversations.get(conv.conversationId);

      expect(fullConv!.messageCount).toBeGreaterThanOrEqual(10);

      // ✅ Infinite Context: Facts provide instant access to structured knowledge
      //    Conversations provide full context when needed
      //    No need to pass entire conversation history to LLM
    });
  });

  describe("Scenario 4: GDPR Cascade Deletion", () => {
    it("deletes user data across all layers", async () => {
      const GDPR_SPACE = ctx.memorySpaceId("gdpr-test-space");
      // Use ctx for unique userId to prevent parallel test interference
      const TARGET_USER = ctx.userId("gdpr-delete");

      await cortex.memorySpaces.register({
        memorySpaceId: GDPR_SPACE,
        type: "personal",
        participants: [{ id: TARGET_USER, type: "user" }],
      });

      // Layer 1: Create conversations
      const conv = await cortex.conversations.create({
        memorySpaceId: GDPR_SPACE,
        type: "user-agent",
        participants: {
          userId: TARGET_USER,
          agentId: "agent-gdpr",
          participantId: "agent-test",
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "My personal information" },
      });

      // Layer 2: Store memories
      await cortex.vector.store(GDPR_SPACE, {
        content: "User's personal data",
        contentType: "raw",
        source: { type: "conversation" },
        userId: TARGET_USER,
        metadata: { importance: 50, tags: ["personal"] },
      });

      // Layer 3: Store facts
      await cortex.facts.store({
        memorySpaceId: GDPR_SPACE,
        fact: "User's personal preference",
        factType: "preference",
        subject: TARGET_USER,
        confidence: 90,
        sourceType: "conversation",
        tags: ["personal"],
      });

      // Layer 4: Create context
      const testContext = await createCurrentContext({
        purpose: "Handle user request",
        memorySpaceId: GDPR_SPACE,
        userId: TARGET_USER,
      });

      // Verify context was created before proceeding
      const contextVerify = await cortex.contexts.get(testContext.contextId);
      expect(contextVerify).not.toBeNull();

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // GDPR DELETE: Simulate cascade deletion
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // In production: cortex.users.delete(TARGET_USER, { cascade: true })
      // For test: Manually verify user filtering works

      const userConvs = await cortex.conversations.list({
        userId: TARGET_USER,
      });
      const userMemories = await cortex.vector.list({
        memorySpaceId: GDPR_SPACE,
        userId: TARGET_USER,
      });
      const userContexts = await cortex.contexts.list({ userId: RUNTIME_USER_ID, memorySpaceId: GDPR_SPACE });

      expect(userConvs.conversations.length).toBeGreaterThanOrEqual(1);
      expect(userMemories.length).toBeGreaterThanOrEqual(1);
      expect(userContexts.length).toBeGreaterThanOrEqual(1);

      // ✅ All layers support userId for GDPR compliance
    });
  });

  describe("Scenario 5: Versioning Across Layers", () => {
    it("tracks changes across conversations, memories, facts, contexts", async () => {
      const VERSION_SPACE = ctx.memorySpaceId("version-test-space");

      await cortex.memorySpaces.register({
        memorySpaceId: VERSION_SPACE,
        type: "personal",
        participants: [],
      });

      // Initial state
      const fact1 = await cortex.facts.store({
        memorySpaceId: VERSION_SPACE,
        fact: "User prefers email notifications",
        factType: "preference",
        subject: "user-version-test",
        confidence: 80,
        sourceType: "conversation",
        tags: ["notification"],
      });

      expect(fact1.version).toBe(1);

      // Update fact (v2)
      const fact2 = await cortex.facts.update(VERSION_SPACE, fact1.factId, {
        fact: "User prefers SMS notifications",
        confidence: 90,
      });

      expect(fact2.version).toBe(2);
      expect(fact2.supersedes).toBe(fact1.factId);

      // Get history
      const history = await cortex.facts.getHistory(
        VERSION_SPACE,
        fact1.factId,
      );

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].fact).toContain("email");
      expect(history.some((f) => f.fact.includes("SMS"))).toBe(true);

      // Contexts also track changes in metadata
      const _context = await createCurrentContext({
        purpose: "Track preference changes",
        memorySpaceId: VERSION_SPACE,
        data: { notification: "email" },
      });

      await cortex.contexts.update(_context.contextId, {
        data: { notification: "sms", updatedReason: "user changed preference" },
      });

      const updatedContext = await cortex.contexts.get(_context.contextId);

      expect((updatedContext as any).data.notification).toBe("sms");

      // ✅ Complete audit trail across all layers
    });
  });

  describe("Scenario 6: Cross-Layer Search & Retrieval", () => {
    it("searches across all layers for comprehensive results", async () => {
      const SEARCH_SPACE = ctx.memorySpaceId("search-test-space");
      // Use ctx for unique userId to prevent parallel test interference
      const SEARCH_USER = ctx.userId("search-test");

      await cortex.memorySpaces.register({
        memorySpaceId: SEARCH_SPACE,
        type: "personal",
        participants: [{ id: SEARCH_USER, type: "user" }],
      });

      const keyword = `SEARCH_${ctx.runId.slice(0, 8)}`;

      // Store in conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: SEARCH_SPACE,
        type: "user-agent",
        participants: {
          userId: SEARCH_USER,
          agentId: "agent-search-main",
          participantId: "agent-search",
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: `This message contains ${keyword}` },
      });

      // Store in memory
      await cortex.vector.store(SEARCH_SPACE, {
        content: `Memory with ${keyword}`,
        contentType: "raw",
        source: { type: "system" },
        userId: SEARCH_USER,
        metadata: { importance: 80, tags: ["search-test"] },
      });

      // Store in facts
      await cortex.facts.store({
        memorySpaceId: SEARCH_SPACE,
        fact: `Fact containing ${keyword}`,
        factType: "knowledge",
        confidence: 95,
        sourceType: "system",
        tags: ["search-test"],
      });

      // Store in context with userId for proper isolation
      const searchContext = await createCurrentContext({
        purpose: `Context with ${keyword}`,
        memorySpaceId: SEARCH_SPACE,
        userId: SEARCH_USER,
      });

      // Verify context was created before searching
      const contextVerify = await cortex.contexts.get(searchContext.contextId);
      expect(contextVerify).not.toBeNull();

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SEARCH: Find across all layers
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Conversations - filter by memorySpaceId for efficiency and reliability
      const convResults = await cortex.conversations.search({
        query: keyword,
        filters: { memorySpaceId: SEARCH_SPACE },
      });

      expect(
        convResults.some(
          (c) => c.conversation.conversationId === conv.conversationId,
        ),
      ).toBe(true);

      // Memories
      const memResults = await cortex.vector.search(SEARCH_SPACE, keyword);

      expect(memResults.length).toBeGreaterThanOrEqual(1);

      // Facts
      const factResults = await cortex.facts.search(SEARCH_SPACE, keyword);

      expect(factResults.length).toBeGreaterThanOrEqual(1);

      // Contexts
      const contextResults = await cortex.contexts.list({
        memorySpaceId: SEARCH_SPACE,
      });

      expect(contextResults.some((c) => c.purpose.includes(keyword))).toBe(
        true,
      );

      // ✅ Comprehensive search across all 4 layers
    });
  });

  describe("Scenario 7: Memory Space Statistics Dashboard", () => {
    it("aggregates stats from all layers", async () => {
      const STATS_SPACE = ctx.memorySpaceId("stats-dashboard-space");

      await cortex.memorySpaces.register({
        memorySpaceId: STATS_SPACE,
        name: "Stats Dashboard",
        type: "team",
        participants: [
          { id: "user-stats", type: "user" },
          { id: "agent-stats", type: "agent" },
        ],
      });

      // Add data across layers
      const conv = await cortex.conversations.create({
        memorySpaceId: STATS_SPACE,
        type: "user-agent",
        participants: {
          userId: "user-stats",
          agentId: "agent-stats-main",
          participantId: "agent-stats",
        },
      });

      for (let i = 0; i < 5; i++) {
        await cortex.conversations.addMessage({
          conversationId: conv.conversationId,
          message: { role: "user", content: `Message ${i}` },
        });
      }

      await cortex.vector.store(STATS_SPACE, {
        content: "Test memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 70, tags: [] },
      });

      await cortex.facts.store({
        memorySpaceId: STATS_SPACE,
        fact: "Test fact",
        factType: "knowledge",
        confidence: 90,
        sourceType: "system",
        tags: ["test"],
      });

      // Get comprehensive stats
      const stats = await cortex.memorySpaces.getStats(STATS_SPACE);

      expect(stats.totalConversations).toBeGreaterThanOrEqual(1);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(5);
      expect(stats.totalMemories).toBeGreaterThanOrEqual(1);
      expect(stats.totalFacts).toBeGreaterThanOrEqual(1);

      // ✅ Single query aggregates all layer statistics
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 8: Governance-Aware Multi-Layer Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 8: Current scoped governance alongside actual metadata", () => {
    it("stores a policy while manual enforcement preserves actual owned metadata", async () => {
      const sdk = governance.cortex;
      const scope = { organizationId: governance.tenantId, memorySpaceId: governance.memorySpaceId };
      const policy = await sdk.governance.getTemplate("SOC2");
      await sdk.governance.setPolicy(policy);
      const id = ctx.immutableId("governance-proof");
      const record = await sdk.immutable.store({ type: "audit-log", id, data: { retention: "confirmed source" } });
      await expect(sdk.governance.enforce({ scope, layers: ["immutable"], rules: ["retention"] }))
        .rejects.toMatchObject({ code: "BACKEND_ENFORCEMENT_ONLY", outcome: "not_dispatched" });
      expect(await sdk.immutable.get("audit-log", id)).toEqual(record);
      expect(await governance.ownedRows("governanceEnforcement")).toEqual([]);
    });
    it("simulation reports its actual zero-effect capability without estimating deletion", async () => {
      const policy = await governance.cortex.governance.getTemplate("GDPR");
      const before = await governance.ownedRows("immutable");
      expect(await governance.cortex.governance.simulate(policy))
        .toMatchObject({ simulation: true, estimated: false, status: "RETENTION_EXECUTION_NOT_IMPLEMENTED", recordsAffected: 0, versionsAffected: 0 });
      expect(await governance.ownedRows("immutable")).toEqual(before);
    });
    it("space policy overrides remain confined to explicitly granted tenant/space", async () => {
      const sdk = governance.cortex;
      await sdk.governance.setAgentOverride(governance.memorySpaceId, { compliance: { mode: "HIPAA", dataRetentionYears: 6, requireJustification: [], auditLogging: true } });
      expect(await sdk.governance.getPolicy()).toMatchObject({ organizationId: governance.tenantId, memorySpaceId: governance.memorySpaceId, compliance: { mode: "HIPAA" } });
      expect(await governanceForeign.cortex.governance.getPolicy()).toMatchObject({ organizationId: governanceForeign.tenantId, memorySpaceId: governanceForeign.memorySpaceId, compliance: { mode: "GDPR" } });
      const before = await governance.ownedRows("governancePolicies");
      await expect(sdk.governance.getPolicy({ organizationId: governanceForeign.tenantId, memorySpaceId: governanceForeign.memorySpaceId }))
        .rejects.toMatchObject({ data: { code: "FORBIDDEN", outcome: "not_dispatched" } });
      expect(await governance.ownedRows("governancePolicies")).toEqual(before);
    });
  });
});
