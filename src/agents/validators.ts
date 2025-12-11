/**
 * Agents API Validation
 *
 * Client-side validation for agent operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type {
  AgentRegistration,
  AgentFilters,
  UnregisterAgentOptions,
  ExportAgentsOptions,
} from "../types";

/**
 * Custom error class for agent validation failures
 */
export class AgentValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "AgentValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Agent ID Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates agent ID is non-empty and within length limits
 */
export function validateAgentId(agentId: string, fieldName = "agentId"): void {
  // Runtime defensive checks - TypeScript types don't prevent JS callers from passing invalid values
  if ((agentId as unknown) === null || (agentId as unknown) === undefined) {
    throw new AgentValidationError(
      `${fieldName} is required`,
      "MISSING_AGENT_ID",
      fieldName,
    );
  }

  if (typeof agentId !== "string") {
    throw new AgentValidationError(
      `${fieldName} must be a string`,
      "INVALID_AGENT_ID_FORMAT",
      fieldName,
    );
  }

  if (agentId.trim().length === 0) {
    throw new AgentValidationError(
      `${fieldName} cannot be empty or whitespace only`,
      "EMPTY_AGENT_ID",
      fieldName,
    );
  }

  if (agentId.length > 256) {
    throw new AgentValidationError(
      `${fieldName} cannot exceed 256 characters, got ${agentId.length}`,
      "AGENT_ID_TOO_LONG",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Agent Name Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates agent name is non-empty and within length limits
 */
export function validateAgentName(name: string, fieldName = "name"): void {
  // Runtime defensive checks - TypeScript types don't prevent JS callers from passing invalid values
  if ((name as unknown) === null || (name as unknown) === undefined) {
    throw new AgentValidationError(
      `${fieldName} is required`,
      "MISSING_AGENT_NAME",
      fieldName,
    );
  }

  if (typeof name !== "string") {
    throw new AgentValidationError(
      `${fieldName} must be a string`,
      "INVALID_NAME_FORMAT",
      fieldName,
    );
  }

  if (name.trim().length === 0) {
    throw new AgentValidationError(
      `${fieldName} cannot be empty or whitespace only`,
      "EMPTY_AGENT_NAME",
      fieldName,
    );
  }

  if (name.length > 200) {
    throw new AgentValidationError(
      `${fieldName} cannot exceed 200 characters, got ${name.length}`,
      "AGENT_NAME_TOO_LONG",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Agent Registration Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates complete agent registration structure
 */
export function validateAgentRegistration(agent: AgentRegistration): void {
  // Runtime defensive checks - TypeScript types don't prevent JS callers from passing invalid values
  if (!(agent as unknown)) {
    throw new AgentValidationError(
      "Agent registration object is required",
      "MISSING_AGENT_ID",
    );
  }

  // Validate required fields exist (not undefined)
  if ((agent.id as unknown) === undefined || (agent.id as unknown) === null) {
    throw new AgentValidationError(
      "Agent ID is required",
      "MISSING_AGENT_ID",
      "id",
    );
  }

  if (
    (agent.name as unknown) === undefined ||
    (agent.name as unknown) === null
  ) {
    throw new AgentValidationError(
      "Agent name is required",
      "MISSING_AGENT_NAME",
      "name",
    );
  }

  // Validate field formats (these will check for empty strings)
  validateAgentId(agent.id, "id");
  validateAgentName(agent.name, "name");

  // Validate optional fields if provided
  if (agent.metadata !== undefined) {
    validateMetadata(agent.metadata, "metadata");
  }

  if (agent.config !== undefined) {
    validateConfig(agent.config, "config");
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Status Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_STATUSES = ["active", "inactive", "archived"] as const;

/**
 * Validates agent status value
 */
export function validateAgentStatus(
  status: string,
  fieldName = "status",
): void {
  if (!status || typeof status !== "string") {
    throw new AgentValidationError(
      `${fieldName} is required and must be a string`,
      "INVALID_STATUS_VALUE",
      fieldName,
    );
  }

  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    throw new AgentValidationError(
      `Invalid status "${status}". Valid values: ${VALID_STATUSES.join(", ")}`,
      "INVALID_STATUS",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Filter Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_SORT_BY = ["name", "registeredAt", "lastActive"] as const;
const VALID_SORT_ORDER = ["asc", "desc"] as const;

/**
 * Validates agent filter options
 */
export function validateAgentFilters(filters: AgentFilters): void {
  // Runtime defensive check
  if (!(filters as unknown)) {
    return; // Filters are optional
  }

  // Validate limit
  if (filters.limit !== undefined) {
    if (typeof filters.limit !== "number") {
      throw new AgentValidationError(
        "limit must be a number",
        "INVALID_LIMIT_VALUE",
        "limit",
      );
    }

    if (filters.limit < 1 || filters.limit > 1000) {
      throw new AgentValidationError(
        `limit must be between 1 and 1000, got ${filters.limit}`,
        "INVALID_LIMIT_VALUE",
        "limit",
      );
    }
  }

  // Validate offset
  if (filters.offset !== undefined) {
    if (typeof filters.offset !== "number") {
      throw new AgentValidationError(
        "offset must be a number",
        "INVALID_OFFSET_VALUE",
        "offset",
      );
    }

    if (filters.offset < 0) {
      throw new AgentValidationError(
        `offset must be >= 0, got ${filters.offset}`,
        "INVALID_OFFSET_VALUE",
        "offset",
      );
    }
  }

  // Validate status
  if (filters.status !== undefined) {
    validateAgentStatus(filters.status, "status");
  }

  // Validate metadata
  if (filters.metadata !== undefined) {
    validateMetadata(filters.metadata, "metadata");
  }

  // Validate timestamp range
  if (
    filters.registeredAfter !== undefined &&
    filters.registeredBefore !== undefined
  ) {
    if (filters.registeredAfter >= filters.registeredBefore) {
      throw new AgentValidationError(
        "registeredAfter must be before registeredBefore",
        "INVALID_TIMESTAMP_RANGE",
      );
    }
  }

  // Validate sortBy
  if (filters.sortBy !== undefined) {
    if (!(VALID_SORT_BY as readonly string[]).includes(filters.sortBy)) {
      throw new AgentValidationError(
        `Invalid sortBy "${filters.sortBy}". Valid values: ${VALID_SORT_BY.join(", ")}`,
        "INVALID_SORT_BY",
        "sortBy",
      );
    }
  }

  // Validate sortOrder
  if (filters.sortOrder !== undefined) {
    if (!(VALID_SORT_ORDER as readonly string[]).includes(filters.sortOrder)) {
      throw new AgentValidationError(
        `Invalid sortOrder "${filters.sortOrder}". Valid values: ${VALID_SORT_ORDER.join(", ")}`,
        "INVALID_SORT_ORDER",
        "sortOrder",
      );
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Unregister Options Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates unregister options
 */
export function validateUnregisterOptions(
  options: UnregisterAgentOptions,
): void {
  // Runtime defensive check
  if (!(options as unknown)) {
    return; // Options are optional
  }

  // Conflicting options: dryRun=true requires verify to be enabled
  if (options.dryRun === true && options.verify === false) {
    throw new AgentValidationError(
      "Cannot disable verification in dry run mode. Set verify=true or remove verify option.",
      "CONFLICTING_OPTIONS",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Metadata/Config Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates metadata is a plain object
 */
export function validateMetadata(
  metadata: Record<string, unknown>,
  fieldName = "metadata",
): void {
  // Runtime defensive check
  if ((metadata as unknown) === null) {
    throw new AgentValidationError(
      `${fieldName} cannot be null`,
      "INVALID_METADATA_FORMAT",
      fieldName,
    );
  }

  if (typeof metadata !== "object") {
    throw new AgentValidationError(
      `${fieldName} must be an object`,
      "INVALID_METADATA_FORMAT",
      fieldName,
    );
  }

  if (Array.isArray(metadata)) {
    throw new AgentValidationError(
      `${fieldName} must be a plain object, not an array`,
      "INVALID_METADATA_FORMAT",
      fieldName,
    );
  }
}

/**
 * Validates config is a plain object
 */
export function validateConfig(
  config: Record<string, unknown>,
  fieldName = "config",
): void {
  // Runtime defensive check
  if ((config as unknown) === null) {
    throw new AgentValidationError(
      `${fieldName} cannot be null`,
      "INVALID_CONFIG_FORMAT",
      fieldName,
    );
  }

  if (typeof config !== "object") {
    throw new AgentValidationError(
      `${fieldName} must be an object`,
      "INVALID_CONFIG_FORMAT",
      fieldName,
    );
  }

  if (Array.isArray(config)) {
    throw new AgentValidationError(
      `${fieldName} must be a plain object, not an array`,
      "INVALID_CONFIG_FORMAT",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Update Payload Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates update operation has valid fields
 */
export function validateUpdatePayload(
  agentId: string,
  updates: Partial<AgentRegistration> & { status?: string },
): void {
  // Validate agentId
  validateAgentId(agentId, "agentId");

  // Check that at least one field is provided
  const hasUpdates =
    updates.name !== undefined ||
    updates.description !== undefined ||
    updates.metadata !== undefined ||
    updates.config !== undefined ||
    (updates as { status?: string }).status !== undefined;

  if (!hasUpdates) {
    throw new AgentValidationError(
      "At least one field must be provided for update (name, description, metadata, config, or status)",
      "MISSING_UPDATES",
    );
  }

  // Validate individual fields if provided
  if (updates.name !== undefined) {
    validateAgentName(updates.name, "name");
  }

  if (updates.metadata !== undefined) {
    validateMetadata(updates.metadata, "metadata");
  }

  if (updates.config !== undefined) {
    validateConfig(updates.config, "config");
  }

  if ((updates as { status?: string }).status !== undefined) {
    validateAgentStatus((updates as { status: string }).status, "status");
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Export Options Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_EXPORT_FORMATS = ["json", "csv"] as const;

/**
 * Validates export options
 */
export function validateExportOptions(options: ExportAgentsOptions): void {
  // Runtime defensive check
  if (!(options as unknown)) {
    throw new AgentValidationError(
      "Export options are required",
      "MISSING_OPTIONS",
    );
  }

  // Validate format is provided
  if (!options.format) {
    throw new AgentValidationError(
      "format is required",
      "MISSING_FORMAT",
      "format",
    );
  }

  // Validate format value
  if (!(VALID_EXPORT_FORMATS as readonly string[]).includes(options.format)) {
    throw new AgentValidationError(
      `Invalid format "${options.format}". Valid values: ${VALID_EXPORT_FORMATS.join(", ")}`,
      "INVALID_FORMAT",
      "format",
    );
  }

  // Validate filters if provided
  if (options.filters) {
    validateAgentFilters(options.filters);
  }
}
