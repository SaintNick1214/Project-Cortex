/**
 * Governance API Validation
 *
 * Client-side validation for governance operations to catch errors before
 * they reach the backend, providing faster feedback and better error messages.
 */

import type {
  GovernancePolicy,
  PolicyScope,
  EnforcementOptions,
  ComplianceTemplate,
} from "../types";

/**
 * Custom error class for governance validation failures
 */
export class GovernanceValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "GovernanceValidationError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Policy Structure Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates complete governance policy structure
 */
export function validateGovernancePolicy(policy: GovernancePolicy): void {
  if (!policy) {
    throw new GovernanceValidationError(
      "Policy is required",
      "MISSING_POLICY",
    );
  }

  // Check required top-level fields
  if (!policy.conversations) {
    throw new GovernanceValidationError(
      "Policy must include conversations configuration",
      "MISSING_REQUIRED_FIELD",
      "conversations",
    );
  }

  if (!policy.immutable) {
    throw new GovernanceValidationError(
      "Policy must include immutable configuration",
      "MISSING_REQUIRED_FIELD",
      "immutable",
    );
  }

  if (!policy.mutable) {
    throw new GovernanceValidationError(
      "Policy must include mutable configuration",
      "MISSING_REQUIRED_FIELD",
      "mutable",
    );
  }

  if (!policy.vector) {
    throw new GovernanceValidationError(
      "Policy must include vector configuration",
      "MISSING_REQUIRED_FIELD",
      "vector",
    );
  }

  if (!policy.compliance) {
    throw new GovernanceValidationError(
      "Policy must include compliance configuration",
      "MISSING_REQUIRED_FIELD",
      "compliance",
    );
  }

  // Validate nested structures
  if (!policy.conversations.retention) {
    throw new GovernanceValidationError(
      "Conversations policy must include retention configuration",
      "MISSING_REQUIRED_FIELD",
      "conversations.retention",
    );
  }

  if (!policy.conversations.purging) {
    throw new GovernanceValidationError(
      "Conversations policy must include purging configuration",
      "MISSING_REQUIRED_FIELD",
      "conversations.purging",
    );
  }

  if (!policy.immutable.retention) {
    throw new GovernanceValidationError(
      "Immutable policy must include retention configuration",
      "MISSING_REQUIRED_FIELD",
      "immutable.retention",
    );
  }

  if (!policy.immutable.purging) {
    throw new GovernanceValidationError(
      "Immutable policy must include purging configuration",
      "MISSING_REQUIRED_FIELD",
      "immutable.purging",
    );
  }

  if (!policy.mutable.retention) {
    throw new GovernanceValidationError(
      "Mutable policy must include retention configuration",
      "MISSING_REQUIRED_FIELD",
      "mutable.retention",
    );
  }

  if (!policy.mutable.purging) {
    throw new GovernanceValidationError(
      "Mutable policy must include purging configuration",
      "MISSING_REQUIRED_FIELD",
      "mutable.purging",
    );
  }

  if (!policy.vector.retention) {
    throw new GovernanceValidationError(
      "Vector policy must include retention configuration",
      "MISSING_REQUIRED_FIELD",
      "vector.retention",
    );
  }

  if (!policy.vector.purging) {
    throw new GovernanceValidationError(
      "Vector policy must include purging configuration",
      "MISSING_REQUIRED_FIELD",
      "vector.purging",
    );
  }
}

/**
 * Validates period format strings like "7y", "30d", "1m"
 */
export function validatePeriodFormat(period: string, fieldName = "period"): void {
  if (!period || typeof period !== "string") {
    throw new GovernanceValidationError(
      `${fieldName} is required and must be a string`,
      "INVALID_PERIOD_FORMAT",
      fieldName,
    );
  }

  const periodRegex = /^\d+[dmy]$/;
  if (!periodRegex.test(period)) {
    throw new GovernanceValidationError(
      `Invalid period format "${period}". Must be in format like "7d" (days), "30m" (months), or "1y" (years)`,
      "INVALID_PERIOD_FORMAT",
      fieldName,
    );
  }
}

/**
 * Validates importance ranges for vector retention
 */
