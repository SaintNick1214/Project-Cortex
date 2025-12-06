/**
 * Governance API - Data Retention, Purging, and Compliance Rules
 *
 * Centralized control over data retention, purging, and compliance rules
 * across all Cortex storage layers.
 */

import type { ConvexClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { api } from "../../convex-dev/_generated/api";
import type {
  GovernancePolicy,
  PolicyScope,
  PolicyResult,
  ComplianceTemplate,
  EnforcementOptions,
  EnforcementResult,
  SimulationOptions,
  SimulationResult,
  ComplianceReportOptions,
  ComplianceReport,
  EnforcementStatsOptions,
  EnforcementStats,
} from "../types";
import {
  GovernanceValidationError,
  validateGovernancePolicy,
  validatePeriodFormat,
  validateImportanceRanges,
  validateVersionCount,
  validatePolicyScope,
  validateEnforcementOptions,
  validateDateRange,
  validateStatsPeriod,
  validateComplianceTemplate,
} from "./validators";
import type { ResilienceLayer } from "../resilience";

export class GovernanceAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly _graphAdapter?: unknown,
    private readonly resilience?: ResilienceLayer,
  ) {}

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

  /**
   * Set governance policy for organization or memory space
   *
   * @param policy - Complete governance policy
   * @returns Policy result with confirmation
   *
   * @example
   * ```typescript
   * await cortex.governance.setPolicy({
   *   organizationId: "org-123",
   *   conversations: {
   *     retention: { deleteAfter: "7y", purgeOnUserRequest: true },
   *     purging: { autoDelete: true, deleteInactiveAfter: "2y" }
   *   },
   *   compliance: { mode: "GDPR", dataRetentionYears: 7, auditLogging: true }
   * });
   * ```
   */
  async setPolicy(policy: GovernancePolicy): Promise<PolicyResult> {
    // Validate complete policy structure
    validateGovernancePolicy(policy);

    // Validate at least one scope is provided
    if (!policy.organizationId && !policy.memorySpaceId) {
      throw new GovernanceValidationError(
        "Policy must specify either organizationId or memorySpaceId",
        "MISSING_SCOPE",
      );
    }

    // Validate specific fields - deleteAfter is required, archiveAfter is optional
    validatePeriodFormat(
      policy.conversations.retention.deleteAfter,
      "conversations.retention.deleteAfter",
    );
    if (policy.conversations.retention.archiveAfter) {
      validatePeriodFormat(
        policy.conversations.retention.archiveAfter,
        "conversations.retention.archiveAfter",
      );
    }
    if (policy.conversations.purging.deleteInactiveAfter) {
      validatePeriodFormat(
        policy.conversations.purging.deleteInactiveAfter,
        "conversations.purging.deleteInactiveAfter",
      );
    }

    // Validate mutable periods (all optional)
    if (policy.mutable.retention.defaultTTL) {
      validatePeriodFormat(
        policy.mutable.retention.defaultTTL,
        "mutable.retention.defaultTTL",
      );
    }
    if (policy.mutable.retention.purgeInactiveAfter) {
      validatePeriodFormat(
        policy.mutable.retention.purgeInactiveAfter,
        "mutable.retention.purgeInactiveAfter",
      );
    }
    if (policy.mutable.purging.deleteUnaccessedAfter) {
      validatePeriodFormat(
        policy.mutable.purging.deleteUnaccessedAfter,
        "mutable.purging.deleteUnaccessedAfter",
      );
    }

    // Validate immutable periods
    if (policy.immutable.purging.purgeUnusedAfter) {
      validatePeriodFormat(
        policy.immutable.purging.purgeUnusedAfter,
        "immutable.purging.purgeUnusedAfter",
      );
    }

    // Validate version counts
    validateVersionCount(
      policy.immutable.retention.defaultVersions,
      "immutable.retention.defaultVersions",
    );
    validateVersionCount(
      policy.vector.retention.defaultVersions,
      "vector.retention.defaultVersions",
    );

    // Validate vector importance ranges (validate if array has elements)
    if (policy.vector.retention.byImportance.length > 0) {
      validateImportanceRanges(policy.vector.retention.byImportance);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.executeWithResilience(
      () =>
        this.client.mutation(
          api.governance.setPolicy as FunctionReference<"mutation">,
          { policy },
        ),
      "governance:setPolicy",
    );
  }

  /**
   * Get current governance policy
   *
   * @param scope - Optional organization or memory space scope
   * @returns Current policy (includes org defaults + overrides)
   *
   * @example
   * ```typescript
   * // Get org-wide policy
   * const orgPolicy = await cortex.governance.getPolicy({
   *   organizationId: "org-123"
   * });
   *
   * // Get memory-space-specific policy (includes org defaults)
   * const spacePolicy = await cortex.governance.getPolicy({
   *   memorySpaceId: "audit-agent-space"
   * });
   * ```
   */
  async getPolicy(scope?: PolicyScope): Promise<GovernancePolicy> {
    // If scope provided, validate it
    if (
      scope &&
      (scope.organizationId !== undefined || scope.memorySpaceId !== undefined)
    ) {
      validatePolicyScope(scope);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.executeWithResilience(
      () =>
        this.client.query(
          api.governance.getPolicy as FunctionReference<"query">,
          { scope: scope || {} },
        ),
      "governance:getPolicy",
    );
  }

  /**
   * Override policy for specific memory space
   *
   * @param memorySpaceId - Memory space to override
   * @param overrides - Partial policy to override org defaults
   *
   * @example
   * ```typescript
   * // Audit agent needs unlimited retention
   * await cortex.governance.setAgentOverride("audit-agent", {
   *   vector: {
   *     retention: { defaultVersions: -1 } // Unlimited
   *   }
   * });
   * ```
   */
  async setAgentOverride(
    memorySpaceId: string,
    overrides: Partial<GovernancePolicy>,
  ): Promise<void> {
    // Validate memorySpaceId
    if (!memorySpaceId || memorySpaceId.trim().length === 0) {
      throw new GovernanceValidationError(
        "memorySpaceId is required and cannot be empty",
        "MISSING_SCOPE",
        "memorySpaceId",
      );
    }

    // Validate override structure (same as setPolicy but for partial)
    // Partial<GovernancePolicy> makes top-level optional, but nested structure is required
    if (overrides.conversations?.retention.deleteAfter) {
      validatePeriodFormat(
        overrides.conversations.retention.deleteAfter,
        "conversations.retention.deleteAfter",
      );
    }
    if (overrides.conversations?.retention.archiveAfter) {
      validatePeriodFormat(
        overrides.conversations.retention.archiveAfter,
        "conversations.retention.archiveAfter",
      );
    }
    if (overrides.conversations?.purging.deleteInactiveAfter) {
      validatePeriodFormat(
        overrides.conversations.purging.deleteInactiveAfter,
        "conversations.purging.deleteInactiveAfter",
      );
    }

    if (overrides.mutable?.retention.defaultTTL) {
      validatePeriodFormat(
        overrides.mutable.retention.defaultTTL,
        "mutable.retention.defaultTTL",
      );
    }
    if (overrides.mutable?.retention.purgeInactiveAfter) {
      validatePeriodFormat(
        overrides.mutable.retention.purgeInactiveAfter,
        "mutable.retention.purgeInactiveAfter",
      );
    }
    if (overrides.mutable?.purging.deleteUnaccessedAfter) {
      validatePeriodFormat(
        overrides.mutable.purging.deleteUnaccessedAfter,
        "mutable.purging.deleteUnaccessedAfter",
      );
    }

    if (overrides.immutable?.purging.purgeUnusedAfter) {
      validatePeriodFormat(
        overrides.immutable.purging.purgeUnusedAfter,
        "immutable.purging.purgeUnusedAfter",
      );
    }

    if (overrides.immutable?.retention.defaultVersions !== undefined) {
      validateVersionCount(
        overrides.immutable.retention.defaultVersions,
        "immutable.retention.defaultVersions",
      );
    }
    if (overrides.vector?.retention.defaultVersions !== undefined) {
      validateVersionCount(
        overrides.vector.retention.defaultVersions,
        "vector.retention.defaultVersions",
      );
    }

    if (overrides.vector?.retention.byImportance) {
      validateImportanceRanges(overrides.vector.retention.byImportance);
    }

    await this.executeWithResilience(
      () =>
        this.client.mutation(
          api.governance.setAgentOverride as FunctionReference<"mutation">,
          { memorySpaceId, overrides },
        ),
      "governance:setAgentOverride",
    );
  }

  /**
   * Get compliance template (GDPR, HIPAA, SOC2, FINRA)
   *
   * @param template - Template name
   * @returns Pre-configured policy for compliance standard
   *
   * @example
   * ```typescript
   * const gdprPolicy = await cortex.governance.getTemplate("GDPR");
   * await cortex.governance.setPolicy({
   *   organizationId: "org-123",
   *   ...gdprPolicy
   * });
   * ```
   */
  async getTemplate(template: ComplianceTemplate): Promise<GovernancePolicy> {
    // TypeScript enforces this, but add runtime check
    validateComplianceTemplate(template);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.executeWithResilience(
      () =>
        this.client.query(
          api.governance.getTemplate as FunctionReference<"query">,
          { template },
        ),
      "governance:getTemplate",
    );
  }

  /**
   * Manually enforce governance policy
   *
   * Triggers immediate policy enforcement across specified layers and rules.
   * Normally enforcement is automatic, but this allows manual triggering.
   *
   * @param options - Enforcement options (layers, rules)
   * @returns Enforcement result with counts
   *
   * @example
   * ```typescript
   * const result = await cortex.governance.enforce({
   *   layers: ["vector", "immutable"],
   *   rules: ["retention", "purging"]
   * });
   * console.log(`Deleted ${result.versionsDeleted} versions`);
   * ```
   */
  async enforce(options: EnforcementOptions): Promise<EnforcementResult> {
    // Validate enforcement options
    validateEnforcementOptions(options);

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await this.executeWithResilience(
        () =>
          this.client.mutation(
            api.governance.enforce as FunctionReference<"mutation">,
            { options },
          ),
        "governance:enforce",
      );
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Simulate policy impact without applying
   *
   * Previews what would happen if a policy were applied, without actually
   * applying it. Useful for testing policy changes before committing.
   *
   * @param options - Simulation options (policy to test)
   * @returns Simulation result with impact analysis
   *
   * @example
   * ```typescript
   * const impact = await cortex.governance.simulate({
   *   organizationId: "org-123",
   *   vector: {
   *     retention: {
   *       byImportance: [{ range: [0, 30], versions: 1 }]
   *     }
   *   }
   * });
   * console.log(`Would delete ${impact.versionsAffected} versions`);
   * console.log(`Would save ${impact.storageFreed} MB`);
   * console.log(`Estimated savings: $${impact.costSavings}/month`);
   * ```
   */
  async simulate(options: SimulationOptions): Promise<SimulationResult> {
    // Validate partial policy structure (same validations as setPolicy)
    // SimulationOptions extends Partial<GovernancePolicy>: top-level optional, nested required
    if (options.conversations?.retention.deleteAfter) {
      validatePeriodFormat(
        options.conversations.retention.deleteAfter,
        "conversations.retention.deleteAfter",
      );
    }
    if (options.conversations?.retention.archiveAfter) {
      validatePeriodFormat(
        options.conversations.retention.archiveAfter,
        "conversations.retention.archiveAfter",
      );
    }
    if (options.conversations?.purging.deleteInactiveAfter) {
      validatePeriodFormat(
        options.conversations.purging.deleteInactiveAfter,
        "conversations.purging.deleteInactiveAfter",
      );
    }

    if (options.mutable?.retention.defaultTTL) {
      validatePeriodFormat(
        options.mutable.retention.defaultTTL,
        "mutable.retention.defaultTTL",
      );
    }
    if (options.mutable?.retention.purgeInactiveAfter) {
      validatePeriodFormat(
        options.mutable.retention.purgeInactiveAfter,
        "mutable.retention.purgeInactiveAfter",
      );
    }
    if (options.mutable?.purging.deleteUnaccessedAfter) {
      validatePeriodFormat(
        options.mutable.purging.deleteUnaccessedAfter,
        "mutable.purging.deleteUnaccessedAfter",
      );
    }

    if (options.immutable?.purging.purgeUnusedAfter) {
      validatePeriodFormat(
        options.immutable.purging.purgeUnusedAfter,
        "immutable.purging.purgeUnusedAfter",
      );
    }

    if (options.immutable?.retention.defaultVersions !== undefined) {
      validateVersionCount(
        options.immutable.retention.defaultVersions,
        "immutable.retention.defaultVersions",
      );
    }
    if (options.vector?.retention.defaultVersions !== undefined) {
      validateVersionCount(
        options.vector.retention.defaultVersions,
        "vector.retention.defaultVersions",
      );
    }

    if (options.vector?.retention.byImportance) {
      validateImportanceRanges(options.vector.retention.byImportance);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.executeWithResilience(
      () =>
        this.client.query(
          api.governance.simulate as FunctionReference<"query">,
          { options },
        ),
      "governance:simulate",
    );
  }

  /**
   * Generate compliance report
   *
   * Creates a detailed compliance report showing policy adherence,
   * data retention status, and user request fulfillment.
   *
   * @param options - Report options (org, period)
   * @returns Compliance report
   *
   * @example
   * ```typescript
   * const report = await cortex.governance.getComplianceReport({
   *   organizationId: "org-123",
   *   period: {
   *     start: new Date("2025-01-01"),
   *     end: new Date("2025-10-31")
   *   }
   * });
   * console.log(`Status: ${report.conversations.complianceStatus}`);
   * ```
   */
  async getComplianceReport(
    options: ComplianceReportOptions,
  ): Promise<ComplianceReport> {
    // Validate date range
    validateDateRange(options.period.start, options.period.end);

    // Validate scope if provided
    if (options.organizationId || options.memorySpaceId) {
      validatePolicyScope({
        organizationId: options.organizationId,
        memorySpaceId: options.memorySpaceId,
      });
    }

    // Convert dates to timestamps for Convex
    const convexOptions = {
      organizationId: options.organizationId,
      memorySpaceId: options.memorySpaceId,
      period: {
        start: options.period.start.getTime(),
        end: options.period.end.getTime(),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.executeWithResilience(
      () =>
        this.client.query(
          api.governance.getComplianceReport as FunctionReference<"query">,
          { options: convexOptions },
        ),
      "governance:getComplianceReport",
    );
  }

  /**
   * Get enforcement statistics
   *
   * Returns statistics about policy enforcement over a time period.
   * Shows what has been purged, storage freed, and cost savings.
   *
   * @param options - Stats options (period)
   * @returns Enforcement statistics
   *
   * @example
   * ```typescript
   * const stats = await cortex.governance.getEnforcementStats({
   *   period: "30d"
   * });
   * console.log(`Vector versions deleted: ${stats.vector.versionsDeleted}`);
   * console.log(`Storage freed: ${stats.storageFreed} MB`);
   * console.log(`Cost savings: $${stats.costSavings}`);
   * ```
   */
  async getEnforcementStats(
    options: EnforcementStatsOptions,
  ): Promise<EnforcementStats> {
    // Validate period format
    validateStatsPeriod(options.period);

    // Validate scope if provided
    if (options.organizationId || options.memorySpaceId) {
      validatePolicyScope({
        organizationId: options.organizationId,
        memorySpaceId: options.memorySpaceId,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.executeWithResilience(
      () =>
        this.client.query(
          api.governance.getEnforcementStats as FunctionReference<"query">,
          { options },
        ),
      "governance:getEnforcementStats",
    );
  }
}

// Export validation error for users who want to catch it specifically
export { GovernanceValidationError } from "./validators";
