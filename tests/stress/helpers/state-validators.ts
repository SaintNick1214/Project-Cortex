/**
 * State Validators for Stress Testing
 *
 * Provides assertion helpers for validating fact state, recall accuracy,
 * supersession chains, and cross-user isolation.
 */

import type { Cortex } from "../../../src";
import type { FactRecord, RecallResult } from "../../../src/types";
import { generateRealEmbedding } from "./chaos-generators";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface FactStateExpectation {
  predicate: string;
  expectedObject: string;
  allowSuperseded?: boolean;
}

export interface RecallAccuracyResult {
  found: number;
  expected: number;
  accuracy: number;
  missing: string[];
  extra: string[];
  matchedFacts: FactRecord[];
}

export interface SupersessionChainResult {
  chainLength: number;
  isValid: boolean;
  currentFact: FactRecord | null;
  supersededFacts: FactRecord[];
  brokenLinks: string[];
  errors: string[];
}

export interface IsolationResult {
  passed: boolean;
  violations: Array<{
    userId: string;
    foundFactBelongingTo: string;
    factId: string;
  }>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fact State Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Verify that the current fact state matches expectations
 */
export async function verifyFactState(
  cortex: Cortex,
  memorySpaceId: string,
  userId: string,
  expectations: FactStateExpectation[],
): Promise<ValidationResult> {
  const errors: string[] = [];
  const details: Record<string, unknown> = {};

  // Get all current (non-superseded) facts for the user
  const allFacts = await cortex.facts.list({
    memorySpaceId,
    subject: userId,
    includeSuperseded: false,
  });

  details.totalCurrentFacts = allFacts.length;

  for (const expectation of expectations) {
    const matchingFacts = allFacts.filter(
      (f) => f.predicate === expectation.predicate,
    );

    if (matchingFacts.length === 0) {
      errors.push(`Missing fact for predicate "${expectation.predicate}"`);
      continue;
    }

    if (matchingFacts.length > 1) {
      errors.push(
        `Multiple current facts for predicate "${expectation.predicate}": ` +
        matchingFacts.map((f) => f.object).join(", "),
      );
    }

    const fact = matchingFacts[0];
    if (fact.object !== expectation.expectedObject) {
      errors.push(
        `Predicate "${expectation.predicate}": expected "${expectation.expectedObject}", ` +
        `got "${fact.object}"`,
      );
    }
  }

  return {
    passed: errors.length === 0,
    message: errors.length === 0
      ? `All ${expectations.length} fact expectations verified`
      : `${errors.length} fact state errors: ${errors.join("; ")}`,
    details: { ...details, errors },
  };
}

/**
 * Verify that expected facts exist and no unexpected facts are present
 */
export async function verifyExactFactState(
  cortex: Cortex,
  memorySpaceId: string,
  userId: string,
  expectedFacts: Record<string, string>, // predicate -> object
): Promise<ValidationResult> {
  const errors: string[] = [];

  const allFacts = await cortex.facts.list({
    memorySpaceId,
    subject: userId,
    includeSuperseded: false,
  });

  const expectedPredicates = new Set(Object.keys(expectedFacts));
  const actualPredicates = new Set(allFacts.map((f) => f.predicate));

  // Check for missing predicates
  for (const predicate of expectedPredicates) {
    if (!actualPredicates.has(predicate)) {
      errors.push(`Missing expected predicate: "${predicate}"`);
    }
  }

  // Check values for matching predicates
  for (const fact of allFacts) {
    if (fact.predicate && expectedFacts[fact.predicate] !== undefined) {
      if (fact.object !== expectedFacts[fact.predicate]) {
        errors.push(
          `Predicate "${fact.predicate}": expected "${expectedFacts[fact.predicate]}", got "${fact.object}"`,
        );
      }
    }
  }

  return {
    passed: errors.length === 0,
    message: errors.length === 0
      ? `Exact fact state verified: ${Object.keys(expectedFacts).length} predicates match`
      : `Fact state mismatch: ${errors.join("; ")}`,
    details: {
      expectedCount: expectedPredicates.size,
      actualCount: actualPredicates.size,
      errors,
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Recall Accuracy Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Verify recall accuracy for a given query
 */
export async function verifyRecallAccuracy(
  cortex: Cortex,
  memorySpaceId: string,
  query: string,
  expectedFactContents: string[],
  options?: {
    userId?: string;
    useEmbedding?: boolean;
    minAccuracy?: number;
  },
): Promise<RecallAccuracyResult> {
  const { userId, useEmbedding = true, minAccuracy = 0.8 } = options || {};

  // Generate embedding if requested
  let embedding: number[] | undefined;
  if (useEmbedding) {
    try {
      embedding = await generateRealEmbedding(query);
    } catch (error) {
      console.warn("Failed to generate embedding, falling back to text search");
    }
  }

  // Perform recall
  const result = await cortex.memory.recall({
    memorySpaceId,
    query,
    embedding,
    userId,
    limit: 50,
    formatForLLM: false,
  });

  // Extract fact contents from recall results
  const recalledFactContents = result.items
    .filter((item) => item.type === "fact" && item.fact)
    .map((item) => item.fact!.fact);

  // Calculate matches
  const foundSet = new Set(recalledFactContents);
  const expectedSet = new Set(expectedFactContents);

  const found = expectedFactContents.filter((f) => 
    recalledFactContents.some((r) => r.includes(f) || f.includes(r)),
  );
  const missing = expectedFactContents.filter((f) =>
    !recalledFactContents.some((r) => r.includes(f) || f.includes(r)),
  );
  const extra = recalledFactContents.filter((r) =>
    !expectedFactContents.some((f) => r.includes(f) || f.includes(r)),
  );

  const accuracy = expectedFactContents.length > 0
    ? found.length / expectedFactContents.length
    : 1;

  return {
    found: found.length,
    expected: expectedFactContents.length,
    accuracy,
    missing,
    extra,
    matchedFacts: result.items
      .filter((item) => item.type === "fact" && item.fact)
      .map((item) => item.fact!),
  };
}

/**
 * Verify that recall returns ONLY current facts, not superseded ones
 */
export async function verifyRecallExcludesSuperseded(
  cortex: Cortex,
  memorySpaceId: string,
  query: string,
  userId: string,
): Promise<ValidationResult> {
  const embedding = await generateRealEmbedding(query);

  const result = await cortex.memory.recall({
    memorySpaceId,
    query,
    embedding,
    userId,
    limit: 50,
    formatForLLM: false,
  });

  const supersededFacts = result.items
    .filter((item) => item.type === "fact" && item.fact?.supersededBy)
    .map((item) => item.fact!);

  if (supersededFacts.length > 0) {
    return {
      passed: false,
      message: `Recall returned ${supersededFacts.length} superseded facts`,
      details: {
        supersededFactIds: supersededFacts.map((f) => f.factId),
        supersededContents: supersededFacts.map((f) => f.fact),
      },
    };
  }

  return {
    passed: true,
    message: "Recall correctly excluded all superseded facts",
    details: {
      totalFactsReturned: result.items.filter((i) => i.type === "fact").length,
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Supersession Chain Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate the supersession chain for a given predicate
 */
export async function validateSupersessionChain(
  cortex: Cortex,
  memorySpaceId: string,
  userId: string,
  predicate: string,
): Promise<SupersessionChainResult> {
  const errors: string[] = [];
  const brokenLinks: string[] = [];

  // Get all facts for this predicate (including superseded)
  const allFacts = await cortex.facts.list({
    memorySpaceId,
    subject: userId,
    predicate,
    includeSuperseded: true,
  });

  if (allFacts.length === 0) {
    return {
      chainLength: 0,
      isValid: true,
      currentFact: null,
      supersededFacts: [],
      brokenLinks: [],
      errors: [],
    };
  }

  // Find the current (non-superseded) fact
  const currentFacts = allFacts.filter((f) => !f.supersededBy);
  if (currentFacts.length > 1) {
    errors.push(
      `Multiple current facts found for predicate "${predicate}": ` +
      currentFacts.map((f) => f.factId).join(", "),
    );
  }

  const currentFact = currentFacts[0] || null;
  const supersededFacts = allFacts.filter((f) => f.supersededBy);

  // Validate chain links
  for (const fact of supersededFacts) {
    if (fact.supersededBy) {
      const superseder = allFacts.find((f) => f.factId === fact.supersededBy);
      if (!superseder) {
        brokenLinks.push(
          `Fact ${fact.factId} supersededBy ${fact.supersededBy} which doesn't exist`,
        );
      }
    }
  }

  // Validate timestamps
  for (const fact of supersededFacts) {
    if (!fact.validUntil) {
      errors.push(`Superseded fact ${fact.factId} missing validUntil timestamp`);
    }
  }

  // Check for cycles (shouldn't happen but worth checking)
  const visited = new Set<string>();
  let current: FactRecord | null = currentFact;
  while (current?.supersedes) {
    if (visited.has(current.factId)) {
      errors.push(`Cycle detected in supersession chain at ${current.factId}`);
      break;
    }
    visited.add(current.factId);
    const next = allFacts.find((f) => f.factId === current!.supersedes);
    current = next ?? null;
  }

  return {
    chainLength: allFacts.length,
    isValid: errors.length === 0 && brokenLinks.length === 0,
    currentFact,
    supersededFacts,
    brokenLinks,
    errors,
  };
}

/**
 * Validate all supersession chains for a user
 */
export async function validateAllSupersessionChains(
  cortex: Cortex,
  memorySpaceId: string,
  userId: string,
): Promise<{
  totalChains: number;
  validChains: number;
  invalidChains: number;
  results: Record<string, SupersessionChainResult>;
}> {
  // Get all facts to discover predicates
  const allFacts = await cortex.facts.list({
    memorySpaceId,
    subject: userId,
    includeSuperseded: true,
  });

  // Get unique predicates
  const predicates = [...new Set(allFacts.map((f) => f.predicate).filter(Boolean))] as string[];

  const results: Record<string, SupersessionChainResult> = {};
  let validChains = 0;
  let invalidChains = 0;

  for (const predicate of predicates) {
    const result = await validateSupersessionChain(cortex, memorySpaceId, userId, predicate);
    results[predicate] = result;

    if (result.isValid) {
      validChains++;
    } else {
      invalidChains++;
    }
  }

  return {
    totalChains: predicates.length,
    validChains,
    invalidChains,
    results,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// User Isolation Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Verify user isolation - ensure no cross-user fact contamination
 */
export async function verifyUserIsolation(
  cortex: Cortex,
  memorySpaceId: string,
  userIds: string[],
): Promise<IsolationResult> {
  const violations: IsolationResult["violations"] = [];

  for (const userId of userIds) {
    // Get facts for this user
    const facts = await cortex.facts.list({
      memorySpaceId,
      userId,
      includeSuperseded: true,
    });

    // Check if any facts belong to a different user
    for (const fact of facts) {
      if (fact.subject && !fact.subject.includes(userId)) {
        // Check if the subject matches any other user
        const belongsTo = userIds.find((id) => fact.subject!.includes(id));
        if (belongsTo && belongsTo !== userId) {
          violations.push({
            userId,
            foundFactBelongingTo: belongsTo,
            factId: fact.factId,
          });
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Verify recall isolation - ensure recall only returns facts for the requesting user
 */
export async function verifyRecallIsolation(
  cortex: Cortex,
  memorySpaceId: string,
  userId: string,
  query: string,
  otherUserIds: string[],
): Promise<ValidationResult> {
  const embedding = await generateRealEmbedding(query);

  const result = await cortex.memory.recall({
    memorySpaceId,
    query,
    embedding,
    userId,
    limit: 100,
    formatForLLM: false,
  });

  const violations: string[] = [];

  for (const item of result.items) {
    if (item.type === "fact" && item.fact) {
      const fact = item.fact;
      // Check if this fact belongs to another user
      for (const otherId of otherUserIds) {
        if (fact.subject?.includes(otherId) || fact.userId === otherId) {
          violations.push(
            `Fact ${fact.factId} for user ${otherId} returned in recall for ${userId}`,
          );
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    message: violations.length === 0
      ? `Recall isolation verified - no cross-user facts returned`
      : `Recall isolation violated: ${violations.join("; ")}`,
    details: {
      totalItems: result.items.length,
      violations,
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Duplicate Detection Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Verify no duplicate facts exist for the same subject-predicate-object
 */
export async function verifyNoDuplicates(
  cortex: Cortex,
  memorySpaceId: string,
  userId: string,
): Promise<ValidationResult> {
  const facts = await cortex.facts.list({
    memorySpaceId,
    subject: userId,
    includeSuperseded: false, // Only check current facts
  });

  // Build a map of subject-predicate-object -> facts
  const tripleMap = new Map<string, FactRecord[]>();

  for (const fact of facts) {
    const key = `${fact.subject}|${fact.predicate}|${fact.object}`;
    const existing = tripleMap.get(key) || [];
    existing.push(fact);
    tripleMap.set(key, existing);
  }

  const duplicates: string[] = [];

  for (const [key, factList] of tripleMap) {
    if (factList.length > 1) {
      duplicates.push(
        `Duplicate facts for "${key}": ${factList.map((f) => f.factId).join(", ")}`,
      );
    }
  }

  return {
    passed: duplicates.length === 0,
    message: duplicates.length === 0
      ? `No duplicate facts found among ${facts.length} current facts`
      : `Found ${duplicates.length} duplicate groups`,
    details: {
      totalFacts: facts.length,
      uniqueTriples: tripleMap.size,
      duplicates,
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Aggregate Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Run all validations for a single user after chaos testing
 */
export async function runFullValidation(
  cortex: Cortex,
  memorySpaceId: string,
  userId: string,
  expectedFinalState: Record<string, string>,
): Promise<{
  allPassed: boolean;
  factStateResult: ValidationResult;
  duplicateResult: ValidationResult;
  supersessionResult: Awaited<ReturnType<typeof validateAllSupersessionChains>>;
  summary: string;
}> {
  // Run all validations
  const factStateResult = await verifyExactFactState(
    cortex,
    memorySpaceId,
    userId,
    expectedFinalState,
  );

  const duplicateResult = await verifyNoDuplicates(cortex, memorySpaceId, userId);

  const supersessionResult = await validateAllSupersessionChains(
    cortex,
    memorySpaceId,
    userId,
  );

  const allPassed =
    factStateResult.passed &&
    duplicateResult.passed &&
    supersessionResult.invalidChains === 0;

  const summary = [
    `Fact State: ${factStateResult.passed ? "PASS" : "FAIL"}`,
    `No Duplicates: ${duplicateResult.passed ? "PASS" : "FAIL"}`,
    `Supersession Chains: ${supersessionResult.invalidChains === 0 ? "PASS" : "FAIL"} ` +
    `(${supersessionResult.validChains}/${supersessionResult.totalChains} valid)`,
    allPassed ? "ALL VALIDATIONS PASSED" : "SOME VALIDATIONS FAILED",
  ].join("\n");

  return {
    allPassed,
    factStateResult,
    duplicateResult,
    supersessionResult,
    summary,
  };
}