export function validateImportanceRanges(
  ranges: Array<{ range: [number, number]; versions: number }>,
): void {
  if (!Array.isArray(ranges)) {
    throw new GovernanceValidationError(
      "Importance ranges must be an array",
      "INVALID_IMPORTANCE_RANGE",
    );
  }

  for (let i = 0; i < ranges.length; i++) {
    const { range, versions } = ranges[i];

    if (!Array.isArray(range) || range.length !== 2) {
      throw new GovernanceValidationError(
        `Range at index ${i} must be a tuple [min, max]`,
        "INVALID_IMPORTANCE_RANGE",
      );
    }

    const [min, max] = range;

    // Validate range bounds
    if (typeof min !== "number" || typeof max !== "number") {
      throw new GovernanceValidationError(
        `Range at index ${i} must contain numbers`,
        "INVALID_IMPORTANCE_RANGE",
      );
    }

    if (min < 0 || min > 100) {
      throw new GovernanceValidationError(
        `Range minimum at index ${i} must be between 0 and 100, got ${min}`,
        "INVALID_IMPORTANCE_RANGE",
      );
    }

    if (max < 0 || max > 100) {
      throw new GovernanceValidationError(
        `Range maximum at index ${i} must be between 0 and 100, got ${max}`,
        "INVALID_IMPORTANCE_RANGE",
      );
    }

    if (min >= max) {
      throw new GovernanceValidationError(
        `Range at index ${i} must have min < max, got [${min}, ${max}]`,
        "INVALID_IMPORTANCE_RANGE",
      );
    }

    // Validate versions
    if (typeof versions !== "number" || versions < -1) {
      throw new GovernanceValidationError(
        `Versions at index ${i} must be a number >= -1 (where -1 means unlimited), got ${versions}`,
        "INVALID_VERSIONS",
      );
    }

    // Check for overlaps with previous ranges
    for (let j = 0; j < i; j++) {
      const [prevMin, prevMax] = ranges[j].range;
      
      // Check if ranges overlap
      if (
        (min >= prevMin && min <= prevMax) ||
        (max >= prevMin && max <= prevMax) ||
        (min <= prevMin && max >= prevMax)
      ) {
        throw new GovernanceValidationError(
          `Range [${min}, ${max}] at index ${i} overlaps with range [${prevMin}, ${prevMax}] at index ${j}`,
          "OVERLAPPING_IMPORTANCE_RANGES",
        );
      }
    }
  }
}

/**
 * Validates version count (must be >= -1, where -1 means unlimited)
 */
