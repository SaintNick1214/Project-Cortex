import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";

export const requestSuggestions = (_props: {
  session: Session;
  dataStream: UIMessageStreamWriter;
}) =>
  tool({
    description: "Backend-owned suggestion reference",
    inputSchema: z.object({ documentId: z.string() }),
    outputSchema: z.object({
      id: z.string(),
      kind: z.enum(["text", "code", "sheet"]),
      message: z.string(),
      title: z.string(),
    }),
  });
