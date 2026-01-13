/**
 * Chaos Generators for Stress Testing
 *
 * Provides conversation pattern generators and fact extractors for
 * extreme multi-turn conversation stress tests.
 *
 * Patterns:
 * - Forgetful User: Repeated questions and statements
 * - Indecisive User: Frequent preference changes
 * - Topic Flooder: High volume of semantically similar content
 * - Combined Chaos: All patterns together
 */

import OpenAI from "openai";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ExtractedFact {
  fact: string;
  factType: "preference" | "identity" | "knowledge" | "relationship" | "event" | "observation" | "custom";
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  tags?: string[];
}

export interface ConversationTurn {
  userMessage: string;
  agentResponse: string;
  extractFacts?: () => Promise<ExtractedFact[]>;
  isRetrieval?: boolean; // True if this is a question, not a statement
  expectedAction?: "ADD" | "UPDATE" | "SUPERSEDE" | "NONE";
}

export interface TopicConfig {
  name: string;
  predicate: string;
  variations: string[];
  factType: ExtractedFact["factType"];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Topic Configurations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const TOPIC_CONFIGS: Record<string, TopicConfig> = {
  color: {
    name: "favorite color",
    predicate: "favorite color",
    variations: ["blue", "purple", "green", "red", "orange", "yellow", "black", "white", "pink", "teal", "navy", "crimson", "gold", "silver", "maroon"],
    factType: "preference",
  },
  food: {
    name: "favorite food",
    predicate: "favorite food",
    variations: ["pizza", "sushi", "tacos", "burgers", "pasta", "ramen", "curry", "steak", "salad", "thai", "indian", "mexican", "italian", "chinese", "korean"],
    factType: "preference",
  },
  city: {
    name: "favorite city",
    predicate: "favorite city",
    variations: ["NYC", "LA", "Chicago", "Miami", "Seattle", "Denver", "Austin", "Boston", "Portland", "San Francisco", "Nashville", "Atlanta", "Phoenix", "Detroit", "Minneapolis"],
    factType: "preference",
  },
  job: {
    name: "occupation",
    predicate: "works as",
    variations: ["engineer", "designer", "manager", "founder", "consultant", "developer", "analyst", "architect", "scientist", "teacher", "writer", "artist", "doctor", "lawyer", "chef"],
    factType: "identity",
  },
  hobby: {
    name: "favorite hobby",
    predicate: "enjoys",
    variations: ["hiking", "reading", "gaming", "cooking", "photography", "music", "painting", "gardening", "yoga", "cycling", "swimming", "chess", "dancing", "fishing", "camping"],
    factType: "preference",
  },
  pet: {
    name: "pet preference",
    predicate: "prefers pet",
    variations: ["dogs", "cats", "birds", "fish", "rabbits", "hamsters", "turtles", "snakes", "horses", "lizards"],
    factType: "preference",
  },
  music: {
    name: "music genre",
    predicate: "favorite music",
    variations: ["rock", "jazz", "classical", "pop", "hip-hop", "country", "electronic", "R&B", "metal", "indie", "folk", "blues", "reggae", "punk", "soul"],
    factType: "preference",
  },
  movie: {
    name: "movie genre",
    predicate: "favorite movies",
    variations: ["action", "comedy", "drama", "horror", "sci-fi", "romance", "thriller", "documentary", "animation", "fantasy", "mystery", "western", "musical", "war", "crime"],
    factType: "preference",
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Real Embedding Generator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required for stress tests");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate real embeddings using OpenAI text-embedding-3-small
 */
export async function generateRealEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Batch generate embeddings for efficiency
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fact Extractor Factory
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a fact extractor for a specific topic and value
 */
export function createFactExtractor(
  userId: string,
  topic: keyof typeof TOPIC_CONFIGS,
  value: string,
  confidence: number = 90,
): () => Promise<ExtractedFact[]> {
  const config = TOPIC_CONFIGS[topic];
  return async () => [{
    fact: `User's ${config.name} is ${value}`,
    factType: config.factType,
    subject: userId,
    predicate: config.predicate,
    object: value,
    confidence,
    tags: [topic, "preference"],
  }];
}

/**
 * Create a fact extractor for custom facts
 */
export function createCustomFactExtractor(
  userId: string,
  fact: string,
  predicate: string,
  object: string,
  factType: ExtractedFact["factType"] = "knowledge",
  confidence: number = 85,
): () => Promise<ExtractedFact[]> {
  return async () => [{
    fact,
    factType,
    subject: userId,
    predicate,
    object,
    confidence,
    tags: ["custom"],
  }];
}

/**
 * Create a null extractor (for retrieval-only turns)
 */
export function createNullExtractor(): () => Promise<ExtractedFact[]> {
  return async () => [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Conversation Pattern Generators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a "Forgetful User" conversation pattern
 * - Establishes facts then repeatedly asks the same questions
 */
export function generateForgetfulUserPattern(
  userId: string,
  topics: (keyof typeof TOPIC_CONFIGS)[],
  repetitions: number = 10,
): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  const establishedFacts: Record<string, string> = {};

  // Phase 1: Establish baseline facts
  for (const topic of topics) {
    const config = TOPIC_CONFIGS[topic];
    const value = config.variations[0];
    establishedFacts[topic] = value;

    turns.push({
      userMessage: `My ${config.name} is ${value}`,
      agentResponse: `Got it! I'll remember that your ${config.name} is ${value}.`,
      extractFacts: createFactExtractor(userId, topic, value, 90),
      expectedAction: "ADD",
    });
  }

  // Phase 2: Repeated retrieval questions
  const questionTemplates = [
    (topic: string, config: TopicConfig) => `What's my ${config.name}?`,
    (topic: string, config: TopicConfig) => `Do you remember my ${config.name}?`,
    (topic: string, config: TopicConfig) => `Can you tell me my ${config.name} again?`,
    (topic: string, config: TopicConfig) => `I forgot - what ${config.name} did I say?`,
    (topic: string, config: TopicConfig) => `Remind me of my ${config.name}`,
  ];

  for (let i = 0; i < repetitions; i++) {
    for (const topic of topics) {
      const config = TOPIC_CONFIGS[topic];
      const value = establishedFacts[topic];
      const template = questionTemplates[i % questionTemplates.length];

      turns.push({
        userMessage: template(topic, config),
        agentResponse: `Your ${config.name} is ${value}!`,
        extractFacts: createNullExtractor(),
        isRetrieval: true,
      });
    }
  }

  // Phase 3: Re-state the same facts (should be NONE)
  for (const topic of topics) {
    const config = TOPIC_CONFIGS[topic];
    const value = establishedFacts[topic];

    turns.push({
      userMessage: `Just confirming, my ${config.name} is ${value}`,
      agentResponse: `Yes, I already have that noted - your ${config.name} is ${value}.`,
      extractFacts: createFactExtractor(userId, topic, value, 90),
      expectedAction: "NONE",
    });
  }

  return turns;
}

/**
 * Generate an "Indecisive User" conversation pattern
 * - Constantly changes preferences, testing SUPERSEDE logic
 */
export function generateIndecisiveUserPattern(
  userId: string,
  topic: keyof typeof TOPIC_CONFIGS,
  changeCount: number = 10,
): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  const config = TOPIC_CONFIGS[topic];
  
  // Shuffle variations to get a chaotic sequence
  const values = [...config.variations].sort(() => Math.random() - 0.5).slice(0, changeCount);

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const prevValue = i > 0 ? values[i - 1] : null;

    const templates = [
      `Actually, my ${config.name} is now ${value}`,
      `I changed my mind - ${value} is my ${config.name}`,
      `You know what? I prefer ${value} now`,
      `Update my ${config.name} to ${value}`,
      `I've decided ${value} is my new ${config.name}`,
      `Forget what I said, ${value} is definitely my ${config.name}`,
      `My tastes have changed - ${value} is my ${config.name} now`,
    ];

    const message = i === 0 
      ? `My ${config.name} is ${value}`
      : templates[i % templates.length];

    const response = i === 0
      ? `Got it! Your ${config.name} is ${value}.`
      : `Updated! Your ${config.name} is now ${value}${prevValue ? ` (was ${prevValue})` : ""}.`;

    turns.push({
      userMessage: message,
      agentResponse: response,
      extractFacts: createFactExtractor(userId, topic, value, 85 + (i * 0.5)), // Slightly increasing confidence
      expectedAction: i === 0 ? "ADD" : "SUPERSEDE",
    });

    // Occasionally ask about the current value to verify
    if (i > 0 && i % 3 === 0) {
      turns.push({
        userMessage: `Wait, what's my current ${config.name}?`,
        agentResponse: `Your current ${config.name} is ${value}.`,
        extractFacts: createNullExtractor(),
        isRetrieval: true,
      });
    }
  }

  return turns;
}

/**
 * Generate a "Topic Flooder" conversation pattern
 * - Creates many variations on similar themes to stress semantic search
 */
export function generateTopicFlooder(
  userId: string,
  primaryTopic: keyof typeof TOPIC_CONFIGS,
  variationCount: number = 20,
): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  const config = TOPIC_CONFIGS[primaryTopic];

  // Variation templates for flooding
  const variationTemplates: Array<{
    messageTemplate: (value: string) => string;
    factTemplate: (value: string) => string;
    predicateVariant: string;
  }> = [
    {
      messageTemplate: (v) => `My favorite ${config.name.split(" ").pop()} is ${v}`,
      factTemplate: (v) => `User's favorite ${config.name.split(" ").pop()} is ${v}`,
      predicateVariant: `favorite ${config.name.split(" ").pop()}`,
    },
    {
      messageTemplate: (v) => `I really like ${v}`,
      factTemplate: (v) => `User really likes ${v}`,
      predicateVariant: "likes",
    },
    {
      messageTemplate: (v) => `${v} is something I enjoy`,
      factTemplate: (v) => `User enjoys ${v}`,
      predicateVariant: "enjoys",
    },
    {
      messageTemplate: (v) => `I'm into ${v} these days`,
      factTemplate: (v) => `User is into ${v}`,
      predicateVariant: "is into",
    },
    {
      messageTemplate: (v) => `${v} has always been my thing`,
      factTemplate: (v) => `User's thing is ${v}`,
      predicateVariant: "thing is",
    },
    {
      messageTemplate: (v) => `I prefer ${v} over anything else`,
      factTemplate: (v) => `User prefers ${v}`,
      predicateVariant: "prefers",
    },
    {
      messageTemplate: (v) => `Can't live without ${v}`,
      factTemplate: (v) => `User can't live without ${v}`,
      predicateVariant: "can't live without",
    },
    {
      messageTemplate: (v) => `${v} makes me happy`,
      factTemplate: (v) => `${v} makes user happy`,
      predicateVariant: "makes happy",
    },
    {
      messageTemplate: (v) => `I'm passionate about ${v}`,
      factTemplate: (v) => `User is passionate about ${v}`,
      predicateVariant: "passionate about",
    },
    {
      messageTemplate: (v) => `${v} is my go-to choice`,
      factTemplate: (v) => `User's go-to choice is ${v}`,
      predicateVariant: "go-to",
    },
  ];

  // Pick a primary value that stays consistent
  const primaryValue = config.variations[0];

  // Generate variations
  for (let i = 0; i < variationCount; i++) {
    const template = variationTemplates[i % variationTemplates.length];
    const value = i === 0 ? primaryValue : config.variations[i % config.variations.length];

    turns.push({
      userMessage: template.messageTemplate(value),
      agentResponse: `Noted! I'll remember that.`,
      extractFacts: async () => [{
        fact: template.factTemplate(value),
        factType: config.factType,
        subject: userId,
        predicate: template.predicateVariant,
        object: value,
        confidence: 75 + Math.random() * 20,
        tags: [primaryTopic, "variation", `variant-${i}`],
      }],
    });
  }

  // Add tangential noise
  const noiseMessages = [
    "The weather is nice today",
    "I had a great lunch",
    "Work has been busy lately",
    "I'm thinking about the weekend",
    "Did you see the news?",
    "I need to exercise more",
    "My friend recommended something",
    "I've been stressed lately",
    "Time flies so fast",
    "I should call my family",
  ];

  for (const noise of noiseMessages.slice(0, variationCount / 4)) {
    turns.push({
      userMessage: noise,
      agentResponse: "I see! Thanks for sharing.",
      extractFacts: createNullExtractor(),
    });
  }

  return turns;
}

/**
 * Generate a "Combined Chaos" conversation pattern
 * - Ultimate stress test combining all patterns
 */
export function generateCombinedChaos(
  userId: string,
  turnCount: number = 100,
): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  const topics = Object.keys(TOPIC_CONFIGS) as (keyof typeof TOPIC_CONFIGS)[];
  const currentState: Record<string, string> = {};

