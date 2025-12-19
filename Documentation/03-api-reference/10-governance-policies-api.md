# Governance Policies API

> **Last Updated**: 2025-10-28

Complete API reference for configuring retention, purging, and governance rules across all Cortex layers.

## Overview

The Governance Policies API provides centralized control over data retention, purging, and compliance rules across all Cortex storage layers.

**Governs:**

- **Layer 1a** (Conversations) - Private conversation retention
- **Layer 1b** (Immutable) - Shared immutable data versioning
- **Layer 1c** (Mutable) - Shared mutable data lifecycle
- **Layer 2** (Vector) - Vector memory versioning
- **Layer 3** (Memory API) - Convenience layer policies

**Key Features:**

- Per-layer retention rules
- Per-type/importance rules
- Automatic enforcement
- Compliance templates (GDPR, HIPAA, SOC2)
- Organization-wide or per-agent
- Dry-run mode for testing

---

## Policy Structure

### Complete Governance Policy

```typescript
interface GovernancePolicy {
  organizationId?: string;            // Optional: org-wide policy
  memorySpaceId?: string;             // Optional: memory-space-specific override

  // Layer 1a: Conversations
  conversations: {
    retention: {
      deleteAfter: string;            // '7y', '30d', etc.
      archiveAfter?: string;          // Move to cold storage
      purgeOnUserRequest: boolean;    // GDPR compliance
    };
    purging: {
      autoDelete: boolean;
      deleteInactiveAfter?: string;   // '1y', '90d'
    };
  };

  // Layer 1b: Immutable
  immutable: {
    retention: {
      defaultVersions: number;        // Default versions to keep
      byType: Record<string, {
        versionsToKeep: number;       // -1 = unlimited
        deleteAfter?: string;
      }>;
    };
    purging: {
      autoCleanupVersions: boolean;
      purgeUnusedAfter?: string;
    };
  };

  // Layer 1c: Mutable
  mutable: {
    retention: {
      defaultTTL?: string;            // null = no expiration
      purgeInactiveAfter?: string;
    };
    purging: {
      autoDelete: boolean;
      deleteUnaccessedAfter?: string;
    };
  };

  // Layer 2: Vector
  vector: {
    retention: {
      defaultVersions: number;        // Per memory
      byImportance: Array<{
        range: [number, number];      // [min, max] importance
        versions: number;
      }>;
      bySourceType?: Record<string, number>;
    };
    purging: {
      autoCleanupVersions: boolean;
      deleteOrphaned: boolean;        // No conversationRef/immutableRef
    };
  };

  // Cross-layer rules
  compliance: {
    mode: 'GDPR' | 'HIPAA' | 'SOC2' | 'FINRA' | 'Custom';
    dataRetentionYears: number;
    requireJustification: number[];   // Importance levels needing justification
    auditLogging: boolean;
  };
}
```

---

## Core Operations

### setPolicy()

Set governance policy for organization or agent.

**Signature:**

```typescript
cortex.governance.setPolicy(
  policy: GovernancePolicy
): Promise<PolicyResult>
```

**Example:**

```typescript
// Organization-wide policy
await cortex.governance.setPolicy({
  organizationId: "org-123",

  conversations: {
    retention: {
      deleteAfter: "7y", // GDPR compliance
      archiveAfter: "1y",
      purgeOnUserRequest: true,
    },
    purging: {
      autoDelete: true,
      deleteInactiveAfter: "2y",
    },
  },

  immutable: {
    retention: {
      defaultVersions: 20,
      byType: {
        "audit-log": { versionsToKeep: -1 }, // Unlimited
        "kb-article": { versionsToKeep: 50 },
        policy: { versionsToKeep: -1 }, // Unlimited
        "agent-reasoning": { versionsToKeep: 10 },
      },
    },
    purging: {
      autoCleanupVersions: true,
    },
  },

  mutable: {
    retention: {
      defaultTTL: null, // No expiration
      purgeInactiveAfter: "2y",
    },
    purging: {
      autoDelete: false,
    },
  },

  vector: {
    retention: {
      defaultVersions: 10,
      byImportance: [
        { range: [0, 20], versions: 1 }, // Trivial: current only
        { range: [21, 40], versions: 3 }, // Low: 3 versions
        { range: [41, 70], versions: 10 }, // Medium: 10 versions
        { range: [71, 89], versions: 20 }, // High: 20 versions
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
      deleteOrphaned: false, // Keep even if refs broken
    },
  },

  compliance: {
    mode: "GDPR",
    dataRetentionYears: 7,
    requireJustification: [90, 100], // Critical data needs reason
    auditLogging: true,
  },
});
```

