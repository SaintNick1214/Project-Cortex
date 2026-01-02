# Governance Policies

> **Last Updated**: 2026-01-01

Centralized control over data retention, purging, and compliance rules across all Cortex storage layers.

## Overview

Cortex provides built-in governance through the `cortex.governance.*` API. This enables enterprise-grade data lifecycle management with compliance templates for GDPR, HIPAA, SOC2, and FINRA.

**Why Governance Matters:**

- **Compliance**: Meet regulatory requirements with pre-built templates
- **Cost Control**: Automatically manage data retention to optimize storage costs
- **Audit Trail**: Track what's retained, purged, and why
- **Centralized Policy**: One place to define rules for all storage layers

**Governs All Layers:**

- **Layer 1a** (Conversations) - Retention and archival
- **Layer 1b** (Immutable) - Version limits and cleanup
- **Layer 1c** (Mutable) - TTL and lifecycle
- **Layer 2** (Vector) - Importance-based versioning
- **Sessions** - Lifecycle timeouts and limits

## Quick Start

```typescript
import { Cortex } from "@cortex-platform/sdk";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});

// Use a compliance template
const gdprPolicy = await cortex.governance.getTemplate("GDPR");

// Apply organization-wide policy
await cortex.governance.setPolicy({
  organizationId: "org-123",
  ...gdprPolicy,
});

// Enforce policy manually
await cortex.governance.enforce({
  scope: { organizationId: "org-123" },
  layers: ["vector", "conversations"],
  rules: ["retention", "purging"],
});
```

## Compliance Templates

Pre-built templates make compliance setup straightforward:

### GDPR Template

```typescript
const gdprPolicy = await cortex.governance.getTemplate("GDPR");

// Provides:
// - 7-year conversation retention
// - Right to be forgotten (purgeOnUserRequest: true)
// - Data portability support
// - Audit logging enabled
// - Justification for critical data
```

### HIPAA Template

```typescript
const hipaaPolicy = await cortex.governance.getTemplate("HIPAA");

// Provides:
// - 6-year retention minimum
// - Unlimited audit logs
// - No auto-deletion
// - Strict access logging
// - Enhanced purge controls
```

### SOC2 Template

```typescript
const soc2Policy = await cortex.governance.getTemplate("SOC2");

// Provides:
// - 7-year audit retention
// - Comprehensive logging
// - Version tracking
// - Access controls
// - Purge auditing
```

### FINRA Template

```typescript
const finraPolicy = await cortex.governance.getTemplate("FINRA");

// Provides:
// - 7-year mandatory retention (no early deletion)
// - Unlimited versions for financial records
// - No purgeOnUserRequest (regulatory override)
// - No auto-deletion
// - All importance levels require justification
```

> **Note:** FINRA regulations require retention even when users request deletion. The template enforces regulatory compliance over individual requests.

## Policy Configuration

### Organization-Wide Policy

```typescript
await cortex.governance.setPolicy({
  organizationId: "org-123",
  
  // Conversation retention
  conversations: {
    retention: {
      deleteAfter: "7y",         // Keep for 7 years
      archiveAfter: "1y",        // Move to cold storage after 1 year
      purgeOnUserRequest: true,  // GDPR right to deletion
    },
    purging: {
      autoDelete: true,
      deleteInactiveAfter: "2y",
    },
  },
  
  // Immutable store versions
  immutable: {
    retention: {
      defaultVersions: 20,
      byType: {
        "audit-log": { versionsToKeep: -1 },     // Unlimited
        "kb-article": { versionsToKeep: 50 },
        "policy": { versionsToKeep: -1 },        // Unlimited
        "agent-reasoning": { versionsToKeep: 10 },
      },
    },
    purging: {
      autoCleanupVersions: true,
    },
  },
  
  // Mutable store lifecycle
  mutable: {
    retention: {
      defaultTTL: null,            // No expiration by default
      purgeInactiveAfter: "2y",
    },
    purging: {
      autoDelete: false,
    },
  },
  
  // Vector memory versioning
  vector: {
    retention: {
      defaultVersions: 10,
      byImportance: [
        { range: [0, 20], versions: 1 },    // Trivial: current only
        { range: [21, 40], versions: 3 },   // Low: 3 versions
        { range: [41, 70], versions: 10 },  // Medium: 10 versions
        { range: [71, 89], versions: 20 },  // High: 20 versions
        { range: [90, 100], versions: 30 }, // Critical: 30 versions
      ],
      bySourceType: {
        conversation: 10,
        a2a: 15,
        system: 5,
        tool: 3,
      },
    },
    purging: {
      autoCleanupVersions: true,
      deleteOrphaned: false,  // Keep even if references broken
    },
  },
  
  // Compliance settings
  compliance: {
    mode: "GDPR",
    dataRetentionYears: 7,
    requireJustification: [90, 100],  // Critical data needs reason
    auditLogging: true,
  },
});
```

