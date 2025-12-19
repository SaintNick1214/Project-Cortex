import { Cortex } from '@cortexmemory/sdk';

export const dynamic = 'force-dynamic';

function getCortex() {
  return new Cortex({ convexUrl: process.env.CONVEX_URL! });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const memorySpaceId = searchParams.get('memorySpaceId') || 'quickstart-demo';
    const limit = parseInt(searchParams.get('limit') || '20');

    const cortex = getCortex();

    // Fetch recent memories
    const memories = await cortex.memory.list({
      memorySpaceId,
      limit,
    });

    return Response.json({
      memories,
      count: memories.length,
      memorySpaceId,
    });
  } catch (error) {
    console.error('[Memories API Error]', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
