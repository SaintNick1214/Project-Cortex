import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";

/** Renderer-only legacy schema. App execution was replaced by backend content intents. */
export const createDocument = (_props: {
  session: Session;
  dataStream: UIMessageStreamWriter;
}) =>
  tool({
    description: "Backend-owned document reference",
    inputSchema: z.object({
      kind: z.enum(["text", "code", "sheet"]),
      title: z.string(),
    }),
    outputSchema: z.object({
      content: z.string(),
      id: z.string(),
      kind: z.enum(["text", "code", "sheet"]),
      title: z.string(),
    }),
  });
