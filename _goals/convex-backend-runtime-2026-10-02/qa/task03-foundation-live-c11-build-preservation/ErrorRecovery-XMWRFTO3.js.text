import {
  api
} from "./chunk-24X3JR4G.js";
import "./chunk-3RG5ZIWI.js";

// src/memory/streaming/ErrorRecovery.ts
var StreamErrorRecovery = class {
  client;
  resumeTokenTTL = 36e5;
  // 1 hour
  constructor(client) {
    this.client = client;
  }
  /**
   * Handle a stream error and attempt recovery
   */
  async handleStreamError(error, context, options) {
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
          error
        };
    }
  }
  /**
   * Store partial data on failure
   */
  async storePartialOnFailure(context, options) {
    try {
      let resumeToken;
      if (options.preservePartialData) {
        resumeToken = await this.generateResumeToken({
          resumeToken: "",
          // Will be filled in
          lastProcessedChunk: context.chunkCount,
          accumulatedContent: context.accumulatedText,
          partialMemoryId: context.partialMemoryId || "",
          factsExtracted: context.extractedFactIds,
          timestamp: Date.now(),
          checksum: await this.calculateChecksum(context.accumulatedText)
        });
      }
      return {
        success: true,
        strategy: "store-partial",
        partialMemoryId: context.partialMemoryId || "",
        resumeToken
      };
    } catch (error) {
      return {
        success: false,
        strategy: "store-partial",
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  /**
   * Rollback to last known good state
   */
  async rollbackToLastState(context) {
    try {
      if (context.partialMemoryId) {
        await this.client.mutation(api.memories.deleteMemory, {
          memorySpaceId: context.memorySpaceId,
          memoryId: context.partialMemoryId
        });
      }
      return {
        success: true,
        strategy: "rollback"
      };
    } catch (error) {
      return {
        success: false,
        strategy: "rollback",
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  /**
   * Retry strategy (placeholder - actual retry logic in caller)
   */
  async retryStrategy(_context, _options) {
    return {
      success: false,
      strategy: "retry"
    };
  }
  /**
   * Best-effort strategy - try to save what we can
   */
  async bestEffortStrategy(context, options) {
    try {
      if (context.accumulatedText && context.accumulatedText.length > 0) {
        const result = await this.storePartialOnFailure(context, options);
        return result;
      }
      return {
        success: false,
        strategy: "best-effort"
      };
    } catch (error) {
      return {
        success: false,
        strategy: "best-effort",
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  /**
   * Retry an operation with exponential backoff
   */
  async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1e3) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries - 1) {
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
  async generateResumeToken(context) {
    const randomPart = Array.from(
      globalThis.crypto.getRandomValues(new Uint8Array(16)),
      (byte) => byte.toString(16).padStart(2, "0")
    ).join("");
    const token = `resume_${Date.now()}_${randomPart}`;
    try {
      await this.client.mutation(api.mutable.set, {
        namespace: "resume-tokens",
        key: token,
        value: {
          ...context,
          expiresAt: Date.now() + this.resumeTokenTTL
        }
      });
      return token;
    } catch (error) {
      throw new Error(
        `Failed to generate resume token: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Validate and retrieve resume context from token
   */
  async validateResumeToken(token) {
    try {
      const stored = await this.client.query(api.mutable.get, {
        namespace: "resume-tokens",
        key: token
      });
      if (!stored || !stored.value) {
        return null;
      }
      const context = stored.value;
      if (context.expiresAt < Date.now()) {
        return null;
      }
      const calculatedChecksum = await this.calculateChecksum(
        context.accumulatedContent
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
  async deleteResumeToken(_token) {
    try {
      console.warn("Resume token cleanup not yet implemented");
    } catch (error) {
      console.warn("Failed to delete resume token:", error);
    }
  }
  /**
   * Calculate checksum for content verification
   */
  async calculateChecksum(content) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
    return Array.from(
      new Uint8Array(digest),
      (byte) => byte.toString(16).padStart(2, "0")
    ).join("").substring(0, 16);
  }
  /**
   * Sleep utility for backoff delays
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * Create a StreamError from a generic error
   */
  createStreamError(error, context, phase) {
    return {
      code: this.errorCodeFromError(error),
      message: error.message,
      recoverable: this.isRecoverable(error),
      partialDataSaved: !!context.partialMemoryId,
      context: {
        phase,
        chunkNumber: context.chunkCount,
        bytesProcessed: context.accumulatedText.length,
        partialMemoryId: context.partialMemoryId
      },
      originalError: error
    };
  }
  /**
   * Determine if an error is recoverable
   */
  isRecoverable(error) {
    const recoverablePatterns = [
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "Network",
      "timeout"
    ];
    return recoverablePatterns.some(
      (pattern) => error.message.includes(pattern)
    );
  }
  /**
   * Get error code from error
   */
  errorCodeFromError(error) {
    if ("code" in error && typeof error.code === "string") {
      return error.code;
    }
    return "UNKNOWN_ERROR";
  }
};
var ResumableStreamError = class extends Error {
  constructor(originalError, resumeToken) {
    super(
      `Stream interrupted: ${originalError.message}. Resume with token: ${resumeToken}`
    );
    this.originalError = originalError;
    this.resumeToken = resumeToken;
    this.name = "ResumableStreamError";
  }
};
export {
  ResumableStreamError,
  StreamErrorRecovery
};
