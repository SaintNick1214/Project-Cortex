import { z } from "zod";

const inputSchema = z
  .object({
    artifact: z
      .object({ artifactId: z.string(), version: z.number().int().positive() })
      .strict()
      .optional(),
    conversationId: z.string().optional(),
    intent: z.enum(["title", "text", "code", "sheet", "suggestions"]),
    parentRunId: z.string().optional(),
    prompt: z.string(),
    requestId: z.string(),
    sourceMessageId: z.string().optional(),
    version: z.literal(1),
  })
  .strict();

import { body, exact, identifier, withRuntime } from "@/lib/runtime/server";
export async function GET(request: Request) {
  return withRuntime(request, (client) => {
    const query = new URL(request.url).searchParams;
    const id = query.get("jobId");
    return id
      ? client.getContentJob(identifier(id))
      : client.listContentJobs(
          query.get("conversationId")
            ? { conversationId: identifier(query.get("conversationId")) }
            : {}
        );
  });
}
export async function POST(request: Request) {
  return withRuntime(request, async (client) => {
    const input = await body(request);
    exact(input, [
      "version",
      "requestId",
      "intent",
      "prompt",
      "conversationId",
      "sourceMessageId",
      "parentRunId",
      "artifact",
    ]);
    identifier(input.requestId);
    return client.submitContentJob(inputSchema.parse(input));
  });
}
export async function DELETE(request: Request) {
  return withRuntime(request, (client) =>
    client.cancelContentJob(
      identifier(new URL(request.url).searchParams.get("jobId"))
    )
  );
}
export async function PATCH(request: Request) {
  return withRuntime(request, async (client) => {
    const input = await body(request);
    exact(input, ["jobId"]);
    return client.reconcileContentJob(identifier(input.jobId));
  });
}