  // Phase 1: Establish baseline (20% of turns)
  const establishTurns = Math.floor(turnCount * 0.2);
  for (let i = 0; i < establishTurns && i < topics.length; i++) {
    const topic = topics[i];
    const config = TOPIC_CONFIGS[topic];
    const value = config.variations[0];
    currentState[topic] = value;

    turns.push({
      userMessage: `My ${config.name} is ${value}`,
      agentResponse: `Got it! Your ${config.name} is ${value}.`,
      extractFacts: createFactExtractor(userId, topic, value, 90),
      expectedAction: "ADD",
    });
  }

  // Phase 2: Mind changes + retrieval (30% of turns)
  const changeTurns = Math.floor(turnCount * 0.3);
  for (let i = 0; i < changeTurns; i++) {
    const topic = topics[i % topics.length];
    const config = TOPIC_CONFIGS[topic];

    if (Math.random() > 0.5 && currentState[topic]) {
      // Change preference
      const newValue = config.variations[Math.floor(Math.random() * config.variations.length)];
      const oldValue = currentState[topic];
      currentState[topic] = newValue;

      turns.push({
        userMessage: `Actually, I prefer ${newValue} now instead of ${oldValue}`,
        agentResponse: `Updated! Your ${config.name} is now ${newValue}.`,
        extractFacts: createFactExtractor(userId, topic, newValue, 88),
        expectedAction: newValue === oldValue ? "NONE" : "SUPERSEDE",
      });
    } else {
      // Ask about current state
      turns.push({
        userMessage: `What's my ${config.name} again?`,
        agentResponse: `Your ${config.name} is ${currentState[topic] || "not set"}.`,
        extractFacts: createNullExtractor(),
        isRetrieval: true,
      });
    }
  }

