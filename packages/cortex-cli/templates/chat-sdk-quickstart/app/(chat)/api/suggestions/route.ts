import { body, exact, identifier, withRuntime } from "@/lib/runtime/server";
export async function GET(request: Request) {
  return withRuntime(request, (client) =>
    client.getContentJob(
      identifier(new URL(request.url).searchParams.get("jobId"))
    )
  );
}
export async function POST(request: Request) {
  return withRuntime(request, async (client) => {
    const value = await body(request);
    exact(value, ["jobId", "suggestionId", "artifactVersion"]);
    if (!Number.isSafeInteger(value.artifactVersion)) {
      throw new Error("INVALID_INPUT");
    }
    return client.applyContentSuggestion({
      artifactVersion: Number(value.artifactVersion),
      jobId: identifier(value.jobId),
      suggestionId: identifier(value.suggestionId),
    });
  });
}
