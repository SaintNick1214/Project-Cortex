/**
 * A2A API Validation
 *
 * Client-side validation for A2A operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type {
  A2ASendParams,
  A2ARequestParams,
  A2ABroadcastParams,
  A2AConversationFilters,
} from "../types";

/**
 * Custom error class for A2A validation failures
 */
export class A2AValidationError extends Error {
  public readonly name = "A2AValidationError";

  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Agent ID Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Agent ID pattern: alphanumeric, hyphens, underscores
 */
const AGENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_AGENT_ID_LENGTH = 100;

/**
 * Validates an agent ID
 *
 * @param id - Agent ID to validate
 * @param fieldName - Field name for error messages
 * @throws A2AValidationError if validation fails
 */
export function validateAgentId(id: string, fieldName: string): void {
  // Runtime check for potentially undefined input
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (id === undefined || id === null) {
    throw new A2AValidationError(
      `${fieldName} is required`,
      "INVALID_AGENT_ID",
      fieldName,
    );
  }

  if (typeof id !== "string") {
    throw new A2AValidationError(
      `${fieldName} must be a string`,
      "INVALID_AGENT_ID",
      fieldName,
    );
  }

  if (id.trim() === "") {
    throw new A2AValidationError(
      `${fieldName} cannot be empty`,
      "INVALID_AGENT_ID",
      fieldName,
    );
  }

  if (id.length > MAX_AGENT_ID_LENGTH) {
    throw new A2AValidationError(
      `${fieldName} exceeds maximum length of ${MAX_AGENT_ID_LENGTH} characters`,
      "INVALID_AGENT_ID",
      fieldName,
    );
  }

  if (!AGENT_ID_PATTERN.test(id)) {
    throw new A2AValidationError(
      `${fieldName} contains invalid characters. Only alphanumeric characters, hyphens, and underscores are allowed`,
      "INVALID_AGENT_ID",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Message Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MAX_MESSAGE_SIZE = 102400; // 100KB in bytes

/**
 * Validates a message content
 *
 * @param message - Message to validate
 * @throws A2AValidationError if validation fails
 */
export function validateMessage(message: string): void {
  // Runtime check for potentially undefined input
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (message === undefined || message === null) {
    throw new A2AValidationError(
      "Message is required",
      "EMPTY_MESSAGE",
      "message",
    );
  }

  if (typeof message !== "string") {
    throw new A2AValidationError(
      "Message must be a string",
      "EMPTY_MESSAGE",
      "message",
    );
  }

  if (message.trim() === "") {
    throw new A2AValidationError(
      "Message cannot be empty or whitespace-only",
      "EMPTY_MESSAGE",
      "message",
    );
  }

  // Check byte size for UTF-8 encoded message
  const byteSize = new TextEncoder().encode(message).length;
  if (byteSize > MAX_MESSAGE_SIZE) {
    throw new A2AValidationError(
      `Message exceeds maximum size of 100KB (current size: ${Math.round(byteSize / 1024)}KB)`,
      "MESSAGE_TOO_LARGE",
      "message",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Importance Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates importance value
 *
 * @param importance - Importance value (0-100)
 * @throws A2AValidationError if validation fails
 */
export function validateImportance(importance: number | undefined): void {
  if (importance === undefined) {
    return; // Optional field, skip validation
  }

  if (typeof importance !== "number") {
    throw new A2AValidationError(
      "Importance must be a number",
      "INVALID_IMPORTANCE",
      "importance",
    );
  }

  if (!Number.isInteger(importance)) {
    throw new A2AValidationError(
      "Importance must be an integer",
      "INVALID_IMPORTANCE",
      "importance",
    );
  }

  if (importance < 0 || importance > 100) {
    throw new A2AValidationError(
      `Importance must be between 0 and 100, got ${importance}`,
      "INVALID_IMPORTANCE",
      "importance",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Timeout Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MIN_TIMEOUT = 1000; // 1 second
const MAX_TIMEOUT = 300000; // 5 minutes

/**
 * Validates timeout value
 *
 * @param timeout - Timeout in milliseconds
 * @throws A2AValidationError if validation fails
 */
export function validateTimeout(timeout: number | undefined): void {
  if (timeout === undefined) {
    return; // Optional field, skip validation
  }

  if (typeof timeout !== "number") {
    throw new A2AValidationError(
      "Timeout must be a number",
      "INVALID_TIMEOUT",
      "timeout",
    );
  }

  if (!Number.isInteger(timeout)) {
    throw new A2AValidationError(
      "Timeout must be an integer",
      "INVALID_TIMEOUT",
      "timeout",
    );
  }

  if (timeout < MIN_TIMEOUT || timeout > MAX_TIMEOUT) {
    throw new A2AValidationError(
      `Timeout must be between ${MIN_TIMEOUT}ms (1 second) and ${MAX_TIMEOUT}ms (5 minutes), got ${timeout}ms`,
      "INVALID_TIMEOUT",
      "timeout",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Retries Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MAX_RETRIES = 10;

/**
 * Validates retries value
 *
 * @param retries - Number of retry attempts
 * @throws A2AValidationError if validation fails
 */
export function validateRetries(retries: number | undefined): void {
  if (retries === undefined) {
    return; // Optional field, skip validation
  }

  if (typeof retries !== "number") {
    throw new A2AValidationError(
      "Retries must be a number",
      "INVALID_RETRIES",
      "retries",
    );
  }

  if (!Number.isInteger(retries)) {
    throw new A2AValidationError(
      "Retries must be an integer",
      "INVALID_RETRIES",
      "retries",
    );
  }

  if (retries < 0 || retries > MAX_RETRIES) {
    throw new A2AValidationError(
      `Retries must be between 0 and ${MAX_RETRIES}, got ${retries}`,
      "INVALID_RETRIES",
      "retries",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Recipients Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MAX_RECIPIENTS = 100;

/**
 * Validates recipients array for broadcast
 *
 * @param recipients - Array of recipient agent IDs
 * @param sender - Sender agent ID (to check it's not in recipients)
 * @throws A2AValidationError if validation fails
 */
export function validateRecipients(recipients: string[], sender: string): void {
  // Runtime check for potentially undefined input
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!recipients || !Array.isArray(recipients)) {
    throw new A2AValidationError(
      "Recipients must be an array",
      "EMPTY_RECIPIENTS",
      "to",
    );
  }

  if (recipients.length === 0) {
    throw new A2AValidationError(
      "Recipients array cannot be empty",
      "EMPTY_RECIPIENTS",
      "to",
    );
  }

  if (recipients.length > MAX_RECIPIENTS) {
    throw new A2AValidationError(
      `Maximum ${MAX_RECIPIENTS} recipients allowed, got ${recipients.length}`,
      "TOO_MANY_RECIPIENTS",
      "to",
    );
  }

  // Check for duplicates
  const seen = new Set<string>();
  for (const recipient of recipients) {
    if (seen.has(recipient)) {
      throw new A2AValidationError(
        `Duplicate recipient: ${recipient}`,
        "DUPLICATE_RECIPIENTS",
        "to",
      );
    }
    seen.add(recipient);
  }

  // Check for sender in recipients
  if (recipients.includes(sender)) {
    throw new A2AValidationError(
      "Sender cannot be included in recipients list",
      "INVALID_RECIPIENT",
      "to",
    );
  }

  // Validate each recipient ID
  for (let i = 0; i < recipients.length; i++) {
    try {
      validateAgentId(recipients[i], `to[${i}]`);
    } catch (error) {
      if (error instanceof A2AValidationError) {
        throw new A2AValidationError(
          `Invalid recipient at index ${i}: ${error.message}`,
          "INVALID_AGENT_ID",
          "to",
        );
      }
      throw error;
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Conversation Filters Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MAX_LIMIT = 1000;

/**
 * Validates conversation filters
 *
 * @param filters - Conversation filters to validate
 * @throws A2AValidationError if validation fails
 */
export function validateConversationFilters(
  filters: A2AConversationFilters,
): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!filters) {
    return; // No filters to validate
  }

  // Validate date range
  if (filters.since && filters.until) {
    const sinceTime =
      filters.since instanceof Date ? filters.since.getTime() : filters.since;
    const untilTime =
      filters.until instanceof Date ? filters.until.getTime() : filters.until;

    if (sinceTime > untilTime) {
      throw new A2AValidationError(
        "'since' must be before 'until'",
        "INVALID_DATE_RANGE",
      );
    }
  }

  // Validate minImportance
  if (filters.minImportance !== undefined) {
    if (
      typeof filters.minImportance !== "number" ||
      filters.minImportance < 0 ||
      filters.minImportance > 100
    ) {
      throw new A2AValidationError(
        "minImportance must be between 0 and 100",
        "INVALID_IMPORTANCE",
        "minImportance",
      );
    }
  }

  // Validate limit
  if (filters.limit !== undefined) {
    if (typeof filters.limit !== "number" || !Number.isInteger(filters.limit)) {
      throw new A2AValidationError(
        "Limit must be an integer",
        "INVALID_LIMIT",
        "limit",
      );
    }

    if (filters.limit <= 0) {
      throw new A2AValidationError(
        "Limit must be greater than 0",
        "INVALID_LIMIT",
        "limit",
      );
    }

    if (filters.limit > MAX_LIMIT) {
      throw new A2AValidationError(
        `Limit cannot exceed ${MAX_LIMIT}`,
        "INVALID_LIMIT",
        "limit",
      );
    }
  }

  // Validate offset
  if (filters.offset !== undefined) {
    if (
      typeof filters.offset !== "number" ||
      !Number.isInteger(filters.offset)
    ) {
      throw new A2AValidationError(
        "Offset must be an integer",
        "INVALID_OFFSET",
        "offset",
      );
    }

    if (filters.offset < 0) {
      throw new A2AValidationError(
        "Offset cannot be negative",
        "INVALID_OFFSET",
        "offset",
      );
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Composite Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates send parameters
 *
 * @param params - Send parameters to validate
 * @throws A2AValidationError if validation fails
 */
export function validateSendParams(params: A2ASendParams): void {
  // Runtime check for potentially undefined input
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!params) {
    throw new A2AValidationError(
      "Send parameters are required",
      "MISSING_PARAMS",
    );
  }

  // Required fields
  validateAgentId(params.from, "from");
  validateAgentId(params.to, "to");
  validateMessage(params.message);

  // Check sender !== receiver
  if (params.from === params.to) {
    throw new A2AValidationError(
      "Cannot send message to self. 'from' and 'to' must be different agents",
      "SAME_AGENT_COMMUNICATION",
    );
  }

  // Optional fields
  validateImportance(params.importance);
}

/**
 * Validates request parameters
 *
 * @param params - Request parameters to validate
 * @throws A2AValidationError if validation fails
 */
export function validateRequestParams(params: A2ARequestParams): void {
  // Runtime check for potentially undefined input
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!params) {
    throw new A2AValidationError(
      "Request parameters are required",
      "MISSING_PARAMS",
    );
  }

  // Required fields
  validateAgentId(params.from, "from");
  validateAgentId(params.to, "to");
  validateMessage(params.message);

  // Check sender !== receiver
  if (params.from === params.to) {
    throw new A2AValidationError(
      "Cannot send request to self. 'from' and 'to' must be different agents",
      "SAME_AGENT_COMMUNICATION",
    );
  }

  // Optional fields
  validateTimeout(params.timeout);
  validateRetries(params.retries);
  validateImportance(params.importance);
}

/**
 * Validates broadcast parameters
 *
 * @param params - Broadcast parameters to validate
 * @throws A2AValidationError if validation fails
 */
export function validateBroadcastParams(params: A2ABroadcastParams): void {
  // Runtime check for potentially undefined input
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!params) {
    throw new A2AValidationError(
      "Broadcast parameters are required",
      "MISSING_PARAMS",
    );
  }

  // Required fields
  validateAgentId(params.from, "from");
  validateMessage(params.message);
  validateRecipients(params.to, params.from);

  // Optional fields
  validateImportance(params.importance);
}
