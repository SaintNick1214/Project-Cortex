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

## Decision Guidelines

- Prefer UPDATE when the new fact adds detail to an existing fact
- Use SUPERSEDE when facts are mutually exclusive (e.g., "lives in NYC" vs "lives in LA")
- Use NONE when the new fact doesn't add value
- Use ADD when facts can coexist (different aspects of the same topic)
- Consider temporal context - newer information typically supersedes older
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
 * Build the user prompt with the new fact and existing facts
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
    factsToInclude.forEach((fact, index) => {
      prompt += `${index + 1}. [ID: ${fact.factId}] "${fact.fact}"
   Type: ${fact.factType}
   Subject: ${fact.subject || "unknown"}
   Predicate: ${fact.predicate || "unknown"}
   Object: ${fact.object || "unknown"}
   Confidence: ${fact.confidence}
   Created: ${new Date(fact.createdAt).toISOString()}

`;
    });
  }

  prompt += `## Your Task

Analyze the new fact against the existing facts and determine the appropriate action.
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

  // Medium similarity - might be a supersession
  if (bestMatch && bestMatch.similarity > 0.5) {
    // Check if same subject - might be supersession
    if (
      newFact.subject &&
      bestMatch.fact.subject &&
      newFact.subject.toLowerCase() === bestMatch.fact.subject.toLowerCase()
    ) {
      return {
        action: "SUPERSEDE",
        targetFactId: bestMatch.fact.factId,
        reason:
          "Same subject with different content - possible update to existing knowledge",
        mergedFact: null,
        confidence: 60,
      };
    }
  }

  // Low similarity - new fact
  return {
    action: "ADD",
    targetFactId: null,
    reason: "No similar existing facts found - adding new fact",
    mergedFact: null,
    confidence: 80,
  };
}
