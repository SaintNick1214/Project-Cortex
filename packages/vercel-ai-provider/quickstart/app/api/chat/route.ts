import { createCortexMemory } from '@cortexmemory/vercel-ai-provider';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Create Cortex Memory provider with all SDK v0.21.0 capabilities
function getCortexMemory(memorySpaceId: string, userId: string) {
  return createCortexMemory({
    convexUrl: process.env.CONVEX_URL!,
    memorySpaceId,

    // User identification
    userId,
    userName: 'Demo User',

    // Agent identification (required for user-agent conversations in SDK v0.17.0+)
    agentId: 'quickstart-assistant',
    agentName: 'Cortex Demo Assistant',

    // Enable graph memory sync (auto-configured via env vars)
    enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === 'true',

    // Enable fact extraction (auto-configured via env vars)
    enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === 'true',

    // Streaming enhancements
    streamingOptions: {
      storePartialResponse: true,
      progressiveFactExtraction: true,
      enableAdaptiveProcessing: true,
    },

    // Debug in development
    debug: process.env.NODE_ENV === 'development',
  });
}

export async function POST(req: Request) {
  try {
    const { messages, memorySpaceId, userId } = await req.json();

    // Get memory-augmented model
    const cortexMemory = getCortexMemory(
      memorySpaceId || 'quickstart-demo',
      userId || 'demo-user'
    );

    // Stream response with automatic memory integration
    const result = await streamText({
      model: cortexMemory(openai('gpt-4o-mini')),
      messages,
      system: `You are a helpful AI assistant with long-term memory powered by Cortex.

Your capabilities:
- You remember everything users tell you across conversations
- You can recall facts, preferences, and context from past interactions
- You naturally reference what you've learned about the user

Behavior guidelines:
- When you remember something from a previous conversation, mention it naturally
- If asked about something you learned, reference it specifically
- Be conversational and friendly
- Help demonstrate the memory system by showing what you remember

Example interactions:
- User: "My name is Alex" → Remember and use their name
- User: "I work at Acme Corp" → Remember their employer
- User: "My favorite color is blue" → Remember their preference
- User: "What do you know about me?" → List everything you remember`,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('[Chat API Error]', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
