import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      experimental_transform: smoothStream({ chunking: "word" }),
      model: getArtifactModel(),
      prompt: title,
      system:
        "Write about the given topic. Markdown is supported. Use headings wherever appropriate.",
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          data: text,
          transient: true,
          type: "data-textDelta",
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      experimental_transform: smoothStream({ chunking: "word" }),
      model: getArtifactModel(),
      prompt: description,
      providerOptions: {
        openai: {
          prediction: {
            content: document.content,
            type: "content",
          },
        },
      },
      system: updateDocumentPrompt(document.content, "text"),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          data: text,
          transient: true,
          type: "data-textDelta",
        });
      }
    }

    return draftContent;
  },
});