  // Phase 3: Topic flooding (25% of turns)
  const floodTurns = Math.floor(turnCount * 0.25);
  const floodVariations = [
    "I really love", "I'm obsessed with", "Nothing beats",
    "I can't get enough of", "I'm all about", "I've always enjoyed",
    "There's something special about", "I have a weakness for",
  ];

  for (let i = 0; i < floodTurns; i++) {
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const config = TOPIC_CONFIGS[topic];
    const value = config.variations[Math.floor(Math.random() * config.variations.length)];
    const variation = floodVariations[i % floodVariations.length];

    turns.push({
      userMessage: `${variation} ${value}`,
      agentResponse: `I can see you like ${value}!`,
      extractFacts: createCustomFactExtractor(
        userId,
        `User expressed interest in ${value}`,
        "interested in",
        value,
        "observation",
        70 + Math.random() * 20,
      ),
    });
  }

  // Phase 4: More mind changes (15% of turns)
  const moreTurns = Math.floor(turnCount * 0.15);
  for (let i = 0; i < moreTurns; i++) {
    const topic = topics[i % topics.length];
    const config = TOPIC_CONFIGS[topic];
    const newValue = config.variations[Math.floor(Math.random() * config.variations.length)];
    currentState[topic] = newValue;

    turns.push({
      userMessage: `Change my ${config.name} to ${newValue}`,
      agentResponse: `Done! Your ${config.name} is now ${newValue}.`,
      extractFacts: createFactExtractor(userId, topic, newValue, 92),
      expectedAction: "SUPERSEDE",
    });
  }

