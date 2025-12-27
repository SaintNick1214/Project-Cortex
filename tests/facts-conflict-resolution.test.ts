/**
 * Unit Tests - Conflict Resolution
 *
 * Tests for LLM prompt generation, decision parsing,
 * and fallback heuristics.
 */

import { describe, it, expect } from "@jest/globals";
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildConflictResolutionPrompt,
  parseConflictDecision,
  validateConflictDecision,
  getDefaultDecision,
  type ConflictCandidate,
} from "../src/facts/conflict-prompts";
import type { FactRecord } from "../src/types";

// Mock fact records for testing
const createMockFact = (override: Partial<FactRecord> = {}): FactRecord => {
  const factId =
    override.factId || `fact-${Math.random().toString(36).substring(7)}`;
  return {
    _id: `mock-id-${factId}`,
    factId,
    memorySpaceId: "test-space",
    fact: "Test fact",
    factType: "custom",
    subject: "user",
    predicate: "likes",
    object: "thing",
    confidence: 80,
    sourceType: "conversation",
    tags: [],
    version: 1,
    createdAt: Date.now() - 10000,
    updatedAt: Date.now() - 10000,
    ...override,
  };
};

describe("Conflict Resolution", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // System Prompt Generation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("buildSystemPrompt", () => {
    it("should include action types", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("UPDATE");
      expect(prompt).toContain("SUPERSEDE");
      expect(prompt).toContain("NONE");
      expect(prompt).toContain("ADD");
    });

    it("should include JSON output format", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("JSON");
      expect(prompt).toContain("action");
      expect(prompt).toContain("targetFactId");
      expect(prompt).toContain("reason");
    });

    it("should include examples by default", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("Example");
      expect(prompt).toContain("fact-");
    });

    it("should exclude examples when disabled", () => {
      const prompt = buildSystemPrompt({ includeExamples: false });
      expect(prompt).not.toContain("Example 1");
      expect(prompt).not.toContain("fact-001");
    });

    it("should include custom instructions when provided", () => {
      const prompt = buildSystemPrompt({
        customInstructions: "Always prefer UPDATE over SUPERSEDE",
      });
      expect(prompt).toContain("Always prefer UPDATE over SUPERSEDE");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // User Prompt Generation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("buildUserPrompt", () => {
    const newFact: ConflictCandidate = {
      fact: "User prefers purple",
      factType: "preference",
      subject: "user-123",
      predicate: "favorite color",
      object: "purple",
      confidence: 90,
      tags: ["color", "preference"],
    };

    it("should include new fact details", () => {
      const prompt = buildUserPrompt(newFact, []);
      expect(prompt).toContain("User prefers purple");
      expect(prompt).toContain("preference");
      expect(prompt).toContain("user-123");
      expect(prompt).toContain("favorite color");
      expect(prompt).toContain("purple");
      expect(prompt).toContain("90");
    });

    it("should indicate no existing facts when empty", () => {
      const prompt = buildUserPrompt(newFact, []);
      expect(prompt).toContain("No existing facts found");
    });

    it("should list existing facts", () => {
      const existingFacts = [
        createMockFact({
          factId: "fact-001",
          fact: "User likes blue",
          subject: "user-123",
          predicate: "favorite color",
          object: "blue",
        }),
      ];
      const prompt = buildUserPrompt(newFact, existingFacts);
      expect(prompt).toContain("fact-001");
      expect(prompt).toContain("User likes blue");
    });

    it("should limit existing facts based on option", () => {
      const existingFacts = Array(20)
        .fill(null)
        .map((_, i) =>
          createMockFact({
            factId: `fact-${i}`,
            fact: `Fact ${i}`,
          }),
        );
      const prompt = buildUserPrompt(newFact, existingFacts, {
        maxExistingFacts: 5,
      });
      expect(prompt).toContain("fact-0");
      expect(prompt).toContain("fact-4");
      expect(prompt).not.toContain("fact-5");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Complete Prompt Generation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("buildConflictResolutionPrompt", () => {
    it("should return system and user prompts", () => {
      const newFact: ConflictCandidate = {
        fact: "Test fact",
        confidence: 80,
      };
      const result = buildConflictResolutionPrompt(newFact, []);
      expect(result).toHaveProperty("system");
      expect(result).toHaveProperty("user");
      expect(typeof result.system).toBe("string");
      expect(typeof result.user).toBe("string");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Decision Parsing
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("parseConflictDecision", () => {
    it("should parse valid UPDATE decision", () => {
      const response = `
        {
          "action": "UPDATE",
          "targetFactId": "fact-001",
          "reason": "New fact is more specific",
          "mergedFact": "User's favorite color is purple",
          "confidence": 90
        }
      `;
      const decision = parseConflictDecision(response);
      expect(decision.action).toBe("UPDATE");
      expect(decision.targetFactId).toBe("fact-001");
      expect(decision.reason).toBe("New fact is more specific");
      expect(decision.mergedFact).toBe("User's favorite color is purple");
      expect(decision.confidence).toBe(90);
    });

    it("should parse valid SUPERSEDE decision", () => {
      const response = `
        {
          "action": "SUPERSEDE",
          "targetFactId": "fact-002",
          "reason": "Location has changed",
          "mergedFact": null,
          "confidence": 85
        }
      `;
      const decision = parseConflictDecision(response);
      expect(decision.action).toBe("SUPERSEDE");
      expect(decision.targetFactId).toBe("fact-002");
      expect(decision.mergedFact).toBeNull();
    });

    it("should parse valid NONE decision", () => {
      const response = `
        {
          "action": "NONE",
          "targetFactId": "fact-003",
          "reason": "Duplicate information"
        }
      `;
      const decision = parseConflictDecision(response);
      expect(decision.action).toBe("NONE");
      expect(decision.targetFactId).toBe("fact-003");
    });

    it("should parse valid ADD decision", () => {
      const response = `
        {
          "action": "ADD",
          "targetFactId": null,
          "reason": "New information"
        }
      `;
      const decision = parseConflictDecision(response);
      expect(decision.action).toBe("ADD");
      expect(decision.targetFactId).toBeNull();
    });

    it("should extract JSON from surrounding text", () => {
      const response = `
        Based on my analysis, here is the decision:
        
        {
          "action": "UPDATE",
          "targetFactId": "fact-001",
          "reason": "Refinement"
        }
        
        This decision was made because...
      `;
      const decision = parseConflictDecision(response);
      expect(decision.action).toBe("UPDATE");
    });

    it("should throw on invalid action", () => {
      const response = `{"action": "INVALID", "targetFactId": null, "reason": "test"}`;
      expect(() => parseConflictDecision(response)).toThrow("Invalid action");
    });

    it("should throw on missing JSON", () => {
      const response = "No JSON here";
      expect(() => parseConflictDecision(response)).toThrow(
        "No JSON object found",
      );
    });

    it("should throw on malformed JSON", () => {
      const response = `{"action": "UPDATE", targetFactId: null}`;
      expect(() => parseConflictDecision(response)).toThrow(
        "Failed to parse JSON",
      );
    });

    it("should default confidence to 75 if not provided", () => {
      const response = `{"action": "ADD", "targetFactId": null, "reason": "test"}`;
      const decision = parseConflictDecision(response);
      expect(decision.confidence).toBe(75);
    });

    it("should default reason if not provided", () => {
      const response = `{"action": "ADD", "targetFactId": null}`;
      const decision = parseConflictDecision(response);
      expect(decision.reason).toBe("No reason provided");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Decision Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateConflictDecision", () => {
    const existingFacts = [createMockFact({ factId: "fact-001" })];

    it("should validate valid UPDATE decision", () => {
      const decision = {
        action: "UPDATE" as const,
        targetFactId: "fact-001",
        reason: "Test",
        mergedFact: "New fact text",
      };
      const result = validateConflictDecision(decision, existingFacts);
      expect(result.valid).toBe(true);
    });

    it("should reject UPDATE without targetFactId", () => {
      const decision = {
        action: "UPDATE" as const,
        targetFactId: null,
        reason: "Test",
        mergedFact: "New fact text",
      };
      const result = validateConflictDecision(decision, existingFacts);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("requires a targetFactId");
    });

    it("should reject UPDATE without mergedFact", () => {
      const decision = {
        action: "UPDATE" as const,
        targetFactId: "fact-001",
        reason: "Test",
        mergedFact: null,
      };
      const result = validateConflictDecision(decision, existingFacts);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("requires a mergedFact");
    });

    it("should reject SUPERSEDE without targetFactId", () => {
      const decision = {
        action: "SUPERSEDE" as const,
        targetFactId: null,
        reason: "Test",
        mergedFact: null,
      };
      const result = validateConflictDecision(decision, existingFacts);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("requires a targetFactId");
    });

    it("should reject unknown targetFactId", () => {
      const decision = {
        action: "UPDATE" as const,
        targetFactId: "fact-unknown",
        reason: "Test",
        mergedFact: "New text",
      };
      const result = validateConflictDecision(decision, existingFacts);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should validate ADD without targetFactId", () => {
      const decision = {
        action: "ADD" as const,
        targetFactId: null,
        reason: "Test",
        mergedFact: null,
      };
      const result = validateConflictDecision(decision, existingFacts);
      expect(result.valid).toBe(true);
    });

    it("should reject confidence out of range", () => {
      const decision = {
        action: "ADD" as const,
        targetFactId: null,
        reason: "Test",
        mergedFact: null,
        confidence: 150,
      };
      const result = validateConflictDecision(decision, existingFacts);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Confidence");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Default Decision (Fallback Heuristics)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getDefaultDecision", () => {
    it("should ADD when no existing facts", () => {
      const newFact: ConflictCandidate = {
        fact: "User likes pizza",
        confidence: 80,
      };
      const decision = getDefaultDecision(newFact, []);
      expect(decision.action).toBe("ADD");
      expect(decision.confidence).toBe(100);
    });

    it("should UPDATE for high similarity with higher confidence", () => {
      // Need >0.8 word overlap similarity. Using identical facts gives 1.0
      const newFact: ConflictCandidate = {
        fact: "User likes pizza",
        confidence: 90,
        subject: "user",
      };
      const existingFacts = [
        createMockFact({
          factId: "fact-001",
          fact: "User likes pizza",
          confidence: 70,
          subject: "user",
        }),
      ];
      const decision = getDefaultDecision(newFact, existingFacts);
      expect(decision.action).toBe("UPDATE");
      expect(decision.targetFactId).toBe("fact-001");
    });

    it("should return NONE for high similarity duplicate", () => {
      const newFact: ConflictCandidate = {
        fact: "User likes pizza",
        confidence: 70,
        subject: "user",
      };
      const existingFacts = [
        createMockFact({
          factId: "fact-001",
          fact: "User likes pizza",
          confidence: 90,
          subject: "user",
        }),
      ];
      const decision = getDefaultDecision(newFact, existingFacts);
      expect(decision.action).toBe("NONE");
      expect(decision.targetFactId).toBe("fact-001");
    });

    it("should SUPERSEDE for same subject with medium similarity", () => {
      // Need 0.5 < similarity <= 0.8 and same subject
      // "User lives in New York" vs "User lives in San Francisco"
      // Words: new = {user, lives, in, san, francisco} = 5
      //        existing = {user, lives, in, new, york} = 5
      //        intersection = {user, lives, in} = 3
      //        union = 7
      //        similarity = 3/7 ≈ 0.43 (not >0.5)
      // Let's use more overlapping facts:
      const newFact: ConflictCandidate = {
        fact: "User prefers the color blue now",
        confidence: 90,
        subject: "user-123",
      };
      const existingFacts = [
        createMockFact({
          factId: "fact-001",
          fact: "User prefers the color red",
          confidence: 80,
          subject: "user-123",
        }),
      ];
      // Words: new = {user, prefers, the, color, blue, now} = 6
      //        existing = {user, prefers, the, color, red} = 5
      //        intersection = {user, prefers, the, color} = 4
      //        union = 7
      //        similarity = 4/7 ≈ 0.57 > 0.5 ✓
      const decision = getDefaultDecision(newFact, existingFacts);
      expect(decision.action).toBe("SUPERSEDE");
      expect(decision.targetFactId).toBe("fact-001");
    });

    it("should ADD for low similarity facts", () => {
      const newFact: ConflictCandidate = {
        fact: "User enjoys hiking",
        confidence: 80,
        subject: "user",
      };
      const existingFacts = [
        createMockFact({
          factId: "fact-001",
          fact: "User works at Google",
          confidence: 80,
          subject: "user",
        }),
      ];
      const decision = getDefaultDecision(newFact, existingFacts);
      expect(decision.action).toBe("ADD");
      expect(decision.targetFactId).toBeNull();
    });
  });
});