---

### getPolicy()

Get current governance policy.

**Signature:**

```typescript
cortex.governance.getPolicy(
  scope?: {
    organizationId?: string;
    memorySpaceId?: string;
  }
): Promise<GovernancePolicy>
```

**Example:**

```typescript
// Get org-wide policy
const orgPolicy = await cortex.governance.getPolicy({
  organizationId: "org-123",
});

// Get agent-specific policy (includes org defaults + overrides)
const agentPolicy = await cortex.governance.getPolicy({
  memorySpaceId: "audit-agent-space",
});

console.log(
  `Vector retention for agent: ${agentPolicy.vector.retention.defaultVersions}`,
);
```

---

### setAgentOverride()

Override policy for specific agent.

**Signature:**

```typescript
cortex.governance.setAgentOverride(
  memorySpaceId: string,
  overrides: Partial<GovernancePolicy>
): Promise<void>
```

**Example:**

```typescript
// Audit agent needs unlimited retention
await cortex.governance.setAgentOverride("audit-agent", {
  vector: {
    retention: {
      defaultVersions: -1, // Unlimited
      byImportance: [
        { range: [0, 100], versions: -1 }, // All versions forever
      ],
    },
  },
  immutable: {
    retention: {
      defaultVersions: -1, // Unlimited
    },
  },
});

// Temp agent needs minimal retention
await cortex.governance.setAgentOverride("temp-agent", {
  vector: {
    retention: {
      defaultVersions: 1, // Current only
    },
  },
  conversations: {
    retention: {
      deleteAfter: "7d", // Delete after 7 days
    },
  },
});
```

---

## Compliance Templates

### GDPR Template

```typescript
const gdprPolicy = await cortex.governance.getTemplate("GDPR");

// Applies:
// - 7-year conversation retention
// - Right to be forgotten
// - Data portability
// - Audit logging
// - Justification for critical data

await cortex.governance.setPolicy({
  organizationId: "org-123",
  ...gdprPolicy,
});
```

### HIPAA Template

```typescript
const hipaaPolicy = await cortex.governance.getTemplate("HIPAA");

// Applies:
// - 6-year retention minimum
// - Unlimited audit logs
// - No auto-deletion
// - Strict access logging
// - Enhanced purge controls

await cortex.governance.setPolicy({
  organizationId: "healthcare-org",
  ...hipaaPolicy,
});
```

### SOC2 Template

```typescript
const soc2Policy = await cortex.governance.getTemplate("SOC2");

// Applies:
// - 7-year audit retention
// - Comprehensive logging
// - Version tracking
// - Access controls
// - Purge auditing
```

---

## Enforcement

### Automatic Enforcement

```typescript
// Policy is enforced automatically

// Example: Vector with importance-based retention
await cortex.vector.store('agent-1', {
  content: 'Trivial log message',
  metadata: { importance: 5 }  // 0-20 range
});

// Policy says: 0-20 = keep 1 version
// After first update, v1 is automatically purged
await cortex.vector.update('agent-1', memoryId, {...});
// v1 deleted automatically, only v2 kept
```

### Manual Enforcement

**Signature:**

```typescript
cortex.governance.enforce(
  options: {
    scope: { organizationId?: string; memorySpaceId?: string }; // Required
    layers?: ("conversations" | "immutable" | "mutable" | "vector")[];
    rules?: ("retention" | "purging")[];
  }
): Promise<EnforcementResult>
```

