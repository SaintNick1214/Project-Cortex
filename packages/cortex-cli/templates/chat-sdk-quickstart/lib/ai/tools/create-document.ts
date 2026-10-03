import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description:
      "Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title and kind.",
    execute: async ({ title, kind }) => {
      const id = generateUUID();

      dataStream.write({
        data: kind,
        transient: true,
        type: "data-kind",
      });

      dataStream.write({
        data: id,
        transient: true,
        type: "data-id",
      });

      dataStream.write({
        data: title,
        transient: true,
        type: "data-title",
      });

      dataStream.write({
        data: null,
        transient: true,
        type: "data-clear",
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler.onCreateDocument({
        dataStream,
        id,
        session,
        title,
      });

      dataStream.write({ data: null, transient: true, type: "data-finish" });

      return {
        content: "A document was created and is now visible to the user.",
        id,
        kind,
        title,
      };
    },
    inputSchema: z.object({
      kind: z.enum(artifactKinds),
      title: z.string(),
    }),
  });