### Memory Space Overrides

Override organization policy for specific memory spaces:

```typescript
// Audit agent needs unlimited retention
await cortex.governance.setAgentOverride("audit-agent-space", {
  vector: {
    retention: {
      defaultVersions: -1,  // Unlimited
      byImportance: [
        { range: [0, 100], versions: -1 },  // All forever
      ],
    },
  },
  immutable: {
    retention: {
      defaultVersions: -1,  // Unlimited
    },
  },
});

// Temporary agent needs minimal retention
await cortex.governance.setAgentOverride("temp-agent-space", {
  vector: {
    retention: {
      defaultVersions: 1,  // Current only
    },
  },
  conversations: {
    retention: {
      deleteAfter: "7d",  // Delete after 7 days
    },
  },
});
```

## Session Policies

Configure session lifecycle and limits:

```typescript
await cortex.governance.setPolicy({
  organizationId: "org-123",
  // ... other policy fields ...
  
  sessions: {
    lifecycle: {
      idleTimeout: "30m",       // Inactivity timeout
      maxDuration: "24h",       // Maximum session lifetime
      autoExtend: true,         // Extend on activity
      warnBeforeExpiry: "5m",   // Warning before expiry
    },
    cleanup: {
      autoExpireIdle: true,     // Auto-expire idle sessions
      deleteEndedAfter: "30d",  // Delete ended sessions after 30 days
      archiveAfter: "7d",       // Archive before deletion
    },
    limits: {
      maxActiveSessions: 5,     // Max concurrent sessions per user
      maxSessionsPerDevice: 3,  // Max per device type
    },
  },
});
```

See [Sessions Management](./14-sessions-management.md) for how these policies are enforced.

## Policy Enforcement

### Manual Enforcement

Trigger policy enforcement manually:

```typescript
const result = await cortex.governance.enforce({
  scope: { organizationId: "org-123" },
  layers: ["vector", "immutable"],
  rules: ["retention", "purging"],
});

console.log(`Versions deleted: ${result.versionsDeleted}`);
console.log(`Records purged: ${result.recordsPurged}`);
console.log(`Storage freed: ${result.storageFreed} MB`);
```

### Enforcement for Specific Space

```typescript
const result = await cortex.governance.enforce({
  scope: { memorySpaceId: "audit-agent-space" },
  layers: ["vector"],
  rules: ["retention"],
});
```

> **Note:** Automatic enforcement on every storage operation is planned for a future release. Currently, use manual `enforce()` calls or scheduled jobs.

## Policy Simulation

Test policy impact before applying:

```typescript
const impact = await cortex.governance.simulate({
  organizationId: "org-123",
  vector: {
    retention: {
      byImportance: [
        { range: [0, 30], versions: 1 },  // More aggressive
      ],
    },
  },
});

console.log("Impact analysis:");
console.log(`Would delete ${impact.versionsAffected} Vector versions`);
console.log(`Would save ${impact.storageFreed} MB`);
console.log(`Estimated monthly savings: $${impact.costSavings}`);

// Apply only if acceptable
if (impact.costSavings > 50) {
  await cortex.governance.setPolicy({ ... });
}
```

## Compliance Reporting

Generate compliance reports:

```typescript
const report = await cortex.governance.getComplianceReport({
  organizationId: "org-123",
  period: {
    start: new Date("2025-01-01"),
    end: new Date("2025-10-31"),
  },
});

console.log(report);
// {
//   conversations: {
//     total: 5432,
//     deleted: 123,
//     archived: 1200,
//     complianceStatus: 'COMPLIANT'
//   },
//   immutable: {
//     entities: 234,
//     totalVersions: 1543,
//     versionsDeleted: 300,
//     complianceStatus: 'COMPLIANT'
//   },
//   vector: {
//     memories: 15432,
//     versionsDeleted: 5000,
//     orphanedCleaned: 45,
//     complianceStatus: 'COMPLIANT'
//   },
//   userRequests: {
//     deletionRequests: 5,
//     fulfilled: 5,
//     avgFulfillmentTime: '2.3 hours'
//   }
// }
```

### Enforcement Statistics

Track what's being purged over time:

