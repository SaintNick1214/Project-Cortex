/**
 * Cortex SDK - Conflict Resolution Prompts
 *
 * LLM prompt templates for nuanced conflict resolution when
 * slot or semantic matching finds potential duplicates.
 */

import type { FactRecord } from "../types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Conflict resolution action types
 */
export type ConflictAction = "UPDATE" | "SUPERSEDE" | "NONE" | "ADD";

/**
 * LLM decision for conflict resolution
 */
export interface ConflictDecision {
  /** The action to take */
  action: ConflictAction;
  /** The fact ID to act on (for UPDATE/SUPERSEDE) */
  targetFactId: string | null;
  /** Human-readable explanation */
  reason: string;
  /** Merged/refined fact text (for UPDATE action) */
  mergedFact: string | null;
  /** Confidence in the decision (0-100) */
  confidence?: number;
}

/**
 * Candidate fact for conflict resolution
 */
export interface ConflictCandidate {
  fact: string;
  factType?: string;
  subject?: string;
  predicate?: string;
  object?: string;
  confidence: number;
  tags?: string[];
  /** Embedding for semantic search (v0.30.0+) */
  embedding?: number[];
  /** Named entities mentioned in the fact (v0.31.0+) */
  entities?: Array<{
    name: string;
    type: string;
    fullValue?: string;
  }>;
  /** Subject-predicate-object relations (v0.31.0+) */
  relations?: Array<{
    subject: string;
    predicate: string;
    object: string;
  }>;
}

/**
 * Options for prompt generation
 */
