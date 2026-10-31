import { streamObject } from "ai";
import { z } from "zod";
import { sheetPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
  kind: "sheet",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: getArtifactModel(),
      prompt: title,
      schema: z.object({
        csv: z.string().describe("CSV data"),
      }),
      system: sheetPrompt,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { csv } = object;

        if (csv) {
          dataStream.write({
            data: csv,
            transient: true,
            type: "data-sheetDelta",
          });

          draftContent = csv;
        }
      }
    }

    dataStream.write({
      data: draftContent,
      transient: true,
      type: "data-sheetDelta",
    });

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: getArtifactModel(),
      prompt: description,
      schema: z.object({
        csv: z.string(),
      }),
      system: updateDocumentPrompt(document.content, "sheet"),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { csv } = object;

        if (csv) {
          dataStream.write({
            data: csv,
            transient: true,
            type: "data-sheetDelta",
          });

          draftContent = csv;
        }
      }
    }

    return draftContent;
  },
});