```typescript
const stats = await cortex.governance.getEnforcementStats({
  period: "30d",
});

console.log(`Last 30 days:`);
console.log(`- Vector versions deleted: ${stats.vector.versionsDeleted}`);
console.log(`- Immutable versions deleted: ${stats.immutable.versionsDeleted}`);
console.log(`- Conversations purged: ${stats.conversations.purged}`);
console.log(`- Storage freed: ${stats.storageFreed} MB`);
console.log(`- Cost savings: $${stats.costSavings}`);
```

## Real-World Patterns

### Start with Template, Customize

```typescript
// Use compliance template as base
const basePolicy = await cortex.governance.getTemplate("GDPR");

// Customize specific settings
await cortex.governance.setPolicy({
  organizationId: "org-123",
  ...basePolicy,
  vector: {
    ...basePolicy.vector,
    retention: {
      ...basePolicy.vector.retention,
      defaultVersions: 15,  // Override default
    },
  },
});
```

### Scheduled Enforcement

```typescript
// Run daily enforcement job
async function dailyGovernanceEnforcement() {
  const result = await cortex.governance.enforce({
    scope: { organizationId: "org-123" },
    layers: ["vector", "conversations", "immutable"],
    rules: ["retention", "purging"],
  });
  
  // Log for audit trail
  console.log(`[${new Date().toISOString()}] Governance enforcement completed`);
  console.log(`  Versions deleted: ${result.versionsDeleted}`);
  console.log(`  Storage freed: ${result.storageFreed} MB`);
}
```

### Multi-Tier Policy Strategy

```typescript
// Tier 1: Organization defaults (GDPR)
await cortex.governance.setPolicy({
  organizationId: "org-123",
  ...await cortex.governance.getTemplate("GDPR"),
});

// Tier 2: Department overrides
await cortex.governance.setAgentOverride("legal-dept-space", {
  conversations: {
    retention: {
      deleteAfter: "10y",  // Legal needs longer retention
    },
  },
});

// Tier 3: Temporary projects
await cortex.governance.setAgentOverride("poc-project-space", {
  vector: {
    retention: { defaultVersions: 1 },  // Minimal
  },
  conversations: {
    retention: { deleteAfter: "30d" },  // Short-lived
  },
});
```

## Configuration Hierarchy

Policies are applied in order of specificity:

1. **Global defaults** (Cortex built-in)
2. **Compliance template** (GDPR, HIPAA, etc.)
3. **Organization policy** (setPolicy)
4. **Memory space overrides** (setAgentOverride)

More specific policies override less specific ones for the same settings.

## Error Handling

```typescript
import { GovernanceValidationError } from "@cortex-platform/sdk";

try {
  await cortex.governance.setPolicy({
    organizationId: "org-123",
    conversations: {
      retention: { deleteAfter: "invalid" },  // Bad format
      purging: { autoDelete: true },
    },
  });
} catch (error) {
  if (error instanceof GovernanceValidationError) {
    console.error(`Validation failed: ${error.message}`);
    console.error(`Error code: ${error.code}`);
    console.error(`Field: ${error.field}`);
    
    switch (error.code) {
      case "INVALID_PERIOD_FORMAT":
        console.error('Period must be like "7d", "30d", "1y"');
        break;
      case "MISSING_SCOPE":
        console.error("Provide organizationId or memorySpaceId");
        break;
    }
  }
}
```

**Common Error Codes:**

| Code | Description |
|------|-------------|
| `MISSING_SCOPE` | organizationId or memorySpaceId required |
| `INVALID_PERIOD_FORMAT` | Period must be "7d", "30d", "1y", etc. |
| `INVALID_IMPORTANCE_RANGE` | Range must be 0-100, min < max |
| `OVERLAPPING_IMPORTANCE_RANGES` | Ranges cannot overlap |
| `INVALID_VERSIONS` | Version count must be >= -1 |

## Summary

**Governance Policies provide:**

- ✅ Centralized retention rules across all layers
- ✅ Pre-built compliance templates (GDPR, HIPAA, SOC2, FINRA)
- ✅ Importance-based version management
- ✅ Policy simulation before applying
- ✅ Compliance reporting and audit trails
- ✅ Memory space-specific overrides
- ⏳ Automatic enforcement *(planned)*

## Related Features

- **[Sessions Management](./14-sessions-management.md)** - Session lifecycle policies
- **[Memory Spaces](./01-memory-spaces.md)** - Space-specific policy overrides
- **[User Profiles](./03-user-profiles.md)** - GDPR cascade deletion
- **[Fact Integration](./11-fact-integration.md)** - Facts layer retention