export interface PromptOptions {
  /** Include examples in the prompt */
  includeExamples?: boolean;
  /** Custom system instructions */
  customInstructions?: string;
  /** Maximum facts to include in prompt */
  maxExistingFacts?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Prompt Templates
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * System prompt for conflict resolution
 */
export const CONFLICT_RESOLUTION_SYSTEM_PROMPT = `You are a knowledge base manager responsible for maintaining accurate, non-redundant facts about entities.

Your task is to determine the correct action when a new fact is added that may conflict with existing facts.

## Available Actions

1. **UPDATE**: The new fact refines, corrects, or provides newer information about the same concept. The existing fact should be updated with merged information.

2. **SUPERSEDE**: The new fact explicitly contradicts or replaces an existing fact. The old fact should be marked as superseded (kept for history) and the new fact becomes current.

3. **NONE**: The new fact is already captured by existing facts (duplicate or less specific). No action needed - return the existing fact.

4. **ADD**: The new fact is genuinely new information not covered by existing facts. Create a new fact record.

## Understanding Temporal Metadata

Each existing fact includes temporal metadata that you MUST consider:

- **Created/Updated timestamps**: When the fact was recorded and last modified
- **Status**: Shows the fact's current state:
  - "Active" = Current, valid fact
  - "⚠️ SUPERSEDED by [factId]" = This fact has been REPLACED by a newer fact - treat as historical
  - "Replaced: [factId]" = This fact replaced an older one - it is the current truth
  - "EXPIRED" = This fact is no longer valid

## Critical Rules for Temporal Reasoning

1. **NEVER merge superseded facts with current facts** - If an existing fact shows "⚠️ SUPERSEDED", it has already been replaced. Do not combine old and new values (e.g., do NOT create "user likes both blue and purple" if blue was superseded by purple).

2. **Supersession chains indicate preference CHANGES** - When you see a fact that "Replaced" another, the user explicitly changed their preference/information. The old value is historical, not additive.

3. **The "Object" field is the key value** - For preference facts, the Object field contains the actual value (e.g., "blue", "purple", "New York"). Different Objects with the same Subject+Predicate = conflict requiring SUPERSEDE.

4. **Timestamps matter** - When in doubt, newer information (higher Updated timestamp) is more likely to be accurate.

## Decision Guidelines

- Prefer UPDATE when the new fact adds detail to an existing fact (same Object, more specificity)
- Use SUPERSEDE when facts are mutually exclusive (same Subject+Predicate, different Object)
- Use NONE when the new fact doesn't add value or is less specific than existing
- Use ADD when facts can coexist (different predicate categories, different aspects)
- Consider confidence levels - higher confidence facts take precedence

## Output Format

Return a JSON object with this exact structure:
{
  "action": "UPDATE" | "SUPERSEDE" | "NONE" | "ADD",
  "targetFactId": "fact-xxx" | null,
  "reason": "Brief explanation of the decision",
  "mergedFact": "Combined fact text if UPDATE, null otherwise",
  "confidence": 0-100
}`;

/**
 * Examples for few-shot learning
 */
export const CONFLICT_RESOLUTION_EXAMPLES = `## Examples

### Example 1: UPDATE (More Specific)
New Fact: "User's favorite pizza is pepperoni"
Existing Facts:
1. [ID: fact-001] "User likes cheese pizza"

Decision:
{
  "action": "UPDATE",
  "targetFactId": "fact-001",
  "reason": "New fact is more specific about pizza preference - pepperoni over generic cheese",
  "mergedFact": "User's favorite pizza is pepperoni",
  "confidence": 85
}

### Example 2: SUPERSEDE (Location Change)
New Fact: "User moved to San Francisco"
Existing Facts:
1. [ID: fact-002] "User lives in New York"

Decision:
{
  "action": "SUPERSEDE",
  "targetFactId": "fact-002",
  "reason": "User has moved - new location supersedes old location",
  "mergedFact": null,
  "confidence": 90
}

### Example 3: NONE (Duplicate)
New Fact: "User enjoys outdoor activities"
Existing Facts:
1. [ID: fact-003] "User likes hiking and camping outdoors"

Decision:
{
  "action": "NONE",
  "targetFactId": "fact-003",
  "reason": "New fact is less specific - existing fact already captures outdoor activities",
  "mergedFact": null,
  "confidence": 95
}

### Example 4: ADD (Different Aspect)
New Fact: "User's age is 25"
Existing Facts:
1. [ID: fact-004] "User was born in 1999"

Decision:
{
  "action": "ADD",
  "targetFactId": null,
  "reason": "Age and birth year are related but distinct facts - both valid",
  "mergedFact": null,
  "confidence": 80
}

### Example 5: UPDATE (Refinement)
New Fact: "User has a dog named Rex"
Existing Facts:
1. [ID: fact-005] "User has a dog"

Decision:
{
  "action": "UPDATE",
  "targetFactId": "fact-005",
  "reason": "New fact adds the dog's name - a refinement of existing fact",
  "mergedFact": "User has a dog named Rex",
  "confidence": 90
}

### Example 6: SUPERSEDE (Preference Change)
New Fact: "User prefers purple as favorite color"
Existing Facts:
1. [ID: fact-006] "User's favorite color is blue"

Decision:
{
  "action": "SUPERSEDE",
  "targetFactId": "fact-006",
  "reason": "Color preference has changed - purple replaces blue",
  "mergedFact": null,
  "confidence": 85
}`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Prompt Builders
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build the system prompt for conflict resolution
 */
export function buildSystemPrompt(options?: PromptOptions): string {
  let prompt = CONFLICT_RESOLUTION_SYSTEM_PROMPT;

  if (options?.includeExamples !== false) {
    prompt += "\n\n" + CONFLICT_RESOLUTION_EXAMPLES;
  }

  if (options?.customInstructions) {
    prompt += "\n\n## Additional Instructions\n" + options.customInstructions;
  }

  return prompt;
}

/**
 * Format temporal status for a fact
 */
function formatTemporalStatus(fact: FactRecord): string {
  const statusParts: string[] = [];

  // Supersession chain info - CRITICAL for understanding fact currency
  if (fact.supersededBy) {
    statusParts.push(`⚠️ SUPERSEDED by ${fact.supersededBy}`);
  }
  if (fact.supersedes) {
    statusParts.push(`Replaced: ${fact.supersedes}`);
  }

  // Validity window
  if (fact.validFrom) {
    statusParts.push(`Valid from: ${new Date(fact.validFrom).toISOString()}`);
  }
  if (fact.validUntil) {
    const isExpired = fact.validUntil < Date.now();
    statusParts.push(
      `Valid until: ${new Date(fact.validUntil).toISOString()}${isExpired ? " (EXPIRED)" : ""}`,
    );
  }

  return statusParts.length > 0 ? statusParts.join(" | ") : "Active";
}

/**
 * Build the user prompt with the new fact and existing facts
 *
 * Includes full temporal and supersession metadata to enable
 * accurate conflict resolution decisions.
 */
export function buildUserPrompt(
  newFact: ConflictCandidate,
  existingFacts: FactRecord[],
  options?: PromptOptions,
): string {
  const maxFacts = options?.maxExistingFacts ?? 10;
  const factsToInclude = existingFacts.slice(0, maxFacts);

  let prompt = `## New Fact to Evaluate

Fact: "${newFact.fact}"
Type: ${newFact.factType || "unknown"}
Subject: ${newFact.subject || "unknown"}
Predicate: ${newFact.predicate || "unknown"}
Object: ${newFact.object || "unknown"}
Confidence: ${newFact.confidence}
Tags: ${newFact.tags?.join(", ") || "none"}

## Existing Facts

`;

  if (factsToInclude.length === 0) {
    prompt += "No existing facts found.\n";
  } else {
    // Check if any facts have supersession relationships
    const hasSupersessionChain = factsToInclude.some(
      (f) => f.supersedes || f.supersededBy,
    );

    if (hasSupersessionChain) {
      prompt += `NOTE: Some facts have supersession relationships. Facts marked "⚠️ SUPERSEDED" 
have been replaced by newer facts and should be considered outdated.
Facts with "Replaced:" indicate they superseded an older fact.

`;
    }

    factsToInclude.forEach((fact, index) => {
      const temporalStatus = formatTemporalStatus(fact);
      prompt += `${index + 1}. [ID: ${fact.factId}] "${fact.fact}"
   Type: ${fact.factType}
   Subject: ${fact.subject || "unknown"}
   Predicate: ${fact.predicate || "unknown"}
   Object: ${fact.object || "unknown"}
   Confidence: ${fact.confidence}
   Created: ${new Date(fact.createdAt).toISOString()}
   Updated: ${new Date(fact.updatedAt).toISOString()}
   Status: ${temporalStatus}

`;
    });
  }

  prompt += `## Your Task

Analyze the new fact against the existing facts and determine the appropriate action.
IMPORTANT: 
- If an existing fact is marked "⚠️ SUPERSEDED", it has already been replaced and should not be considered current.
- Pay attention to the temporal relationships between facts.
- The "Object" field often contains the specific value (e.g., "blue", "purple") that determines if facts conflict.

Return ONLY a valid JSON object with your decision.`;

  return prompt;
}

/**
 * Build a complete prompt for conflict resolution
 */
export function buildConflictResolutionPrompt(
  newFact: ConflictCandidate,
  existingFacts: FactRecord[],
  options?: PromptOptions,
): { system: string; user: string } {
  return {
    system: buildSystemPrompt(options),
    user: buildUserPrompt(newFact, existingFacts, options),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Response Parsing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse LLM response into a ConflictDecision
 *
 * Handles various response formats and extracts JSON from text
 */
export function parseConflictDecision(response: string): ConflictDecision {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in response");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.action || !isValidAction(parsed.action)) {
      throw new Error(`Invalid action: ${parsed.action}`);
    }

    // Normalize the response
    return {
      action: parsed.action as ConflictAction,
      targetFactId: parsed.targetFactId || null,
      reason: parsed.reason || "No reason provided",
      mergedFact: parsed.mergedFact || null,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 75,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if an action string is valid
 */
function isValidAction(action: string): action is ConflictAction {
  return ["UPDATE", "SUPERSEDE", "NONE", "ADD"].includes(action);
}

/**
 * Validate a parsed conflict decision
 */
export function validateConflictDecision(
  decision: ConflictDecision,
  existingFacts: FactRecord[],
): { valid: boolean; error?: string } {
  // UPDATE and SUPERSEDE require a targetFactId
  if (
    (decision.action === "UPDATE" || decision.action === "SUPERSEDE") &&
    !decision.targetFactId
  ) {
    return {
      valid: false,
      error: `${decision.action} action requires a targetFactId`,
    };
  }

  // Verify targetFactId exists in existing facts
  if (decision.targetFactId) {
    const targetExists = existingFacts.some(
      (f) => f.factId === decision.targetFactId,
    );
    if (!targetExists) {
      return {
        valid: false,
        error: `targetFactId ${decision.targetFactId} not found in existing facts`,
      };
    }
  }

  // UPDATE requires a mergedFact
  if (decision.action === "UPDATE" && !decision.mergedFact) {
    return {
      valid: false,
      error: "UPDATE action requires a mergedFact",
    };
  }

  // Confidence should be in range
  if (
    decision.confidence !== undefined &&
    (decision.confidence < 0 || decision.confidence > 100)
  ) {
    return {
      valid: false,
      error: "Confidence must be between 0 and 100",
    };
  }

  return { valid: true };
}

/**
 * Check if two predicates are related (likely in the same semantic slot)
 *
 * This helps avoid superseding unrelated facts like "favorite color" vs "favorite food"
 * when they share the same subject but are about different aspects.
 */
function arePredicatesRelated(
  predicate1: string | undefined,
  predicate2: string | undefined,
): boolean {
  // If either predicate is missing, assume they might be related (conservative)
  if (!predicate1 || !predicate2) {
    return true;
  }

  const p1 = predicate1.toLowerCase().trim();
  const p2 = predicate2.toLowerCase().trim();

  // Exact match
  if (p1 === p2) {
    return true;
  }

  // Extract key words from predicates
  const words1 = new Set(p1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(p2.split(/\s+/).filter((w) => w.length > 2));

  // Check for significant word overlap
  const intersection = [...words1].filter((w) => words2.has(w));

  // If predicates share key words, they're related
  // e.g., "favorite color" and "favorite colour" share "favorite"
  // but "favorite color" and "favorite food" share "favorite" - not enough
  if (intersection.length > 0) {
    // Check if the distinguishing words are similar
    // "color" vs "colour" = related, "color" vs "food" = not related
    const uniqueWords1 = [...words1].filter((w) => !words2.has(w));
    const uniqueWords2 = [...words2].filter((w) => !words1.has(w));

    // If one predicate is a subset of the other, they're related
    if (uniqueWords1.length === 0 || uniqueWords2.length === 0) {
      return true;
    }

    // Check if unique words are similar (e.g., "color" vs "colour")
    for (const w1 of uniqueWords1) {
      for (const w2 of uniqueWords2) {
        if (wordsSimilar(w1, w2)) {
          return true;
        }
      }
    }

    // If predicates share "favorite"/"preferred" but have different distinguishing words
    // like "color" vs "food", they're NOT related
    return false;
  }

  // No word overlap - check character-level similarity for typos
  const similarity = stringSimilarity(p1, p2);
  return similarity > 0.7;
}

/**
 * Check if two words are similar (handles typos, British/American spelling)
 */
function wordsSimilar(w1: string, w2: string): boolean {
  if (w1 === w2) return true;

  // Common spelling variations
  const variations: Record<string, string[]> = {
    color: ["colour"],
    favorite: ["favourite"],
    neighbor: ["neighbour"],
    organize: ["organise"],
  };

  for (const [base, alts] of Object.entries(variations)) {
    if ((w1 === base && alts.includes(w2)) || (w2 === base && alts.includes(w1))) {
      return true;
    }
  }

  // Check edit distance for typos
  return stringSimilarity(w1, w2) > 0.8;
}

/**
 * Simple string similarity based on character overlap
 */
function stringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const chars1 = new Set(s1.split(""));
  const chars2 = new Set(s2.split(""));
  const intersection = [...chars1].filter((c) => chars2.has(c));
  const union = new Set([...chars1, ...chars2]);

  return intersection.length / union.size;
}

/**
 * Get a default decision when LLM is unavailable
 *
 * Falls back to simple heuristics based on similarity
 */
export function getDefaultDecision(
  newFact: ConflictCandidate,
  existingFacts: FactRecord[],
): ConflictDecision {
  // If no existing facts, always ADD
  if (existingFacts.length === 0) {
    return {
      action: "ADD",
      targetFactId: null,
      reason: "No existing facts found - adding new fact",
      mergedFact: null,
      confidence: 100,
    };
  }

  // Find the most similar existing fact (simple text comparison)
  const normalizedNew = newFact.fact.toLowerCase().trim();
  let bestMatch: { fact: FactRecord; similarity: number } | null = null;

  for (const existing of existingFacts) {
    const normalizedExisting = existing.fact.toLowerCase().trim();

    // Calculate simple word overlap similarity
    const newWords = new Set(normalizedNew.split(/\s+/));
    const existingWords = new Set(normalizedExisting.split(/\s+/));
    const intersection = [...newWords].filter((w) => existingWords.has(w));
    const union = new Set([...newWords, ...existingWords]);
    const similarity = intersection.length / union.size;

    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { fact: existing, similarity };
    }
  }

  // High similarity - likely duplicate or update
  if (bestMatch && bestMatch.similarity > 0.8) {
    // If new confidence is higher, update
    if (newFact.confidence > bestMatch.fact.confidence) {
      return {
        action: "UPDATE",
        targetFactId: bestMatch.fact.factId,
        reason:
          "High similarity with existing fact - updating with higher confidence",
        mergedFact: newFact.fact,
        confidence: 70,
      };
    }
    // Otherwise, skip (duplicate)
    return {
      action: "NONE",
      targetFactId: bestMatch.fact.factId,
      reason: "High similarity with existing fact - likely duplicate",
      mergedFact: null,
      confidence: 70,
    };
  }

  // Check if same subject - candidates already passed slot/semantic matching,
  // so same subject indicates facts about the same entity in the same semantic slot
  const sameSubject =
    newFact.subject &&
    bestMatch?.fact.subject &&
    newFact.subject.toLowerCase() === bestMatch.fact.subject.toLowerCase();

  // Check if objects are the same (e.g., both about "blue" color)
  const sameObject =
    newFact.object &&
    bestMatch?.fact.object &&
    newFact.object.toLowerCase().trim() ===
      bestMatch.fact.object.toLowerCase().trim();

  // Check if predicates are related (to avoid superseding unrelated facts)
  // e.g., "favorite color" and "favorite food" should NOT supersede each other
  const predicatesRelated = arePredicatesRelated(
    newFact.predicate,
    bestMatch?.fact.predicate,
  );

  if (bestMatch && sameSubject && predicatesRelated) {
    // Same subject + related predicates - need to determine if this is a duplicate, refinement, or change
    if (sameObject) {
      // Same subject + same object = likely duplicate or refinement
      // Even with low text similarity, if the object is the same, it's the same preference
      if (newFact.confidence > bestMatch.fact.confidence) {
        return {
          action: "UPDATE",
          targetFactId: bestMatch.fact.factId,
          reason:
            "Same subject and object with higher confidence - refining existing fact",
          mergedFact: newFact.fact,
          confidence: 75,
        };
      }
      return {
        action: "NONE",
        targetFactId: bestMatch.fact.factId,
        reason:
          "Same subject and object - existing fact already captures this",
        mergedFact: null,
        confidence: 75,
      };
    } else {
      // Same subject + related predicate + different object = preference/fact has changed (e.g., blue → purple)
      // The fact that we have candidates means slot/semantic matching found a conflict
      return {
        action: "SUPERSEDE",
        targetFactId: bestMatch.fact.factId,
        reason:
          "Same subject with different value - preference or fact has changed",
        mergedFact: null,
        confidence: 70,
      };
    }
  }

  // Medium similarity without same subject - might still be related
  if (bestMatch && bestMatch.similarity > 0.5) {
    return {
      action: "SUPERSEDE",
      targetFactId: bestMatch.fact.factId,
      reason:
        "Medium similarity suggests related content - possible update to existing knowledge",
      mergedFact: null,
      confidence: 60,
    };
  }

  // Low similarity and different subject - new fact
  return {
    action: "ADD",
    targetFactId: null,
    reason: "No similar existing facts found - adding new fact",
    mergedFact: null,
    confidence: 80,
  };
}
