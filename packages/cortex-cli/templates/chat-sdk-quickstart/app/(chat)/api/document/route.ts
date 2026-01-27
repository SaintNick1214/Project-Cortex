import { auth } from "@/app/(auth)/auth";
import type { ArtifactKind } from "@/components/artifact";
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentById,
  getDocumentsById,
  getDocumentVersion,
  getDocumentsByConversationId,
  saveDocument,
  undoDocumentChange,
  redoDocumentChange,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const version = searchParams.get("version");
  const conversationId = searchParams.get("conversationId");

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  // Get documents by conversation ID
  if (conversationId) {
    const documents = await getDocumentsByConversationId({ conversationId });
    // Filter to only documents owned by the user
    const userDocuments = documents.filter(
      (doc) => doc.userId === session.user!.id
    );
    return Response.json(userDocuments, { status: 200 });
  }

  if (!id) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter id is missing"
    ).toResponse();
  }

  // Get a specific version
  if (version) {
    const document = await getDocumentVersion({
      id,
      version: parseInt(version, 10),
    });

    if (!document) {
      return new ChatSDKError("not_found:document").toResponse();
    }

    if (document.userId !== session.user.id) {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    return Response.json(document, { status: 200 });
  }

  // Get all versions of a document
  const documents = await getDocumentsById({ id });

  const [document] = documents;

  if (!document) {
    return new ChatSDKError("not_found:document").toResponse();
  }

  if (document.userId !== session.user.id) {
    return new ChatSDKError("forbidden:document").toResponse();
  }

  return Response.json(documents, { status: 200 });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const action = searchParams.get("action");

  if (!id) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter id is required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  // Handle undo/redo actions
  if (action === "undo") {
    const document = await getDocumentById({ id });
    if (!document) {
      return new ChatSDKError("not_found:document").toResponse();
    }
    if (document.userId !== session.user.id) {
      return new ChatSDKError("forbidden:document").toResponse();
    }
    const result = await undoDocumentChange({ id });
    return Response.json(result, { status: 200 });
  }

  if (action === "redo") {
    const document = await getDocumentById({ id });
    if (!document) {
      return new ChatSDKError("not_found:document").toResponse();
    }
    if (document.userId !== session.user.id) {
      return new ChatSDKError("forbidden:document").toResponse();
    }
    const result = await redoDocumentChange({ id });
    return Response.json(result, { status: 200 });
  }

  // Standard save operation
  const {
    content,
    title,
    kind,
    conversationId,
    messageId,
  }: {
    content: string;
    title: string;
    kind: ArtifactKind;
    conversationId?: string;
    messageId?: string;
  } = await request.json();

  const documents = await getDocumentsById({ id });

  if (documents.length > 0) {
    const [doc] = documents;

    if (doc.userId !== session.user.id) {
      return new ChatSDKError("forbidden:document").toResponse();
    }
  }

  const document = await saveDocument({
    id,
    content,
    title,
    kind,
    userId: session.user.id,
    conversationId,
    messageId,
  });

  return Response.json(document, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const timestamp = searchParams.get("timestamp");

  if (!id) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter id is required."
    ).toResponse();
  }

  if (!timestamp) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter timestamp is required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const document = await getDocumentById({ id });

  if (!document) {
    return new ChatSDKError("not_found:document").toResponse();
  }

  if (document.userId !== session.user.id) {
    return new ChatSDKError("forbidden:document").toResponse();
  }

  const documentsDeleted = await deleteDocumentsByIdAfterTimestamp({
    id,
    timestamp: new Date(timestamp),
  });

  return Response.json(documentsDeleted, { status: 200 });
}
