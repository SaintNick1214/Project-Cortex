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

export class GovernanceAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly _graphAdapter?: unknown,
  ) {}

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.client.mutation(
      api.governance.setPolicy as FunctionReference<"mutation">,
      { policy },
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.client.query(
      api.governance.getPolicy as FunctionReference<"query">,
      { scope: scope || {} },
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
    await this.client.mutation(
      api.governance.setAgentOverride as FunctionReference<"mutation">,
      { memorySpaceId, overrides },
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.client.query(
      api.governance.getTemplate as FunctionReference<"query">,
      { template },
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.client.mutation(
      api.governance.enforce as FunctionReference<"mutation">,
      { options },
    );
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.client.query(
      api.governance.simulate as FunctionReference<"query">,
      { options },
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
    return await this.client.query(
      api.governance.getComplianceReport as FunctionReference<"query">,
      { options: convexOptions },
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.client.query(
      api.governance.getEnforcementStats as FunctionReference<"query">,
      { options },
    );
  }
}
