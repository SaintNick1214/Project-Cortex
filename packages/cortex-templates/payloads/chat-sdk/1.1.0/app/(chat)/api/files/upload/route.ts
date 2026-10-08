import { privateCall } from "@/lib/private-backend";
import { privateRequest } from "@/lib/private-request";
/**
 * File Upload API Route
 *
 * Implements file uploads using Cortex Attachments API.
 * Flow: generateUploadUrl → client upload → attach → getUrl
 */

import { auth } from "@/app/(auth)/auth";

import { requireScope, withCortex } from "@/lib/cortex";

/**
 * Determine attachment type from MIME type
 */
function getAttachmentType(
  mimeType: string,
): "image" | "audio" | "video" | "pdf" | "file" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "file";
}

export async function POST(request: Request) {
  return privateRequest(request, async () => {
    const session = await auth();

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const scope = await requireScope(session.user.id);
      return await withCortex(scope, async (cortex) => {
        const memorySpaceId = scope.memorySpaceId;

        // Parse the form data to get the file
        const formData = await request.formData();
        const value = formData.get("file");
        const file = value instanceof File ? value : null;

        if (!file) {
          return new Response(JSON.stringify({ error: "No file provided" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (
          file.size > 10 * 1024 * 1024 ||
          !["image/png", "image/jpeg"].includes(file.type)
        )
          return Response.json(
            { error: "Upload a PNG or JPEG up to 10 MiB" },
            { status: 400 },
          );
        // Step 1: Generate upload URL from Cortex
        const { uploadUrl } = await cortex.attachments.generateUploadUrl();

        // Step 2: Upload file to Convex storage
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
        });

        if (!uploadResponse.ok) {
          return new Response(
            JSON.stringify({
              error: "Failed to upload file to storage",
              details: uploadResponse.statusText,
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const { storageId } = (await uploadResponse.json()) as {
          storageId: string;
        };

        // Step 3: Register attachment in Cortex
        const attachment = await cortex.attachments.attach({
          storageId,
          memorySpaceId,
          userId: session.user.id,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          type: getAttachmentType(file.type),
          size: file.size,
        });

        // Step 4: Get signed download URL for display
        if (
          attachment.userId !== scope.userId ||
          attachment.tenantId !== scope.tenantId ||
          attachment.memorySpaceId !== scope.memorySpaceId
        )
          throw new Error("Attachment unavailable");
        const downloadUrl = await cortex.attachments.getUrl(
          attachment.attachmentId,
        );

        if (!downloadUrl) {
          return new Response(
            JSON.stringify({ error: "Failed to generate download URL" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        await privateCall("app/chatData:registerUpload", {
          ...scope,
          attachmentId: attachment.attachmentId,
          url: downloadUrl,
        });
        // Return response in format expected by multimodal-input component
        return Response.json({
          url: downloadUrl,
          pathname: file.name,
          contentType: file.type || "application/octet-stream",
          // Include additional metadata for consumers that need it
          id: attachment.attachmentId,
          size: file.size,
        });
      });
    } catch {
      return new Response(
        JSON.stringify({
          error: "Failed to upload file",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  });
}
