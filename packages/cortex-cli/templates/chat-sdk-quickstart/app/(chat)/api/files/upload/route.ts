/**
 * File Upload API Route
 *
 * Implements file uploads using Cortex Attachments API.
 * Flow: generateUploadUrl → client upload → attach → getUrl
 */

import { auth } from "@/app/(auth)/auth";
import { getCortexAuthContext } from "@/lib/auth-cortex";
import { getCortex, getCortexWithAuth, getMemorySpaceId } from "@/lib/cortex";

/**
 * Determine attachment type from MIME type
 */
function getAttachmentType(
  mimeType: string
): "image" | "audio" | "video" | "pdf" | "file" {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  return "file";
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const authContext = await getCortexAuthContext();
    const cortex = authContext ? getCortexWithAuth(authContext) : getCortex();
    const memorySpaceId = getMemorySpaceId();

    // Parse the form data to get the file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Step 1: Generate upload URL from Cortex
    const { uploadUrl } = await cortex.attachments.generateUploadUrl();

    // Step 2: Upload file to Convex storage
    const uploadResponse = await fetch(uploadUrl, {
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
      method: "POST",
    });

    if (!uploadResponse.ok) {
      return new Response(
        JSON.stringify({
          details: uploadResponse.statusText,
          error: "Failed to upload file to storage",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const { storageId } = (await uploadResponse.json()) as {
      storageId: string;
    };

    // Step 3: Register attachment in Cortex
    const attachment = await cortex.attachments.attach({
      filename: file.name,
      memorySpaceId,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      storageId,
      type: getAttachmentType(file.type),
      userId: session.user.id,
    });

    // Step 4: Get signed download URL for display
    const downloadUrl = await cortex.attachments.getUrl(
      attachment.attachmentId
    );

    if (!downloadUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to generate download URL" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Return response in format expected by multimodal-input component
    return Response.json({
      contentType: file.type || "application/octet-stream",
      // Include additional metadata for consumers that need it
      id: attachment.attachmentId,
      pathname: file.name,
      size: file.size,
      url: downloadUrl,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return new Response(
      JSON.stringify({
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Failed to upload file",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}
