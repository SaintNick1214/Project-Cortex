import { Cortex } from "@cortexmemory/sdk";

export const dynamic = "force-dynamic";

function getCortex() {
  return new Cortex({ convexUrl: process.env.CONVEX_URL! });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const memorySpaceId =
      searchParams.get("memorySpaceId") || "quickstart-demo";
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const cortex = getCortex();

    // Fetch facts for the user/memory space
    const facts = await cortex.facts.list({
      memorySpaceId,
      ...(userId ? { userId } : {}),
      limit,
    });

    return Response.json({
      facts,
      count: facts.length,
      memorySpaceId,
    });
  } catch (error) {
    console.error("[Facts API Error]", error);

    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
