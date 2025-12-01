/**
 * Enriched Fact Extraction for Bullet-Proof Retrieval
 *
 * Provides functions for extracting facts with rich metadata
 * to enable reliable semantic search.
 */

import OpenAI from "openai";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface EnrichedEntity {
  name: string;
  type: string;
  fullValue?: string;
}

export interface EnrichedRelation {
  subject: string;
  predicate: string;
  object: string;
}

export interface EnrichedFact {
  fact: string;
  factType:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation";
  category: string;
  searchAliases: string[];
  semanticContext: string;
  entities: EnrichedEntity[];
  relations: EnrichedRelation[];
  confidence: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Prompt Template
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ENRICHED_FACT_EXTRACTION_PROMPT = `You are a fact extraction assistant optimized for retrieval. Extract key facts from this conversation with rich metadata to enable semantic search.

For each fact, provide:
1. fact: The core fact statement (clear, concise, third-person)
2. factType: Category (preference, identity, knowledge, relationship, event, observation)
3. category: Specific sub-category for search (e.g., "addressing_preference", "contact_info", "work_info")
4. searchAliases: Array of alternative search terms that should find this fact
5. semanticContext: A sentence explaining when/how to use this information
6. entities: Array of extracted entities with {name, type, fullValue?}
7. relations: Array of {subject, predicate, object} triples
8. confidence: 0-100 confidence score

Example input:
User: "My name is Alexander Johnson and I prefer to be called Alex"
Agent: "Got it, I'll call you Alex!"

Example output:
[{
  "fact": "User prefers to be called Alex",
  "factType": "identity",
  "category": "addressing_preference",
  "searchAliases": ["name", "nickname", "what to call", "address as", "greet", "refer to", "how to address"],
  "semanticContext": "Use 'Alex' when addressing, greeting, or referring to this user",
  "entities": [
    {"name": "Alex", "type": "preferred_name", "fullValue": "Alexander Johnson"},
    {"name": "Alexander Johnson", "type": "full_name"}
  ],
  "relations": [
    {"subject": "user", "predicate": "prefers_to_be_called", "object": "Alex"},
    {"subject": "user", "predicate": "full_name_is", "object": "Alexander Johnson"}
  ],
  "confidence": 95
}]

Now extract facts from this conversation:
User: {userMessage}
Agent: {agentResponse}

Return ONLY a valid JSON array. If no facts to extract, return [].
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Extract enriched facts from a conversation for bullet-proof retrieval.
 *
 * This function extracts facts with rich metadata including:
 * - searchAliases: Alternative search terms
 * - semanticContext: Usage context sentence
 * - entities: Extracted entities with types
 * - relations: Subject-predicate-object triples
 *
 * @param userMessage - The user's message
 * @param agentResponse - The agent's response
 * @param openai - Optional OpenAI client (creates one if not provided)
 * @returns Array of enriched facts, or null if API unavailable
 *
 * @example
 * const facts = await extractFactsEnriched(
 *   "My name is Alexander Johnson and I prefer to be called Alex",
 *   "Got it, I'll call you Alex!"
 * );
 * console.log(facts[0].searchAliases);
 * // ["name", "nickname", "what to call", "address as", ...]
 */
export async function extractFactsEnriched(
  userMessage: string,
  agentResponse: string,
  openai?: OpenAI,
): Promise<EnrichedFact[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey && !openai) {
    console.warn("Warning: OPENAI_API_KEY not set for enriched fact extraction");
    return null;
  }

  const client = openai || new OpenAI({ apiKey, timeout: 60000 });

  const prompt = ENRICHED_FACT_EXTRACTION_PROMPT.replace(
    "{userMessage}",
    userMessage,
  ).replace("{agentResponse}", agentResponse);

  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content: "You are a fact extraction assistant. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
      });

      let content = response.choices[0].message.content || "[]";

      // Handle potential markdown code blocks
      if (content.startsWith("```")) {
        content = content.split("```")[1];
        if (content.startsWith("json")) {
          content = content.slice(4);
        }
      }
      content = content.trim();

      const facts = JSON.parse(content);

      if (!Array.isArray(facts)) {
        console.warn(`Warning: Expected array, got ${typeof facts}`);
        return [];
      }

      // Validate and normalize each fact
      const validatedFacts: EnrichedFact[] = [];

      for (const fact of facts) {
        if (typeof fact === "object" && fact !== null && "fact" in fact) {
          validatedFacts.push({
            fact: fact.fact || "",
            factType: fact.factType || "knowledge",
            category: fact.category || "general",
            searchAliases: fact.searchAliases || [],
            semanticContext: fact.semanticContext || "",
            entities: fact.entities || [],
            relations: fact.relations || [],
            confidence: fact.confidence ?? 70,
          });
        }
      }

      return validatedFacts;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `Warning: Enriched fact extraction failed (attempt ${attempt + 1}/${maxRetries}): ${errorMsg}`,
      );

      const isRetryable =
        errorMsg.toLowerCase().includes("rate limit") ||
        errorMsg.toLowerCase().includes("timeout") ||
        errorMsg.toLowerCase().includes("connection") ||
        errorMsg.includes("503") ||
        errorMsg.includes("502") ||
        errorMsg.includes("500");

      if (isRetryable && attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`  Retrying in ${waitTime / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      return null;
    }
  }

  console.error(
    `Error: Enriched fact extraction failed after ${maxRetries} attempts`,
  );
  return null;
}

/**
 * Build concatenated searchable content from an enriched fact.
 *
 * This creates a single string with maximum semantic surface area
 * for embedding generation, combining:
 * - The core fact
 * - Category information
 * - Search aliases
 * - Semantic context
 *
 * @param fact - Enriched fact object
 * @returns Concatenated string optimized for embedding
 *
 * @example
 * const content = buildEnrichedContent({
 *   fact: "User prefers to be called Alex",
 *   category: "addressing_preference",
 *   searchAliases: ["name", "nickname"],
 *   semanticContext: "Use 'Alex' when addressing this user"
 * });
 * // Returns multi-line string with all info
 */
export function buildEnrichedContent(fact: Partial<EnrichedFact>): string {
  const parts: string[] = [fact.fact || ""];

  if (fact.category) {
    parts.push(`Category: ${fact.category}`);
  }

  if (fact.searchAliases && fact.searchAliases.length > 0) {
    parts.push(`Search terms: ${fact.searchAliases.join(", ")}`);
  }

  if (fact.semanticContext) {
    parts.push(`Context: ${fact.semanticContext}`);
  }

  return parts.join("\n");
}

/**
 * Convert enriched facts to the format expected by cortex.facts.store()
 *
 * @param enrichedFacts - Array of enriched facts
 * @param userId - User ID to associate facts with
 * @returns Array of fact data objects ready for storage
 */
export function enrichedFactsToStoreFormat(
  enrichedFacts: EnrichedFact[],
  userId?: string,
): Array<{
  fact: string;
  factType: string;
  confidence: number;
  subject?: string;
  predicate?: string;
  object?: string;
  tags?: string[];
  category?: string;
  searchAliases?: string[];
  semanticContext?: string;
  entities?: EnrichedEntity[];
  relations?: EnrichedRelation[];
}> {
  return enrichedFacts.map((ef) => {
    // Extract primary relation for subject/predicate/object
    const primaryRelation = ef.relations[0];

    return {
      fact: ef.fact,
      factType: ef.factType,
      confidence: ef.confidence,
      subject: primaryRelation?.subject || userId || "user",
      predicate: primaryRelation?.predicate,
      object: primaryRelation?.object,
      tags: ef.searchAliases.slice(0, 5), // Use first 5 aliases as tags
      category: ef.category,
      searchAliases: ef.searchAliases,
      semanticContext: ef.semanticContext,
      entities: ef.entities,
      relations: ef.relations,
    };
  });
}
