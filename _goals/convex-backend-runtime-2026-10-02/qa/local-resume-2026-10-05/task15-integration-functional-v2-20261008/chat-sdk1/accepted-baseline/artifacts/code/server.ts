import { streamObject } from "ai";
import { z } from "zod";
import { codePrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const codeDocumentHandler = createDocumentHandler<"code">({
  kind: "code",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: getArtifactModel(),
      prompt: title,
      schema: z.object({
        code: z.string(),
      }),
      system: codePrompt,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            data: code ?? "",
            transient: true,
            type: "data-codeDelta",
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: getArtifactModel(),
      prompt: description,
      schema: z.object({
        code: z.string(),
      }),
      system: updateDocumentPrompt(document.content, "code"),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            data: code ?? "",
            transient: true,
            type: "data-codeDelta",
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
});
