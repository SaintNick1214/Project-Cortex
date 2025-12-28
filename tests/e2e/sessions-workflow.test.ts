/**
 * E2E Tests: Sessions Workflow
 *
 * End-to-end tests simulating real-world session workflows:
 * - User login -> session creation -> activity -> logout
 * - Multi-device session management
 * - Session expiration and cleanup
 * - Session-scoped memory operations
 */

import { Cortex } from "../../src";
import { createTestRunContext } from "../helpers/isolation";
import {
  generateTenantId,
  generateTenantUserId,
  createTenantAuthContext,
} from "../helpers/tenancy";

// Test context for isolation
const ctx = createTestRunContext();

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Sessions Workflow E2E", () => {
  let cortex: Cortex;
  let testTenantId: string;
  let testUserId: string;
  let testMemorySpaceId: string;

  beforeAll(async () => {
    testTenantId = generateTenantId("sess-e2e");
    testUserId = generateTenantUserId(testTenantId);
    testMemorySpaceId = `space_${ctx.runId}`;

    const authContext = createTenantAuthContext(testTenantId, testUserId);

    cortex = new Cortex({
      convexUrl: process.env.CONVEX_URL!,
      auth: authContext,
    });

    // Register memory space
    await cortex.memorySpaces.register({
      memorySpaceId: testMemorySpaceId,
      name: "Sessions E2E Test Space",
      type: "custom",
    });
  });

  afterAll(async () => {
    try {
      await cortex.memorySpaces.delete(testMemorySpaceId, { cascade: true, reason: "Test cleanup" });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 1: Basic User Session Lifecycle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 1: Basic User Session Lifecycle", () => {
    it("should complete full session lifecycle: login -> activity -> logout", async () => {
      // Step 1: User logs in - create session
      const session = await cortex.sessions.create({
        userId: testUserId,
        tenantId: testTenantId,
        memorySpaceId: testMemorySpaceId,
        metadata: {
          deviceType: "web",
          browser: "Chrome",
          loginTime: new Date().toISOString(),
        },
      });

      expect(session.status).toBe("active");
      expect(session.messageCount).toBe(0);

      // Step 2: User performs activity
      const conv = await cortex.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: { userId: testUserId, agentId: "test-agent" },
      });

      // Touch session to record activity
      await cortex.sessions.touch(session.sessionId);

      // Step 3: User sends messages
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId: conv.conversationId,
        userMessage: "What's the weather like?",
        agentResponse: "I can help you check the weather!",
        userId: testUserId,
      });

      // Step 4: Verify session was updated
      const updatedSession = await cortex.sessions.get(session.sessionId);
      expect(updatedSession?.lastActiveAt).toBeGreaterThan(session.lastActiveAt);

      // Step 5: User logs out
      await cortex.sessions.end(session.sessionId);

      // Step 6: Verify session is ended
      const endedSession = await cortex.sessions.get(session.sessionId);
      expect(endedSession?.status).toBe("ended");
      expect(endedSession?.endedAt).toBeDefined();

      // Cleanup
      await cortex.conversations.delete(conv.conversationId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 2: Multi-Device Session Management
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 2: Multi-Device Session Management", () => {
    it("should handle user logged in on multiple devices", async () => {
      // User logs in on laptop
      const laptopSession = await cortex.sessions.create({
        userId: testUserId,
        tenantId: testTenantId,
        metadata: {
          deviceType: "laptop",
          deviceId: "laptop-001",
          os: "macOS",
        },
      });

      // User logs in on mobile
      const mobileSession = await cortex.sessions.create({
        userId: testUserId,
        tenantId: testTenantId,
        metadata: {
          deviceType: "mobile",
          deviceId: "mobile-001",
          os: "iOS",
        },
      });

      // User logs in on tablet
      const tabletSession = await cortex.sessions.create({
        userId: testUserId,
        tenantId: testTenantId,
        metadata: {
          deviceType: "tablet",
          deviceId: "tablet-001",
          os: "iPadOS",
        },
      });

      // Verify all sessions are active
      const activeSessions = await cortex.sessions.getActive(testUserId);
      expect(activeSessions.length).toBeGreaterThanOrEqual(3);

      // Verify each device has its session
      const sessionIds = activeSessions.map((s) => s.sessionId);
      expect(sessionIds).toContain(laptopSession.sessionId);
      expect(sessionIds).toContain(mobileSession.sessionId);
      expect(sessionIds).toContain(tabletSession.sessionId);

      // User activity on mobile
      await cortex.sessions.touch(mobileSession.sessionId);

      // User logs out of all devices
      const result = await cortex.sessions.endAll(testUserId);
      expect(result.ended).toBeGreaterThanOrEqual(3);

      // Verify no active sessions remain
      const remainingSessions = await cortex.sessions.getActive(testUserId);
      expect(remainingSessions.length).toBe(0);
    });

    it("should allow selective logout (single device)", async () => {
      // Create sessions for two devices
      const device1Session = await cortex.sessions.create({
        userId: testUserId,
        metadata: { deviceId: "device-1" },
      });

      const device2Session = await cortex.sessions.create({
        userId: testUserId,
        metadata: { deviceId: "device-2" },
      });

      // Log out only from device 1
      await cortex.sessions.end(device1Session.sessionId);

      // Verify device 1 is logged out
      const d1Status = await cortex.sessions.get(device1Session.sessionId);
      expect(d1Status?.status).toBe("ended");

      // Verify device 2 is still active
      const d2Status = await cortex.sessions.get(device2Session.sessionId);
      expect(d2Status?.status).toBe("active");

      // Cleanup
      await cortex.sessions.end(device2Session.sessionId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 3: Session with Custom Metadata
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 3: Session with Custom Metadata", () => {
    it("should preserve complex custom metadata throughout session", async () => {
      const customMetadata = {
        // Use the standard SessionMetadata fields
        device: "Chrome on Windows 11",
        browser: "Chrome",
        browserVersion: "120.0.0",
        os: "Windows 11",
        location: "San Francisco, CA, US",
        timezone: "America/Los_Angeles",
        // Custom app data using index signature
        authProvider: "google",
        mfaVerified: true,
        loginMethod: "sso",
        theme: "dark",
        preferredLanguage: "en-US",
        featureFlags: ["beta_features", "new_ui"],
        lastVisitedPage: "/dashboard",
        permissions: ["read", "write", "admin"],
      };

      const session = await cortex.sessions.create({
        userId: testUserId,
        tenantId: testTenantId,
        metadata: customMetadata,
      });

      // Retrieve and verify
      const retrieved = await cortex.sessions.get(session.sessionId);

      expect(retrieved?.metadata?.device).toEqual(customMetadata.device);
      expect(retrieved?.metadata?.location).toEqual(customMetadata.location);
      expect(retrieved?.metadata?.authProvider).toEqual(customMetadata.authProvider);
      expect(retrieved?.metadata?.theme).toEqual(customMetadata.theme);
      expect(retrieved?.metadata?.permissions).toEqual(customMetadata.permissions);

      // Cleanup
      await cortex.sessions.end(session.sessionId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 4: Session-Scoped Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 4: Session-Scoped Operations", () => {
    it("should create session and use it for all operations", async () => {
      // Create session
      const session = await cortex.sessions.create({
        userId: testUserId,
        tenantId: testTenantId,
        memorySpaceId: testMemorySpaceId,
      });

      // Create conversation in this session
      const conv = await cortex.conversations.create({
        memorySpaceId: testMemorySpaceId,
        type: "user-agent",
        participants: { userId: testUserId, agentId: "test-agent" },
      });

      // Multiple interactions within the session
      const interactions = [
        { user: "Hello!", assistant: "Hi there! How can I help you?" },
        { user: "What can you do?", assistant: "I can help with many tasks!" },
        { user: "Tell me a joke", assistant: "Why did the AI go to therapy?" },
      ];

      for (const interaction of interactions) {
        await cortex.memory.remember({
          memorySpaceId: testMemorySpaceId,
          conversationId: conv.conversationId,
          userMessage: interaction.user,
          agentResponse: interaction.assistant,
          userId: testUserId,
        });

        // Touch session after each interaction
        await cortex.sessions.touch(session.sessionId);
      }

      // Verify session activity
      const finalSession = await cortex.sessions.get(session.sessionId);
      expect(finalSession?.status).toBe("active");
      expect(finalSession?.lastActiveAt).toBeGreaterThan(session.startedAt);

      // End session
      await cortex.sessions.end(session.sessionId);

      // Cleanup
      await cortex.conversations.delete(conv.conversationId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 5: Returning User (getOrCreate)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 5: Returning User (getOrCreate)", () => {
    it("should reuse existing active session for returning user", async () => {
      const returningUserId = generateTenantUserId(testTenantId);

      // First visit - creates new session
      const firstVisit = await cortex.sessions.getOrCreate(returningUserId);
      expect(firstVisit).toBeDefined();
      expect(firstVisit.userId).toBe(returningUserId);

      // Simulate some activity
      await cortex.sessions.touch(firstVisit.sessionId);

      // User returns (same browser tab or session storage)
      const secondVisit = await cortex.sessions.getOrCreate(returningUserId);

      // Should be the same session
      expect(secondVisit.sessionId).toBe(firstVisit.sessionId);

      // User returns again
      const thirdVisit = await cortex.sessions.getOrCreate(returningUserId);
      expect(thirdVisit.sessionId).toBe(firstVisit.sessionId);

      // Cleanup
      await cortex.sessions.end(firstVisit.sessionId);
    });

    it("should create new session after previous was ended", async () => {
      const userId = generateTenantUserId(testTenantId);

      // First session
      const session1 = await cortex.sessions.getOrCreate(userId);
      const session1Id = session1.sessionId;

      // End the session (user logs out)
      await cortex.sessions.end(session1Id);

      // User returns and logs in again
      const session2 = await cortex.sessions.getOrCreate(userId);

      // Should be a new session
      expect(session2.sessionId).not.toBe(session1Id);

      // Cleanup
      await cortex.sessions.end(session2.sessionId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 6: Session Listing and Filtering
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 6: Session Listing and Filtering", () => {
    const testSessions: Array<{ sessionId: string; status: string }> = [];
    const scenarioUserId = generateTenantUserId(testTenantId);

    beforeAll(async () => {
      // Create multiple sessions with different states
      for (let i = 0; i < 5; i++) {
        const session = await cortex.sessions.create({
          userId: scenarioUserId,
          tenantId: testTenantId,
          metadata: { index: i },
        });
        testSessions.push(session);
      }

      // End some sessions
      await cortex.sessions.end(testSessions[0].sessionId);
      await cortex.sessions.end(testSessions[1].sessionId);
    });

    afterAll(async () => {
      // Cleanup remaining active sessions
      for (const session of testSessions) {
        try {
          await cortex.sessions.end(session.sessionId);
        } catch {
          // Ignore
        }
      }
    });

    it("should list all sessions for user", async () => {
      const allSessions = await cortex.sessions.list({
        userId: scenarioUserId,
      });

      expect(allSessions.length).toBeGreaterThanOrEqual(5);
    });

    it("should filter by active status", async () => {
      const activeSessions = await cortex.sessions.list({
        userId: scenarioUserId,
        status: "active",
      });

      // Should have 3 active (5 total - 2 ended)
      expect(activeSessions.length).toBeGreaterThanOrEqual(3);
      activeSessions.forEach((s) => expect(s.status).toBe("active"));
    });

    it("should filter by ended status", async () => {
      const endedSessions = await cortex.sessions.list({
        userId: scenarioUserId,
        status: "ended",
      });

      // Should have at least 2 ended
      expect(endedSessions.length).toBeGreaterThanOrEqual(2);
      endedSessions.forEach((s) => expect(s.status).toBe("ended"));
    });

    it("should count sessions by status", async () => {
      const activeCount = await cortex.sessions.count({
        userId: scenarioUserId,
        status: "active",
      });

      const endedCount = await cortex.sessions.count({
        userId: scenarioUserId,
        status: "ended",
      });

      expect(activeCount).toBeGreaterThanOrEqual(3);
      expect(endedCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario 7: Concurrent Session Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Scenario 7: Concurrent Session Operations", () => {
    it("should handle concurrent session creations", async () => {
      const concurrentUserId = generateTenantUserId(testTenantId);

      // Simulate concurrent logins (e.g., user clicks login multiple times)
      const createPromises = Array(5)
        .fill(null)
        .map(() =>
          cortex.sessions.create({
            userId: concurrentUserId,
            tenantId: testTenantId,
          })
        );

      const sessions = await Promise.all(createPromises);

      // All should succeed
      expect(sessions.length).toBe(5);

      // All should have unique IDs
      const ids = sessions.map((s) => s.sessionId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);

      // Cleanup
      await cortex.sessions.endAll(concurrentUserId);
    });

    it("should handle concurrent touches on same session", async () => {
      const session = await cortex.sessions.create({
        userId: testUserId,
        tenantId: testTenantId,
      });

      // Simulate concurrent activity updates
      const touchPromises = Array(10)
        .fill(null)
        .map(() => cortex.sessions.touch(session.sessionId));

      await Promise.all(touchPromises);

      // Session should still be valid
      const updated = await cortex.sessions.get(session.sessionId);
      expect(updated?.status).toBe("active");

      // Cleanup
      await cortex.sessions.end(session.sessionId);
    });
  });
});
