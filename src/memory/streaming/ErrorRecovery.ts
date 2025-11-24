/**
 * Error Recovery System
 *
 * Handles stream failures with multiple recovery strategies:
 * - Store partial data for later recovery
 * - Rollback to last known good state
 * - Retry with exponential backoff
 * - Best-effort continuation
 *
 * Includes resume token generation for interrupted streams.
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../../convex-dev/_generated/api";
import type {
  RecoveryOptions,
  RecoveryResult,
  ResumeContext,
  StreamContext,
  StreamError,
} from "../../types/streaming";
import crypto from "crypto";

/**
 * Handles error recovery for streaming operations
 */
export class StreamErrorRecovery {
  private readonly client: ConvexClient;
  private readonly resumeTokenTTL: number = 3600000; // 1 hour

  constructor(client: ConvexClient) {
    this.client = client;
  }

  /**
   * Handle a stream error and attempt recovery
   */
  async handleStreamError(
    error: Error,
    context: StreamContext,
    options: RecoveryOptions,
  ): Promise<RecoveryResult> {
    console.warn("Stream error occurred:", error.message);

    switch (options.strategy) {
      case "store-partial":
        return await this.storePartialOnFailure(context, options);

      case "rollback":
        return await this.rollbackToLastState(context);

      case "retry":
        return await this.retryStrategy(context, options);

      case "best-effort":
        return await this.bestEffortStrategy(context, options);

      default:
        return {
          success: false,
          strategy: options.strategy,
          error,
        };
    }
  }

  /**
   * Store partial data on failure
   */
  async storePartialOnFailure(
    context: StreamContext,
    options: RecoveryOptions,
  ): Promise<RecoveryResult> {
    try {
      // Generate resume token if requested
      let resumeToken: string | undefined;
      if (options.preservePartialData) {
        resumeToken = await this.generateResumeToken({
          resumeToken: "", // Will be filled in
          lastProcessedChunk: context.chunkCount,
          accumulatedContent: context.accumulatedText,
          partialMemoryId: context.partialMemoryId || "",
          factsExtracted: context.extractedFactIds,
          timestamp: Date.now(),
          checksum: this.calculateChecksum(context.accumulatedText),
        });
      }

      return {
        success: true,
        strategy: "store-partial",
        partialMemoryId: context.partialMemoryId || "",
        resumeToken,
      };
    } catch (error) {
      return {
        success: false,
        strategy: "store-partial",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Rollback to last known good state
   */
  private async rollbackToLastState(
    context: StreamContext,
  ): Promise<RecoveryResult> {
    try {
      // Delete partial memory if it exists
      if (context.partialMemoryId) {
        await this.client.mutation(api.memories.deleteMemory, {
          memorySpaceId: context.memorySpaceId,
          memoryId: context.partialMemoryId,
        });
      }

      return {
        success: true,
        strategy: "rollback",
      };
    } catch (error) {
      return {
        success: false,
        strategy: "rollback",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Retry strategy (placeholder - actual retry logic in caller)
   */
  private async retryStrategy(
    _context: StreamContext,
    _options: RecoveryOptions,
  ): Promise<RecoveryResult> {
    // The actual retry logic should be handled by the caller
    // This just returns a result indicating retry should be attempted
    return {
      success: false,
      strategy: "retry",
    };
  }

  /**
   * Best-effort strategy - try to save what we can
   */
  private async bestEffortStrategy(
    context: StreamContext,
    options: RecoveryOptions,
  ): Promise<RecoveryResult> {
    try {
      // Try to store partial content if we have any
      if (context.accumulatedText && context.accumulatedText.length > 0) {
        const result = await this.storePartialOnFailure(context, options);
        return result; // Already returns RecoveryResult
      }

      return {
        success: false,
        strategy: "best-effort",
      };
    } catch (error) {
      return {
        success: false,
        strategy: "best-effort",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Retry an operation with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          // Calculate exponential backoff delay
          const delay = baseDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Generate a resume token for interrupted streams
   */
  async generateResumeToken(context: ResumeContext): Promise<string> {
    // Create a unique token
    const token = `resume_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;

    // Store resume context in mutable store with TTL
    try {
      await this.client.mutation(api.mutable.set, {
        namespace: "resume-tokens",
        key: token,
        value: {
          ...context,
          expiresAt: Date.now() + this.resumeTokenTTL,
        },
      });

      return token;
    } catch (error) {
      throw new Error(
        `Failed to generate resume token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate and retrieve resume context from token
   */
  async validateResumeToken(token: string): Promise<ResumeContext | null> {
    try {
      const stored = await this.client.query(api.mutable.get, {
        namespace: "resume-tokens",
        key: token,
      });

      if (!stored || !stored.value) {
        return null;
      }

      const context = stored.value as ResumeContext & { expiresAt: number };

      // Check if expired
      if (context.expiresAt < Date.now()) {
        // Note: Cleanup would require a delete mutation in mutable API
        // For now, expired tokens will remain until manually cleaned
        return null;
      }

      // Validate checksum
      const calculatedChecksum = this.calculateChecksum(
        context.accumulatedContent,
      );
      if (calculatedChecksum !== context.checksum) {
        console.warn("Resume context checksum mismatch");
        return null;
      }

      return context;
    } catch (error) {
      console.error("Failed to validate resume token:", error);
      return null;
    }
  }

  /**
   * Delete a resume token (cleanup)
   * Note: Requires mutable.delete API to be implemented
   */
  async deleteResumeToken(_token: string): Promise<void> {
    try {
      // TODO: Implement mutable.delete mutation in Convex
      console.warn("Resume token cleanup not yet implemented");
      // await this.client.mutation(api.mutable.delete, {
      //   namespace: 'resume-tokens',
      //   key: token,
      // });
    } catch (error) {
      console.warn("Failed to delete resume token:", error);
      // Non-critical - tokens will expire anyway
    }
  }

  /**
   * Calculate checksum for content verification
   */
  private calculateChecksum(content: string): string {
    return crypto
      .createHash("sha256")
      .update(content)
      .digest("hex")
      .substring(0, 16); // Use first 16 chars for brevity
  }

  /**
   * Sleep utility for backoff delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a StreamError from a generic error
   */
  createStreamError(
    error: Error,
    context: StreamContext,
    phase:
      | "initialization"
      | "streaming"
      | "fact-extraction"
      | "storage"
      | "finalization",
  ): StreamError {
    return {
      code: this.errorCodeFromError(error),
      message: error.message,
      recoverable: this.isRecoverable(error),
      partialDataSaved: !!context.partialMemoryId,
      context: {
        phase,
        chunkNumber: context.chunkCount,
        bytesProcessed: context.accumulatedText.length,
        partialMemoryId: context.partialMemoryId,
      },
      originalError: error,
    };
  }

  /**
   * Determine if an error is recoverable
   */
  private isRecoverable(error: Error): boolean {
    const recoverablePatterns = [
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "Network",
      "timeout",
    ];

    return recoverablePatterns.some((pattern) =>
      error.message.includes(pattern),
    );
  }

  /**
   * Get error code from error
   */
  private errorCodeFromError(error: Error): string {
    if ("code" in error && typeof error.code === "string") {
      return error.code;
    }
    return "UNKNOWN_ERROR";
  }
}

/**
 * Resumable error class
 */
export class ResumableStreamError extends Error {
  constructor(
    public readonly originalError: Error,
    public readonly resumeToken: string,
  ) {
    super(
      `Stream interrupted: ${originalError.message}. Resume with token: ${resumeToken}`,
    );
    this.name = "ResumableStreamError";
  }
}