  // Phase 5: Final verification (10% of turns)
  const verifyTurns = Math.floor(turnCount * 0.1);
  for (let i = 0; i < verifyTurns; i++) {
    const topic = topics[i % topics.length];
    const config = TOPIC_CONFIGS[topic];

    turns.push({
      userMessage: `Tell me everything you know about my ${config.name}`,
      agentResponse: `Your ${config.name} is ${currentState[topic] || "not set"}.`,
      extractFacts: createNullExtractor(),
      isRetrieval: true,
    });
  }

  return { turns, finalState: currentState } as any; // Return both for validation
}

/**
 * Generate parallel chaos patterns for multiple users
 */
export function generateParallelChaosPatterns(
  userIds: string[],
  turnsPerUser: number = 20,
): Map<string, ConversationTurn[]> {
  const patterns = new Map<string, ConversationTurn[]>();

  for (const userId of userIds) {
    const turns: ConversationTurn[] = [];
    const topics = Object.keys(TOPIC_CONFIGS) as (keyof typeof TOPIC_CONFIGS)[];
    
    // Each user gets a unique set of preferences
    const userTopics = topics.sort(() => Math.random() - 0.5).slice(0, 4);
    const userPreferences: Record<string, string> = {};

    for (let i = 0; i < turnsPerUser; i++) {
      const topic = userTopics[i % userTopics.length];
      const config = TOPIC_CONFIGS[topic];

      if (i < userTopics.length) {
        // Establish initial preference
        const value = config.variations[Math.floor(Math.random() * config.variations.length)];
        userPreferences[topic] = value;

        turns.push({
          userMessage: `My ${config.name} is ${value}`,
          agentResponse: `Got it, ${userId}! Your ${config.name} is ${value}.`,
          extractFacts: createFactExtractor(userId, topic, value, 90),
          expectedAction: "ADD",
        });
      } else if (Math.random() > 0.6) {
        // Change preference
        const newValue = config.variations[Math.floor(Math.random() * config.variations.length)];
        userPreferences[topic] = newValue;

        turns.push({
          userMessage: `Actually, ${newValue} is my ${config.name} now`,
          agentResponse: `Updated, ${userId}!`,
          extractFacts: createFactExtractor(userId, topic, newValue, 88),
          expectedAction: "SUPERSEDE",
        });
      } else {
        // Ask about preference
        turns.push({
          userMessage: `What's my ${config.name}?`,
          agentResponse: `Your ${config.name} is ${userPreferences[topic]}.`,
          extractFacts: createNullExtractor(),
          isRetrieval: true,
        });
      }
    }

    patterns.set(userId, turns);
  }

  return patterns;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Utility Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Shuffle an array (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate a random delay for simulating realistic conversation timing
 */
export function randomDelay(minMs: number = 100, maxMs: number = 500): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Get the final expected state from a combined chaos pattern
 */
export function extractFinalState(
  turns: ConversationTurn[],
  _userId: string,
): Record<string, string> {
  const state: Record<string, string> = {};

  for (const turn of turns) {
    if (turn.extractFacts && !turn.isRetrieval) {
      // This is a state-changing turn - we'd need to inspect the fact
      // In practice, the generator already tracks this
    }
  }

  return state;
}
