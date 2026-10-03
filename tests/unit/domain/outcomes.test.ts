import { describe, expect, it } from "@jest/globals";
import {
  buildConflictResolutionPrompt, classifyPredicate, cosineSimilarity, deduplicateResults,
  extractSlot, factToRecallItem, formatForLLM, getDefaultDecision,
  normalizeFactText, normalizePredicate, normalizeSubject, parseConflictDecision,
  parseFactsResponse, processRecallResults, rankResults, validateConflictDecision,
} from "../../../src/domain/index.js";
import { rankResults as rankClientResults } from "../../../src/memory/recall/resultProcessor.js";
import type { FactRecord } from "../../../src/types/index.js";

const now = Date.UTC(2026, 9, 3);
const day = 24 * 60 * 60 * 1000;
const clock = { now: () => now };
function fact(overrides: Partial<FactRecord> = {}): FactRecord {
  return {
    _id: "internal", factId: "fact-1", memorySpaceId: "space", fact: "User prefers purple", factType: "preference",
    subject: "user", predicate: "favorite color", object: "purple", confidence: 90, sourceType: "conversation",
    tags: [], version: 1, createdAt: now - 30 * day, updatedAt: now, ...overrides,
  };
}

describe("reused memory outcomes", () => {
  it("preserves slot, subject, predicate and exact dedup normalization outcomes", () => {
    expect(normalizeSubject(" Alice   Smith ")).toBe("alice smith");
    expect(normalizePredicate(" Works At! ")).toBe("works at");
    expect(classifyPredicate("lives in")).toBe("location");
    expect(extractSlot(" User ", "favorite colour")).toEqual({ subject: "user", predicateClass: "favorite_color" });
    expect(extractSlot(undefined, "lives in")).toBeNull();
    expect(normalizeFactText("The USER is happy!")).toBe("user  happy");
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
    expect(() => cosineSimilarity([1], [1, 2])).toThrow("dimension mismatch");
    expect(() => cosineSimilarity([NaN], [1])).toThrow("finite");
    expect(() => cosineSimilarity(Array<number>(2), [1, 2])).toThrow("dense and finite");
    expect(() => cosineSimilarity([1, 2], Array<number>(2))).toThrow("dense and finite");
  });

  it("keeps permissive legacy extraction normalization separate from strict attributed extraction", () => {
    const facts = parseFactsResponse('```json\n{"facts":[{"fact":"User lives in SF","factType":"ODD","confidence":2,"entities":[{"name":" SF ","type":"place","fullValue":"San Francisco"}],"relations":[{"subject":" User ","predicate":" LIVES IN ","object":" SF "}]}]}\n```');
    expect(facts).toEqual([{ fact: "User lives in SF", factType: "custom", confidence: 1, subject: undefined, predicate: undefined, object: undefined, tags: undefined,
      entities: [{ name: "SF", type: "place", fullValue: "San Francisco" }], relations: [{ subject: "User", predicate: "lives_in", object: "SF" }] }]);
    expect(parseFactsResponse("not JSON")).toBeNull();
    expect(parseFactsResponse('{"facts":{}}')).toBeNull();
    expect(parseFactsResponse('{"facts":[]}')).toEqual([]);
  });

  it("uses injected time for the established ranking weights without mutating input", () => {
    const item = factToRecallItem(fact(), "facts", 0.5);
    const before = structuredClone(item);
    const ranked = rankResults([item], clock);
    expect(ranked[0].score).toBeCloseTo(0.175 + 0.18 + 0.135 + 0.075 + Math.log2(3) / Math.log2(11) * 0.15);
    expect(item).toEqual(before);
    expect(rankClientResults([item], clock)).toEqual(ranked);
    const graph = { ...item, source: "graph-expanded" as const, graphContext: { connectedEntities: ["Acme"] } };
    const merged = deduplicateResults([item, graph]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("facts");
    expect(merged[0].score).toBeCloseTo(0.55);
    expect(merged[0].graphContext?.connectedEntities).toEqual(["user", "purple", "Acme"]);
    expect(item).toEqual(before);
  });

  it("formats temporal status from the same clock and a deterministic long-date style", () => {
    const current = factToRecallItem(fact({ createdAt: now - 2 * day, validUntil: now - 1, supersedes: "old" }), "facts");
    const text = formatForLLM([current], clock);
    expect(text).toContain("recorded: 2 days ago");
    expect(text).toContain("✓ CURRENT - replaced previous value");
    expect(text).toContain("⚠️ EXPIRED");
    expect(formatForLLM([factToRecallItem(fact({ createdAt: now - 31 * day }), "facts")], clock)).toContain("recorded: 2026-09-02");
    expect(processRecallResults([], [], [], [], [], {}, clock)).toEqual({
      items: [], sources: { vector: { count: 0, items: [] }, facts: { count: 0, items: [] }, graph: { count: 0, expandedEntities: [] } }, context: "",
    });
  });

  it("preserves conflict decision outcomes and clock-based validity metadata", () => {
    const newFact = { fact: "User prefers blue", subject: "user", predicate: "favorite color", object: "blue", confidence: 95 };
    expect(getDefaultDecision(newFact, [fact()])).toMatchObject({ action: "SUPERSEDE", targetFactId: "fact-1" });
    expect(getDefaultDecision({ ...newFact, fact: "User prefers purple", object: "purple" }, [fact()])).toMatchObject({ action: "UPDATE", targetFactId: "fact-1" });
    const prompts = buildConflictResolutionPrompt(newFact, [fact({ validUntil: now - 1 })], { includeExamples: false }, clock);
    expect(prompts.user).toContain("(EXPIRED)");
    expect(prompts.system).toContain("NEVER merge superseded facts");
    const decision = parseConflictDecision('{"action":"UPDATE","targetFactId":"fact-1","mergedFact":"Updated","confidence":90}');
    expect(validateConflictDecision(decision, [fact()])).toEqual({ valid: true });
    expect(validateConflictDecision({ ...decision, targetFactId: "other" }, [fact()]).valid).toBe(false);
    expect(validateConflictDecision({ ...decision, confidence: NaN }, [fact()]).valid).toBe(false);
    expect(() => parseConflictDecision('{"action":"INVALID"}')).toThrow("Invalid action");
  });
});