export function validateVersionCount(versions: number, fieldName = "versions"): void {
  if (typeof versions !== "number") {
    throw new GovernanceValidationError(
      `${fieldName} must be a number`,
      "INVALID_VERSIONS",
      fieldName,
    );
  }

  if (versions < -1) {
    throw new GovernanceValidationError(
      `${fieldName} must be >= -1 (where -1 means unlimited), got ${versions}`,
      "INVALID_VERSIONS",
      fieldName,
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scope Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates policy scope (organizationId or memorySpaceId)
 */
export function validatePolicyScope(scope: PolicyScope): void {
  if (!scope) {
    throw new GovernanceValidationError(
      "Scope is required",
      "MISSING_SCOPE",
    );
  }

  const hasOrgId = scope.organizationId && scope.organizationId.trim().length > 0;
  const hasSpaceId = scope.memorySpaceId && scope.memorySpaceId.trim().length > 0;

  if (!hasOrgId && !hasSpaceId) {
    throw new GovernanceValidationError(
      "Scope must include either organizationId or memorySpaceId",
      "INVALID_SCOPE",
    );
  }

  // Validate non-empty strings
  if (scope.organizationId !== undefined && !hasOrgId) {
    throw new GovernanceValidationError(
      "organizationId cannot be empty",
      "INVALID_SCOPE",
      "organizationId",
    );
  }

  if (scope.memorySpaceId !== undefined && !hasSpaceId) {
    throw new GovernanceValidationError(
      "memorySpaceId cannot be empty",
      "INVALID_SCOPE",
      "memorySpaceId",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enforcement Options Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_LAYERS = ["conversations", "immutable", "mutable", "vector"] as const;
const VALID_RULES = ["retention", "purging"] as const;

/**
 * Validates enforcement options
 */
export function validateEnforcementOptions(options: EnforcementOptions): void {
  if (!options) {
    throw new GovernanceValidationError(
      "Enforcement options are required",
      "MISSING_OPTIONS",
    );
  }

  // Validate scope
  if (!options.scope) {
    throw new GovernanceValidationError(
      "Enforcement requires a scope (organizationId or memorySpaceId)",
      "MISSING_SCOPE",
    );
  }

  validatePolicyScope(options.scope);

  // Validate layers if provided
  if (options.layers !== undefined) {
    if (!Array.isArray(options.layers)) {
      throw new GovernanceValidationError(
        "Layers must be an array",
        "INVALID_LAYERS",
      );
    }

    if (options.layers.length === 0) {
      throw new GovernanceValidationError(
        "Layers array cannot be empty. Valid layers: conversations, immutable, mutable, vector",
        "INVALID_LAYERS",
      );
    }

    for (const layer of options.layers) {
      if (!VALID_LAYERS.includes(layer as any)) {
        throw new GovernanceValidationError(
          `Invalid layer "${layer}". Valid layers: ${VALID_LAYERS.join(", ")}`,
          "INVALID_LAYERS",
        );
      }
    }
  }

  // Validate rules if provided
  if (options.rules !== undefined) {
    if (!Array.isArray(options.rules)) {
      throw new GovernanceValidationError(
        "Rules must be an array",
        "INVALID_RULES",
      );
    }

    if (options.rules.length === 0) {
      throw new GovernanceValidationError(
        "Rules array cannot be empty. Valid rules: retention, purging",
        "INVALID_RULES",
      );
    }

    for (const rule of options.rules) {
      if (!VALID_RULES.includes(rule as any)) {
        throw new GovernanceValidationError(
          `Invalid rule "${rule}". Valid rules: ${VALID_RULES.join(", ")}`,
          "INVALID_RULES",
        );
      }
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Date/Period Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validates date range (start must be before end)
 */
export function validateDateRange(start: Date, end: Date): void {
  if (!(start instanceof Date) || isNaN(start.getTime())) {
    throw new GovernanceValidationError(
      "Start date must be a valid Date object",
      "INVALID_DATE_RANGE",
      "start",
    );
  }

  if (!(end instanceof Date) || isNaN(end.getTime())) {
    throw new GovernanceValidationError(
      "End date must be a valid Date object",
      "INVALID_DATE_RANGE",
      "end",
    );
  }

  if (start.getTime() >= end.getTime()) {
    throw new GovernanceValidationError(
      "Start date must be before end date",
      "INVALID_DATE_RANGE",
    );
  }
}

/**
 * Validates enforcement stats period
 */
const VALID_PERIODS = ["7d", "30d", "90d", "1y"] as const;

export function validateStatsPeriod(period: string): void {
  if (!period || typeof period !== "string") {
    throw new GovernanceValidationError(
      "Period is required and must be a string",
      "INVALID_PERIOD",
    );
  }

  if (!VALID_PERIODS.includes(period as any)) {
    throw new GovernanceValidationError(
      `Invalid period "${period}". Valid periods: ${VALID_PERIODS.join(", ")}`,
      "INVALID_PERIOD",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Template Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VALID_TEMPLATES = ["GDPR", "HIPAA", "SOC2", "FINRA"] as const;

/**
 * Validates compliance template name
 */
export function validateComplianceTemplate(template: string): void {
  if (!template || typeof template !== "string") {
    throw new GovernanceValidationError(
      "Compliance template is required",
      "INVALID_COMPLIANCE_MODE",
    );
  }

  if (!VALID_TEMPLATES.includes(template as ComplianceTemplate)) {
    throw new GovernanceValidationError(
      `Invalid compliance template "${template}". Valid templates: ${VALID_TEMPLATES.join(", ")}`,
      "INVALID_COMPLIANCE_MODE",
    );
  }
}
