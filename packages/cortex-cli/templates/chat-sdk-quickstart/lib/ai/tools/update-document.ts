import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";

export const updateDocument = (_props: {
  session: Session;
  dataStream: UIMessageStreamWriter;
}) =>
  tool({
    description: "Backend-owned artifact update reference",
    inputSchema: z.object({ description: z.string(), id: z.string() }),
    outputSchema: z.object({
      content: z.string(),
      id: z.string(),
      kind: z.enum(["text", "code", "sheet"]),
      title: z.string(),
    }),
  });
