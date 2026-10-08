/**
 * Entity extracted from conversation for graph knowledge base
 */
export interface ExtractedEntity {
  /** Entity name as mentioned in text */
  name: string;
  /** Semantic entity type */
  type: "person" | "organization" | "place" | "product" | "concept" | "other";
  /** Full/formal name if abbreviated (e.g., "San Francisco" for "SF") */
  fullValue?: string;
}

/** Transport-neutral JSON schema for Gateway structured Output.object. */
export const FACTS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["facts"],
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fact", "factType", "subject", "predicate", "object", "confidence", "tags", "entities", "relations"],
        properties: {
          fact: { type: "string", minLength: 1 },
          factType: { type: "string", enum: ["preference", "identity", "knowledge", "relationship", "event", "observation", "custom"] },
          subject: { type: "string", minLength: 1 },
          predicate: { type: "string", minLength: 1 },
          object: { type: "string", minLength: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          tags: { type: "array", items: { type: "string" } },
          entities: {
            type: "array",
            items: {
              type: "object", additionalProperties: false, required: ["name", "type"],
              properties: {
                name: { type: "string", minLength: 1 },
                type: { type: "string", enum: ["person", "organization", "place", "product", "concept", "other"] },
                fullValue: { type: "string" },
              },
            },
          },
          relations: {
            type: "array",
            items: {
              type: "object", additionalProperties: false, required: ["subject", "predicate", "object"],
              properties: {
                subject: { type: "string", minLength: 1 }, predicate: { type: "string", minLength: 1 }, object: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Relation triple for knowledge graph edges
 */
export interface ExtractedRelation {
  /** Subject entity name */
  subject: string;
  /** Relationship predicate (e.g., "works_at", "located_in") */
  predicate: string;
  /** Object entity name */
  object: string;
}

/**
 * Extracted fact structure from LLM response
 */
export interface ExtractedFact {
  fact: string;
  factType:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation"
    | "custom";
  subject?: string;
  predicate?: string;
  object?: string;
  confidence: number;
  tags?: string[];
  /** Named entities mentioned in the fact (for graph sync) */
  entities?: ExtractedEntity[];
  /** Subject-predicate-object relations (for graph edges) */
  relations?: ExtractedRelation[];
}


/**
 * Fact extraction system prompt
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are a fact and entity extraction assistant. Extract key facts from conversations that should be remembered long-term, along with the named entities mentioned.

Guidelines:
- Focus on user preferences, attributes, decisions, events, and relationships
- Write facts in third-person, present tense (e.g., "User prefers X")
- Be specific and actionable
- One fact = one statement
- Avoid redundancy
- Only extract facts that are explicitly stated or strongly implied
- Assign confidence based on how clearly the fact was stated (0.5-1.0)

For each fact, determine the type:
- preference: User likes/dislikes, preferred tools/methods
- identity: Personal attributes, name, role, location
- knowledge: Skills, expertise, domain knowledge
- relationship: Connections to people, organizations, projects
- event: Things that happened, milestones, decisions made
- observation: General observations about user behavior
- custom: Other important facts

Entity Extraction:
- Extract all named entities mentioned (people, organizations, places, products)
- Classify each entity by type: person, organization, place, product, concept, other
- If an entity is abbreviated, provide the full value (e.g., "SF" → fullValue: "San Francisco")

Relation Extraction:
- Extract subject-predicate-object triples that describe relationships between entities
- Use snake_case for predicates (e.g., "works_at", "located_in", "prefers")
- Each relation should connect two entities mentioned in the conversation`;

/**
 * Build the user prompt for fact extraction
 */
export function buildExtractionPrompt(
  userMessage: string,
  agentResponse: string,
): string {
  return `Extract facts and entities from this conversation:

User: ${userMessage}
Agent: ${agentResponse}

Return ONLY a JSON object with a "facts" array. Each fact should have:
- fact: The fact statement (clear, third-person, present tense)
- factType: One of "preference", "identity", "knowledge", "relationship", "event", "observation", "custom"
- confidence: Your confidence this is meaningful (0.5-1.0)
- subject: The entity the fact is about (REQUIRED - use "User" if about the user)
- predicate: The relationship or action (REQUIRED - use snake_case like "prefers", "is_named", "works_at")
- object: The target of the relationship (REQUIRED - the value or entity)
- tags: Array of relevant tags (can be empty [])
- entities: Array of ALL named entities mentioned in this fact (REQUIRED, can be empty []), each with:
  - name: Entity name as mentioned
  - type: One of "person", "organization", "place", "product", "concept", "other"
  - fullValue: Full name if abbreviated (omit if not abbreviated)
- relations: Array of entity relationships extracted from this fact (REQUIRED, can be empty []), each with:
  - subject: Subject entity name
  - predicate: Relationship type in snake_case (e.g., "works_at", "located_in")
  - object: Object entity name

Example response:
{
  "facts": [
    {
      "fact": "Sarah works at Planet Granite in San Francisco",
      "factType": "knowledge",
      "confidence": 0.95,
      "subject": "Sarah",
      "predicate": "works_at",
      "object": "Planet Granite",
      "tags": ["work", "location"],
      "entities": [
        { "name": "Sarah", "type": "person" },
        { "name": "Planet Granite", "type": "organization" },
        { "name": "San Francisco", "type": "place" }
      ],
      "relations": [
        { "subject": "Sarah", "predicate": "works_at", "object": "Planet Granite" },
        { "subject": "Planet Granite", "predicate": "located_in", "object": "San Francisco" }
      ]
    }
  ]
}

If no meaningful facts can be extracted, return: {"facts": []}`;
}

/**
 * Parse and validate entity from LLM response
 */
function parseEntity(e: unknown): ExtractedEntity | null {
  if (typeof e !== "object" || e === null) return null;
  const entity = e as Record<string, unknown>;

  if (typeof entity.name !== "string" || !entity.name.trim()) return null;

  const validTypes = [
    "person",
    "organization",
    "place",
    "product",
    "concept",
    "other",
  ];
  const entityType =
    typeof entity.type === "string" && validTypes.includes(entity.type)
      ? (entity.type as ExtractedEntity["type"])
      : "other";

  return {
    name: entity.name.trim(),
    type: entityType,
    fullValue:
      typeof entity.fullValue === "string" ? entity.fullValue : undefined,
  };
}

/**
 * Parse and validate relation from LLM response
 */
function parseRelation(r: unknown): ExtractedRelation | null {
  if (typeof r !== "object" || r === null) return null;
  const relation = r as Record<string, unknown>;

  if (
    typeof relation.subject !== "string" ||
    typeof relation.predicate !== "string" ||
    typeof relation.object !== "string"
  ) {
    return null;
  }

  return {
    subject: relation.subject.trim(),
    predicate: relation.predicate.trim().toLowerCase().replace(/\s+/g, "_"),
    object: relation.object.trim(),
  };
}

/**
 * Parse LLM response into ExtractedFact array
 */
export function parseFactsResponse(content: string): ExtractedFact[] | null {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = content.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed: unknown = JSON.parse(jsonStr);
    const facts = typeof parsed === "object" && parsed !== null && "facts" in parsed
      ? parsed.facts || parsed
      : parsed;

    if (!Array.isArray(facts)) {
      return null;
    }

    // Validate and normalize each fact
    return facts
      .filter((f: unknown) => {
        if (typeof f !== "object" || f === null) return false;
        const fact = f as Record<string, unknown>;
        return (
          typeof fact.fact === "string" && typeof fact.factType === "string"
        );
      })
      .map((f: Record<string, unknown>) => {
        // Parse entities array if present
        const entities: ExtractedEntity[] | undefined = Array.isArray(
          f.entities,
        )
          ? (f.entities
              .map(parseEntity)
              .filter((e): e is ExtractedEntity => e !== null) as ExtractedEntity[])
          : undefined;

        // Parse relations array if present
        const relations: ExtractedRelation[] | undefined = Array.isArray(
          f.relations,
        )
          ? (f.relations
              .map(parseRelation)
              .filter((r): r is ExtractedRelation => r !== null) as ExtractedRelation[])
          : undefined;

        return {
          fact: f.fact as string,
          factType: normalizeFactType(f.factType as string),
          confidence:
            typeof f.confidence === "number" && Number.isFinite(f.confidence)
              ? Math.min(1, Math.max(0, f.confidence))
              : 0.7,
          subject: typeof f.subject === "string" ? f.subject : undefined,
          predicate: typeof f.predicate === "string" ? f.predicate : undefined,
          object: typeof f.object === "string" ? f.object : undefined,
          tags: Array.isArray(f.tags)
            ? f.tags.filter((t): t is string => typeof t === "string")
            : undefined,
          entities: entities && entities.length > 0 ? entities : undefined,
          relations: relations && relations.length > 0 ? relations : undefined,
        };
      });
  } catch {
    return null;
  }
}

/**
 * Normalize fact type to valid enum value
 */
export function normalizeFactType(type: string): ExtractedFact["factType"] {
  const validTypes = [
    "preference",
    "identity",
    "knowledge",
    "relationship",
    "event",
    "observation",
    "custom",
  ];
  const normalized = type.toLowerCase().trim();
  return validTypes.includes(normalized)
    ? (normalized as ExtractedFact["factType"])
    : "custom";
}
