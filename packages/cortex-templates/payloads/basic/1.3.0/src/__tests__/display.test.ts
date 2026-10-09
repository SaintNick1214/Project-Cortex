/**
 * Unit tests for display.ts
 *
 * Tests phase-aware orchestration display (v0.35.1+)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  printOrchestrationStart,
  printLayerUpdate,
  printOrchestrationComplete,
  printRecallStart,
  printRecallComplete,
  printRememberStart,
  printRememberComplete,
  printRecallResults,
  printWelcome,
  printError,
  printInfo,
  printSuccess,
} from "../display.js";
import type { LayerEvent } from "../cortex.js";

describe("display", () => {
  let consoleLogs: string[] = [];
  const originalConsoleLog = console.log;

  beforeEach(() => {
    consoleLogs = [];
    console.log = vi.fn((...args) => {
      consoleLogs.push(args.join(" "));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    vi.clearAllMocks();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Phase-Aware Tests (v0.35.1+)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("printRecallStart", () => {
    it("prints recall header with box drawing", () => {
      printRecallStart("test-recall-id");

      const output = consoleLogs.join("\n");
      expect(output).toContain("┌");
      expect(output).toContain("MEMORY RECALL");
      expect(output).toContain("Retrieving context");
      expect(output).toContain("├");
    });
  });

  describe("printRecallComplete", () => {
    it("prints recall complete with timing", () => {
      printRecallStart("test-id");
      consoleLogs = [];

      printRecallComplete(50);

      const output = consoleLogs.join("\n");
      expect(output).toContain("Recall complete: 50ms");
      expect(output).toContain("└");
    });

    it("does nothing when no recall is active", () => {
      // Don't call printRecallStart
      consoleLogs = [];

      printRecallComplete(100);

      expect(consoleLogs.length).toBe(0);
    });
  });

  describe("printRememberStart", () => {
    it("prints remember header with box drawing", () => {
      printRememberStart("test-remember-id");

      const output = consoleLogs.join("\n");
      expect(output).toContain("┌");
      expect(output).toContain("MEMORY STORAGE");
      expect(output).toContain("Storing memories");
      expect(output).toContain("├");
    });
  });

  describe("printRememberComplete", () => {
    it("prints remember complete with timing", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      printRememberComplete(75);

      const output = consoleLogs.join("\n");
      expect(output).toContain("Storage complete: 75ms");
      expect(output).toContain("└");
    });

    it("does nothing when no remember is active", () => {
      // Don't call printRememberStart
      consoleLogs = [];

      printRememberComplete(100);

      expect(consoleLogs.length).toBe(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Legacy Tests (Deprecated but still supported)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("printOrchestrationStart", () => {
    it("prints header with box drawing", () => {
      printOrchestrationStart("test-orchestration-id");

      const output = consoleLogs.join("\n");
      expect(output).toContain("┌");
      expect(output).toContain("MEMORY ORCHESTRATION");
      expect(output).toContain("├");
    });

    it("clears previous state on new orchestration", () => {
      printOrchestrationStart("first-id");
      printOrchestrationStart("second-id");

      // Should have printed headers twice
      const headerCount = consoleLogs.filter((log) =>
        log.includes("MEMORY ORCHESTRATION"),
      ).length;
      expect(headerCount).toBe(2);
    });
  });

  describe("printLayerUpdate", () => {
    it("prints layer status on completion (remember phase)", () => {
      printRememberStart("test-id");
      consoleLogs = []; // Clear header output

      const event: LayerEvent = {
        layer: "memorySpace",
        status: "complete",
        timestamp: Date.now(),
        latencyMs: 10,
        phase: "remember",
        data: { id: "test-space" },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("📦");
      expect(output).toContain("Memory Space");
      expect(output).toContain("✓");
      expect(output).toContain("complete");
      expect(output).toContain("(10ms)");
      expect(output).toContain("test-space");
    });

    it("skips in_progress status", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "user",
        status: "in_progress",
        timestamp: Date.now(),
        phase: "remember",
      };

      printLayerUpdate(event);

      // Should not print anything for in_progress
      expect(consoleLogs.length).toBe(0);
    });

    it("prints user layer data", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "user",
        status: "complete",
        timestamp: Date.now(),
        phase: "remember",
        data: { id: "user-123", name: "Test User" },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("👤");
      expect(output).toContain("user-123");
      expect(output).toContain("Test User");
    });

    it("prints agent layer data", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "agent",
        status: "complete",
        timestamp: Date.now(),
        phase: "remember",
        data: { id: "agent-123", name: "Test Agent" },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("🤖");
      expect(output).toContain("agent-123");
      expect(output).toContain("Test Agent");
    });

    it("prints context layer data (recall phase)", () => {
      printRecallStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "context",
        status: "complete",
        timestamp: Date.now(),
        phase: "recall",
        data: { memoriesCount: 5, factsCount: 3, graphEntitiesCount: 2 },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("🧠");
      expect(output).toContain("Context");
      expect(output).toContain("Memories: 5");
      expect(output).toContain("Facts: 3");
      expect(output).toContain("Graph entities: 2");
    });

    it("prints conversation layer data", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "conversation",
        status: "complete",
        timestamp: Date.now(),
        phase: "remember",
        data: { id: "conv-123", messageCount: 5, preview: "Hello world" },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("💬");
      expect(output).toContain("conv-123");
      expect(output).toContain("Messages: 5");
      expect(output).toContain("Hello world");
    });

    it("prints vector layer data (remember phase)", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "vector",
        status: "complete",
        timestamp: Date.now(),
        phase: "remember",
        data: { dimensions: 1536, importance: 85 },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("🎯");
      expect(output).toContain("1536 dimensions");
      expect(output).toContain("Importance: 85");
    });

    it("prints vector layer data with match count (recall phase)", () => {
      printRecallStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "vector",
        status: "complete",
        timestamp: Date.now(),
        phase: "recall",
        data: { matchCount: 10 },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("🎯");
      expect(output).toContain("Matches: 10");
    });

    it("prints facts layer data with revision badge", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "facts",
        status: "complete",
        timestamp: Date.now(),
        phase: "remember",
        revisionAction: "ADD",
        data: {
          facts: [
            { content: "User likes coffee", factType: "preference", confidence: 90 },
          ],
        },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("💡");
      expect(output).toContain("[NEW]");
      expect(output).toContain("User likes coffee");
      expect(output).toContain("preference");
      expect(output).toContain("90%");
    });

    it("prints superseded facts", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "facts",
        status: "complete",
        timestamp: Date.now(),
        phase: "remember",
        revisionAction: "SUPERSEDE",
        supersededFacts: ["Old fact 1", "Old fact 2"],
        data: { facts: [{ content: "New fact" }] },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("[SUPERSEDED]");
      expect(output).toContain("Superseded:");
      expect(output).toContain("Old fact 1");
      expect(output).toContain("Old fact 2");
    });

    it("prints graph layer data", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "graph",
        status: "complete",
        timestamp: Date.now(),
        phase: "remember",
        data: { nodes: 5, edges: 8 },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("🕸️");
      expect(output).toContain("Nodes: 5");
      expect(output).toContain("Edges: 8");
    });

    it("prints skipped status", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "graph",
        status: "skipped",
        timestamp: Date.now(),
        phase: "remember",
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("○");
      expect(output).toContain("skipped");
    });

    it("prints error status", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "vector",
        status: "error",
        timestamp: Date.now(),
        phase: "remember",
        error: { message: "Embedding failed" },
      };

      printLayerUpdate(event);

      const output = consoleLogs.join("\n");
      expect(output).toContain("✗");
      expect(output).toContain("error");
    });

    it("ignores unknown layers", () => {
      printRememberStart("test-id");
      consoleLogs = [];

      const event: LayerEvent = {
        layer: "unknown-layer" as LayerEvent["layer"],
        status: "complete",
        timestamp: Date.now(),
        phase: "remember",
      };

      printLayerUpdate(event);

      // Should not print anything for unknown layer
      expect(consoleLogs.length).toBe(0);
    });
  });

  describe("printOrchestrationComplete", () => {
    it("prints total time", () => {
      printOrchestrationStart("test-id");
      consoleLogs = [];

      printOrchestrationComplete(150);

      const output = consoleLogs.join("\n");
      expect(output).toContain("Total: 150ms");
      expect(output).toContain("└");
    });

    it("does nothing when no orchestration is active", () => {
      // Don't call printOrchestrationStart
      consoleLogs = [];

      printOrchestrationComplete(100);

      // First call should work, second should not print
      printOrchestrationStart("test-id");
      printOrchestrationComplete(100);
      const firstCount = consoleLogs.length;

      printOrchestrationComplete(100); // No active orchestration now

      expect(consoleLogs.length).toBe(firstCount);
    });
  });

  describe("printRecallResults", () => {
    it("prints empty results message", () => {
      printRecallResults([], []);

      const output = consoleLogs.join("\n");
      expect(output).toContain("MEMORY RECALL");
      expect(output).toContain("No relevant memories found");
    });

    it("prints memories", () => {
      const memories = [
        { content: "User said hello", importance: 80 },
        { content: "User asked about weather", importance: 60 },
      ];

      printRecallResults(memories, []);

      const output = consoleLogs.join("\n");
      expect(output).toContain("🎯 2 relevant memories:");
      expect(output).toContain("User said hello");
      expect(output).toContain("[80]");
      expect(output).toContain("User asked about weather");
    });

    it("prints facts", () => {
      const facts = [
        { content: "User's name is Alex", factType: "identity" },
        { content: "User works at Acme", factType: "employment" },
      ];

      printRecallResults([], facts);

      const output = consoleLogs.join("\n");
      expect(output).toContain("💡 2 known facts:");
      expect(output).toContain("User's name is Alex");
      expect(output).toContain("(identity)");
      expect(output).toContain("User works at Acme");
    });

    it("truncates long lists", () => {
      const memories = Array(10)
        .fill(null)
        .map((_, i) => ({ content: `Memory ${i}` }));

      printRecallResults(memories, []);

      const output = consoleLogs.join("\n");
      expect(output).toContain("... and 5 more");
    });
  });

  describe("printWelcome", () => {
    it("prints CLI mode welcome", () => {
      printWelcome("cli");

      const output = consoleLogs.join("\n");
      expect(output).toContain("🧠 Cortex Memory");
      expect(output).toContain("Basic Demo");
      expect(output).toContain("Type a message");
      expect(output).toContain("/recall");
      expect(output).toContain("/exit");
    });

    it("prints server mode welcome", () => {
      printWelcome("server");

      const output = consoleLogs.join("\n");
      expect(output).toContain("🧠 Cortex Memory");
      expect(output).toContain("Server mode");
      expect(output).toContain("POST /chat");
    });
  });

  describe("printError", () => {
    it("prints error message", () => {
      printError("Something went wrong");

      const output = consoleLogs.join("\n");
      expect(output).toContain("❌ Error:");
      expect(output).toContain("Something went wrong");
    });

    it("prints stack trace in debug mode", () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = "true";

      const error = new Error("Test error");
      printError("Failed", error);

      const output = consoleLogs.join("\n");
      expect(output).toContain("Test error");

      process.env.DEBUG = originalDebug;
    });
  });

  describe("printInfo", () => {
    it("prints info message with icon", () => {
      printInfo("Some information");

      const output = consoleLogs.join("\n");
      expect(output).toContain("ℹ");
      expect(output).toContain("Some information");
    });
  });

  describe("printSuccess", () => {
    it("prints success message with checkmark", () => {
      printSuccess("Operation completed");

      const output = consoleLogs.join("\n");
      expect(output).toContain("✓");
      expect(output).toContain("Operation completed");
    });
  });

  describe("box drawing", () => {
    it("maintains consistent box width", () => {
      printOrchestrationStart("test-id");

      // All lines with box characters should have consistent width
      const boxLines = consoleLogs.filter(
        (line) =>
          line.includes("│") || line.includes("┌") || line.includes("└"),
      );

      const firstLineLength = boxLines[0]?.replace(/\x1b\[[0-9;]*m/g, "").length;

      boxLines.forEach((line) => {
        const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, "");
        expect(cleanLine.length).toBe(firstLineLength);
      });
    });
  });
});
