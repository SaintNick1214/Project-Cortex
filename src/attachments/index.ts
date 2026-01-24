/**
 * Cortex SDK - Attachments API
 *
 * Multi-modal file storage for images, PDFs, audio, video, and generic files.
 * Memory space-scoped with multi-tenancy support.
 *
 * Features:
 * - Convex native file storage integration
 * - Upload URL generation for direct client uploads
 * - Signed download URLs
 * - Memory space isolation
 * - Multi-tenancy support
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  Attachment,
  AttachParams,
  ListAttachmentsFilter,
  ListAttachmentsResult,
  UploadUrlResult,
  DeleteManyAttachmentsResult,
} from "../types";
import type { ResilienceLayer } from "../resilience";
import type { AuthContext } from "../auth/types";
import {
  validateAttachmentId,
  validateAttachParams,
  validateListAttachmentsFilter,
  validateAttachmentIds,
} from "./validators";

// Export validation error for users who want to catch it specifically
export { AttachmentValidationError } from "./validators";


export class AttachmentsAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly resilience?: ResilienceLayer,
    private readonly authContext?: AuthContext,
  ) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Execute an operation through the resilience layer (if available)
   */
  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }

  /**
   * Handle ConvexError from direct Convex calls
   */
  private handleConvexError(error: unknown): never {
    if (
      error &&
      typeof error === "object" &&
      "data" in error &&
      (error as { data: unknown }).data !== undefined
    ) {
      const convexError = error as { data: unknown };
      const errorData =
        typeof convexError.data === "string"
          ? convexError.data
          : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Upload Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Generate a pre-signed upload URL for file upload.
   *
   * This method creates a short-lived upload URL that clients can use
   * to upload files directly to Convex storage.
   *
   * @example
   * ```typescript
   * const { uploadUrl } = await cortex.attachments.generateUploadUrl();
   *
   * // Client uploads file to uploadUrl via POST
   * const response = await fetch(uploadUrl, { method: 'POST', body: file });
   * const { storageId } = await response.json();
   *
   * // Then register the attachment
   * await cortex.attachments.attach({
   *   storageId,
   *   memorySpaceId: 'my-space',
   *   userId: 'user-123',
   *   type: 'image',
   *   mimeType: 'image/png',
   *   filename: 'photo.png',
   *   size: file.size,
   * });
   * ```
   */
  async generateUploadUrl(): Promise<UploadUrlResult> {
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.attachments.generateUploadUrl, {
        tenantId: this.authContext?.tenantId,
      }),
      "attachments:generateUploadUrl",
    );

    return result as UploadUrlResult;
  }

  /**
   * Register an uploaded file as an attachment.
   *
   * Call this after successfully uploading a file using the URL from generateUploadUrl.
   *
   * @example
   * ```typescript
   * const attachment = await cortex.attachments.attach({
   *   storageId: 'kg2abc123...',
   *   memorySpaceId: 'my-space',
   *   userId: 'user-123',
   *   type: 'image',
   *   mimeType: 'image/png',
   *   filename: 'screenshot.png',
   *   size: 1024000,
   *   conversationId: 'conv-456',
   * });
   * console.log(attachment.attachmentId); // "attach-abc123..."
   * ```
   */
  async attach(params: AttachParams): Promise<Attachment> {
    // Client-side validation
    validateAttachParams(params);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.attachments.attach, {
            storageId: params.storageId as unknown as import("convex/values").GenericId<"_storage">,
            memorySpaceId: params.memorySpaceId,
            userId: params.userId,
            type: params.type,
            mimeType: params.mimeType,
            filename: params.filename,
            size: params.size,
            conversationId: params.conversationId,
            messageId: params.messageId,
            memoryId: params.memoryId,
            artifactId: params.artifactId,
            dimensions: params.dimensions,
            duration: params.duration,
            metadata: params.metadata,
            tenantId: params.tenantId ?? this.authContext?.tenantId,
          }),
        "attachments:attach",
      );

      return result as Attachment;
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Read Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get an attachment by ID.
   *
   * @example
   * ```typescript
   * const attachment = await cortex.attachments.get('attach-abc123');
   * if (attachment) {
   *   console.log(attachment.filename, attachment.mimeType);
   * }
   * ```
   */
  async get(attachmentId: string): Promise<Attachment | null> {
    // Client-side validation
    validateAttachmentId(attachmentId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.attachments.get, {
          attachmentId,
          tenantId: this.authContext?.tenantId,
        }),
      "attachments:get",
    );

    return result as Attachment | null;
  }

  /**
   * Get a signed download URL for an attachment.
   *
   * The URL is temporary and will expire. Use it immediately to display
   * or download the file.
   *
   * @example
   * ```typescript
   * const url = await cortex.attachments.getUrl('attach-abc123');
   * if (url) {
   *   // Display image or download file
   *   window.open(url);
   * }
   * ```
   */
  async getUrl(attachmentId: string): Promise<string | null> {
    // Client-side validation
    validateAttachmentId(attachmentId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.attachments.getUrl, {
          attachmentId,
          tenantId: this.authContext?.tenantId,
        }),
      "attachments:getUrl",
    );

    const urlResult = result as { url: string } | null;
    return urlResult?.url ?? null;
  }

  /**
   * List attachments with comprehensive filters and pagination.
   *
   * @example
   * ```typescript
   * const result = await cortex.attachments.list({
   *   memorySpaceId: 'my-space',
   *   type: 'image',
   *   limit: 20,
   * });
   *
   * for (const attachment of result.attachments) {
   *   console.log(attachment.filename);
   * }
   *
   * // Pagination
   * if (result.hasMore) {
   *   const nextPage = await cortex.attachments.list({
   *     memorySpaceId: 'my-space',
   *     cursor: result.cursor,
   *   });
   * }
   * ```
   */
  async list(filter: ListAttachmentsFilter): Promise<ListAttachmentsResult> {
    // Client-side validation
    validateListAttachmentsFilter(filter);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.attachments.list, {
          memorySpaceId: filter.memorySpaceId,
          tenantId: filter.tenantId ?? this.authContext?.tenantId,
          conversationId: filter.conversationId,
          messageId: filter.messageId,
          memoryId: filter.memoryId,
          artifactId: filter.artifactId,
          userId: filter.userId,
          type: filter.type,
          limit: filter.limit,
          cursor: filter.cursor,
          sortBy: filter.sortBy,
          sortOrder: filter.sortOrder,
        }),
      "attachments:list",
    );

    return result as ListAttachmentsResult;
  }

  /**
   * Get attachments for a specific conversation.
   *
   * @example
   * ```typescript
   * const attachments = await cortex.attachments.getByConversation('conv-123');
   * console.log(`${attachments.length} attachments in this conversation`);
   * ```
   */
  async getByConversation(
    conversationId: string,
    options?: { type?: "image" | "audio" | "video" | "file" | "pdf"; limit?: number },
  ): Promise<Attachment[]> {
    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.attachments.getByConversation, {
          conversationId,
          tenantId: this.authContext?.tenantId,
          type: options?.type,
          limit: options?.limit,
        }),
      "attachments:getByConversation",
    );

    return result as Attachment[];
  }

  /**
   * Get attachments for a specific message.
   *
   * @example
   * ```typescript
   * const attachments = await cortex.attachments.getByMessage('msg-123');
   * for (const att of attachments) {
   *   console.log(att.filename);
   * }
   * ```
   */
  async getByMessage(messageId: string): Promise<Attachment[]> {
    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.attachments.getByMessage, {
          messageId,
          tenantId: this.authContext?.tenantId,
        }),
      "attachments:getByMessage",
    );

    return result as Attachment[];
  }

  /**
   * Count attachments matching filters.
   *
   * @example
   * ```typescript
   * const count = await cortex.attachments.count({
   *   memorySpaceId: 'my-space',
   *   type: 'image',
   * });
   * console.log(`${count} images in this space`);
   * ```
   */
  async count(filter: {
    memorySpaceId: string;
    conversationId?: string;
    messageId?: string;
    userId?: string;
    type?: "image" | "audio" | "video" | "file" | "pdf";
    tenantId?: string;
  }): Promise<number> {
    // Client-side validation
    validateListAttachmentsFilter({ memorySpaceId: filter.memorySpaceId });

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.attachments.count, {
          memorySpaceId: filter.memorySpaceId,
          tenantId: filter.tenantId ?? this.authContext?.tenantId,
          conversationId: filter.conversationId,
          messageId: filter.messageId,
          userId: filter.userId,
          type: filter.type,
        }),
      "attachments:count",
    );

    return result as number;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Delete Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Delete an attachment.
   *
   * Removes both the metadata record and the file from storage.
   *
   * @example
   * ```typescript
   * const success = await cortex.attachments.delete('attach-abc123');
   * if (success) {
   *   console.log('Attachment deleted');
   * }
   * ```
   */
  async delete(attachmentId: string): Promise<boolean> {
    // Client-side validation
    validateAttachmentId(attachmentId);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.attachments.remove, {
            attachmentId,
            tenantId: this.authContext?.tenantId,
          }),
        "attachments:delete",
      );

      return (result as { deleted: boolean }).deleted;
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Bulk delete multiple attachments.
   *
   * Returns the count of successfully deleted attachments.
   *
   * @example
   * ```typescript
   * const result = await cortex.attachments.deleteMany([
   *   'attach-123',
   *   'attach-456',
   *   'attach-789',
   * ]);
   * console.log(`Deleted ${result.deleted} of ${result.total} attachments`);
   * ```
   */
  async deleteMany(attachmentIds: string[]): Promise<DeleteManyAttachmentsResult> {
    // Client-side validation
    validateAttachmentIds(attachmentIds);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.attachments.removeMany, {
            attachmentIds,
            tenantId: this.authContext?.tenantId,
          }),
        "attachments:deleteMany",
      );

      return result as DeleteManyAttachmentsResult;
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Convenience Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Upload a file and register it as an attachment in one operation.
   *
   * This is a convenience method that handles the full upload flow:
   * generates upload URL, uploads file, and registers the attachment.
   *
   * @example
   * ```typescript
   * const attachment = await cortex.attachments.upload({
   *   file: imageBlob,
   *   memorySpaceId: 'my-space',
   *   userId: 'user-123',
   *   type: 'image',
   *   filename: 'photo.png',
   *   conversationId: 'conv-456',
   * });
   * console.log(attachment.attachmentId);
   * ```
   */
  async upload(params: {
    file: Blob;
    memorySpaceId: string;
    userId: string;
    type: "image" | "audio" | "video" | "file" | "pdf";
    filename: string;
    mimeType?: string;
    conversationId?: string;
    messageId?: string;
    memoryId?: string;
    artifactId?: string;
    dimensions?: { width: number; height: number };
    duration?: number;
    metadata?: Record<string, unknown>;
    tenantId?: string;
  }): Promise<Attachment> {
    // Step 1: Generate upload URL
    const { uploadUrl } = await this.generateUploadUrl();

    // Step 2: Upload the file
    const mimeType = params.mimeType ?? (params.file.type || "application/octet-stream");
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: params.file,
    });

    if (!response.ok) {
      throw new Error(`File upload failed: ${response.statusText}`);
    }

    // Get the storageId from the response
    const { storageId } = (await response.json()) as { storageId: string };

    // Step 3: Register the attachment
    return this.attach({
      storageId,
      memorySpaceId: params.memorySpaceId,
      userId: params.userId,
      type: params.type,
      mimeType,
      filename: params.filename,
      size: params.file.size,
      conversationId: params.conversationId,
      messageId: params.messageId,
      memoryId: params.memoryId,
      artifactId: params.artifactId,
      dimensions: params.dimensions,
      duration: params.duration,
      metadata: params.metadata,
      tenantId: params.tenantId,
    });
  }
}