**Example:**

```typescript
// Trigger immediate policy enforcement
const result = await cortex.governance.enforce({
  scope: { organizationId: "org-123" }, // Required: org or memory space
  layers: ["vector", "immutable"],       // Which layers
  rules: ["retention", "purging"],       // Which rules
});

console.log(`Enforced retention: ${result.versionsDeleted} versions deleted`);
console.log(`Purged records: ${result.recordsPurged}`);
console.log(`Storage freed: ${result.storageFreed} MB`);

// Enforce for specific memory space
const spaceResult = await cortex.governance.enforce({
  scope: { memorySpaceId: "audit-agent-space" },
  layers: ["vector"],
  rules: ["retention"],
});
```

---

## Policy Simulation

### Test Policy Impact

```typescript
// Simulate policy without applying
const impact = await cortex.governance.simulate({
  organizationId: 'org-123',
  vector: {
    retention: {
      byImportance: [
        { range: [0, 30], versions: 1 }  // More aggressive
      ]
    }
  }
});

console.log('Impact analysis:');
console.log(`Would delete ${impact.versionsAffected} Vector versions`);
console.log(`Would save ${impact.storageFreed} MB`);
console.log(`Estimated monthly savings: $${impact.costSavings}`);

// If acceptable, apply
if (impact.costSavings > 50) {
  await cortex.governance.setPolicy({...});
}
```

---

## Reporting

### Compliance Report

```typescript
// Generate compliance report
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
//   dataRetention: {
//     oldestRecord: new Date('2018-01-01'),
//     withinPolicy: true
//   },
//   userRequests: {
//     deletionRequests: 5,
//     fulfilled: 5,
//     avgFulfillmentTime: '2.3 hours'
//   }
// }
```

---

## Best Practices

### 1. Start with Template

```typescript
// Use compliance template as base
const basePolicy = await cortex.governance.getTemplate("GDPR");

// Customize as needed
await cortex.governance.setPolicy({
  organizationId: "org-123",
  ...basePolicy,
  vector: {
    ...basePolicy.vector,
    retention: {
      ...basePolicy.vector.retention,
      defaultVersions: 15, // Override default
    },
  },
});
```

### 2. Test Before Applying

```typescript
// Always simulate first
const impact = await cortex.governance.simulate(newPolicy);

if (impact.versionsAffected > 1000) {
  console.warn("Policy would delete significant data - review carefully");
}
```

### 3. Agent-Specific Overrides Sparingly

```typescript
// Most agents use org policy
// Only override for special cases

await cortex.governance.setAgentOverride("audit-agent", {
  // Unlimited retention for audit agent
  vector: { retention: { defaultVersions: -1 } },
});

await cortex.governance.setAgentOverride("temp-agent", {
  // Minimal retention for temporary agent
  vector: { retention: { defaultVersions: 1 } },
  conversations: { retention: { deleteAfter: "7d" } },
});
```

### 4. Monitor Enforcement

```typescript
// Track what's being purged
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

---

## Summary

**Governance Policies provide:**

- ✅ Centralized retention rules
- ✅ Per-layer configuration
- ✅ Compliance templates (GDPR, HIPAA, SOC2)
- ✅ Automatic enforcement
- ✅ Cost optimization
- ✅ Audit trail

**Configuration Hierarchy:**

1. Global defaults (Cortex defaults)
2. Compliance template (GDPR, HIPAA, etc.)
3. Organization policy
4. Agent-specific overrides

**Enterprise Value:**

- Automatic compliance
- Cost control at scale
- No manual retention management
- Built-in audit trails

---

## Next Steps

- **[Immutable Store API](./07-immutable-store-api.md)** - Versioned shared data
- **[Mutable Store API](./08-mutable-store-api.md)** - Live shared data
- **[Memory Operations API](./02-memory-operations.md)** - Vector layer
- **[Conversation Operations API](./03-conversation-operations.md)** - Private conversations

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
