# User Profiles

> **Last Updated**: 2025-10-23

Rich user context and preferences that persist across all agents and conversations.

## Overview

User profiles provide a central place to store information about users that should be accessible across all agents. Instead of each agent remembering "user prefers dark mode" separately, it's stored once in the user profile and available everywhere.

## Core Concept

**The Three Data Layers:**
- **ACID Conversations** - Complete message history (immutable, forever)
- **Vector Memories** - Searchable knowledge index (versioned, retention rules)
- **User Profiles** - Shared user attributes (versioned, no retention limits)

```typescript
// ACID Conversation (immutable source)
await cortex.conversations.addMessage('conv-456', {
  role: 'user',
  text: 'I love pizza',
  userId: 'user-123'
});

// Vector Memory (agent-specific knowledge)
await cortex.memory.store('agent-1', {
  content: 'Had a good conversation with user about pizza',
  contentType: 'summarized',
  conversationRef: { conversationId: 'conv-456', messageIds: ['msg-045'] }
});

// User Profile (shared across all agents)
await cortex.users.update('user-123', {
  preferences: { favoriteFood: 'pizza' }
});
```

**Key Distinction:**
- **Agent Memory**: Private to agent, references ACID conversations
- **User Profile**: Shared across agents, no conversation references
- **ACID Conversations**: Immutable source that memories can reference

## User Profile Structure

```typescript
interface UserProfile {
  // Identity
  id: string;                    // Unique user ID
  displayName: string;           // How to address the user
  email?: string;                // Contact email
  
  // Preferences
  preferences: {
    theme?: 'light' | 'dark';
    language?: string;           // 'en', 'es', 'fr', etc.
    timezone?: string;           // 'America/New_York', etc.
    communicationStyle?: 'formal' | 'casual' | 'friendly';
    notifications?: boolean;
    [key: string]: any;          // Custom preferences
  };
  
  // Metadata
  metadata: {
    tier?: 'free' | 'pro' | 'enterprise';
    signupDate?: Date;
    lastSeen?: Date;
    company?: string;
    department?: string;
    [key: string]: any;          // Custom metadata
  };
  
  // System fields (auto-managed)
  createdAt: Date;               // When profile created
  updatedAt: Date;               // Last modification
  version: number;               // Profile version
  previousVersions?: ProfileVersion[];  // Version history
}

interface ProfileVersion {
  version: number;
  displayName?: string;
  email?: string;
  preferences: any;
  metadata: any;
  timestamp: Date;               // When this version was created
  updatedBy?: string;            // What triggered the update
}
```

> **Automatic Versioning**: Like memories, user profiles automatically preserve previous versions when updated. Track how user preferences change over time.

## Basic Operations

### Creating a Profile

```typescript
// Create or update user profile
await cortex.users.update('user-123', {
  displayName: 'Alex Johnson',
  email: 'alex@example.com',
  preferences: {
    theme: 'dark',
    language: 'en',
    timezone: 'America/Los_Angeles',
    communicationStyle: 'friendly'
  },
  metadata: {
    tier: 'pro',
    signupDate: new Date(),
    company: 'Acme Corp'
  }
});
```

### Retrieving a Profile

```typescript
// Get user profile
const user = await cortex.users.get('user-123');

console.log(user.displayName); // "Alex Johnson"
console.log(user.preferences.theme); // "dark"
console.log(user.metadata.tier); // "pro"
```

### Updating Profiles

Updates automatically preserve previous versions:

```typescript
// Original profile
await cortex.users.update('user-123', {
  displayName: 'Alex',
  preferences: {
    theme: 'dark',
    language: 'en'
  }
});

// Update theme (creates v2, preserves v1)
await cortex.users.update('user-123', {
  preferences: {
    theme: 'light'  // Only updates theme, keeps other preferences
  }
});

// Get current with history
const user = await cortex.users.get('user-123');
console.log(user.version); // 2
console.log(user.preferences.theme); // 'light'
console.log(user.previousVersions[0].preferences.theme); // 'dark'

// Update last seen (doesn't create new version for metadata-only updates)
await cortex.users.update('user-123', {
  metadata: {
    lastSeen: new Date()
  }
}, {
  skipVersioning: true  // Don't version metadata-only updates
});
```

### Deleting Profiles

```typescript
// Delete user profile only
await cortex.users.delete('user-123');

// Delete with cascade (also delete user's data in all agent memories)
const result = await cortex.users.delete('user-123', { 
  cascade: true  // Delete from all agents
});

console.log(result);
// {
//   profileDeleted: true,
//   memoriesDeleted: 145,
//   agentsAffected: ['agent-1', 'agent-2', 'agent-3'],
//   deletedAt: Date
// }

// GDPR-compliant deletion with audit trail
async function handleGDPRDeletion(userId: string, requestedBy: string) {
  // Log the request
  await auditLog.record({
    action: 'gdpr-deletion-request',
    userId,
    requestedBy,
    timestamp: new Date()
  });
  
  // Delete everything
  const result = await cortex.users.delete(userId, { 
    cascade: true,
    auditReason: 'GDPR right to be forgotten request'
  });
  
  // Log completion
  await auditLog.record({
    action: 'gdpr-deletion-complete',
    userId,
    ...result
  });
  
  return result;
}
```

## Using Profiles with Agents

### Access User Preferences

```typescript
async function respondToUser(agentId: string, userId: string, message: string) {
  // Get user profile
  const user = await cortex.users.get(userId);
  
  if (!user) {
    // Create default profile on first interaction
    await cortex.users.update(userId, {
      displayName: userId,  // Temporary
      preferences: {
        language: detectLanguage(message),
        timezone: 'UTC'
      },
      metadata: {
        tier: 'free',
        signupDate: new Date(),
        firstMessage: message
      }
    });
    
    user = await cortex.users.get(userId);
  }
  
  // Adapt response based on preferences
  let response = await generateResponse(message);
  
  // Apply communication style
  if (user.preferences.communicationStyle === 'formal') {
    response = makeFormal(response);
  }
  
  // Localize if needed
  if (user.preferences.language !== 'en') {
    response = await translate(response, user.preferences.language);
  }
  
  // Update last seen
  await cortex.users.update(userId, {
    metadata: { lastSeen: new Date() }
  }, { skipVersioning: true });
  
  return response;
}
```

### Personalization

```typescript
async function personalizeExperience(userId: string) {
  const user = await cortex.users.get(userId);
  
  return {
    greeting: `Hello ${user.displayName}!`,
    theme: user.preferences.theme || 'light',
    timezone: user.preferences.timezone || 'UTC',
    isPro: user.metadata.tier === 'pro'
  };
}
```

### Cross-Agent Context

All agents can access user profile:

```typescript
// Support agent uses profile
const user = await cortex.users.get(userId);
const greeting = `Good ${getTimeOfDay(user.preferences.timezone)}, ${user.displayName}!`;

// Sales agent uses same profile
const user = await cortex.users.get(userId);
if (user.metadata.tier === 'free') {
  offerUpgrade();
}

// Billing agent uses same profile
const user = await cortex.users.get(userId);
sendInvoiceTo(user.email);
```

## Advanced Features

### Profile Schemas

Define custom profile schemas:

```typescript
// Define your user structure
interface CustomUserProfile extends UserProfile {
  preferences: {
    theme: 'light' | 'dark';
    language: 'en' | 'es' | 'fr';
    emailFrequency: 'daily' | 'weekly' | 'never';
    featuresEnabled: string[];
  };
  metadata: {
    tier: 'free' | 'pro' | 'enterprise';
    credits: number;
    lastPurchase?: Date;
    referralCode?: string;
  };
}

// Use with type safety
const user = await cortex.users.get<CustomUserProfile>(userId);
console.log(user.preferences.emailFrequency); // Typed!
```

### Nested Preferences

Organize complex preferences:

```typescript
await cortex.users.update(userId, {
  preferences: {
    notifications: {
      email: true,
      push: false,
      sms: false,
      frequency: 'weekly'
    },
    privacy: {
      shareData: false,
      analytics: true,
      marketing: false
    },
    ui: {
      theme: 'dark',
      density: 'comfortable',
      animations: true
    }
  }
});

// Access nested values
const user = await cortex.users.get(userId);
if (user.preferences.notifications.email) {
  sendEmail(user.email, notification);
}
```

### Profile Validation

Validate before updating:

```typescript
import { z } from 'zod';

const UserProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    language: z.string().length(2).optional(),
    timezone: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

async function safeUpdateProfile(userId: string, data: any) {
  // Validate
  const validated = UserProfileSchema.parse(data);
  
  // Update
  return await cortex.users.update(userId, validated);
}
```

## Real-World Patterns

### Pattern 1: Initialize on First Contact

```typescript
async function handleFirstMessage(userId: string, message: string) {
  // Check if profile exists
  let user = await cortex.users.get(userId);
  
  if (!user) {
    // Create default profile
    await cortex.users.update(userId, {
      displayName: userId, // Temporary until we know their name
      preferences: {
        language: detectLanguage(message),
        timezone: 'UTC'
      },
      metadata: {
        tier: 'free',
        signupDate: new Date(),
        firstMessage: message
      }
    });
    
    user = await cortex.users.get(userId);
  }
  
  return user;
}
```

### Pattern 2: Progressive Enhancement

Build user profiles over time:

```typescript
async function learnFromConversation(userId: string, conversation: string) {
  const user = await cortex.users.get(userId);
  
  // Extract information from conversation
  const insights = await extractUserInsights(conversation);
  
  // Update profile incrementally
  await cortex.users.update(userId, {
    displayName: insights.name || user.displayName,
    preferences: {
      ...user.preferences,
      ...insights.preferences
    },
    metadata: {
      ...user.metadata,
      lastSeen: new Date(),
      conversationCount: (user.metadata.conversationCount || 0) + 1
    }
  });
}
```

### Pattern 3: User Preferences UI

Sync with user-facing preferences:

```typescript
// User updates preferences in your UI
async function handlePreferenceChange(userId: string, changes: any) {
  await cortex.users.update(userId, {
    preferences: changes
  });
  
  // All agents immediately see the change
  const user = await cortex.users.get(userId);
  applyPreferences(user.preferences);
}
```

### Pattern 4: GDPR Compliance

Handle data deletion requests efficiently:

```typescript
async function handleDataDeletionRequest(userId: string) {
  // Delete with cascade - much more efficient!
  const result = await cortex.users.delete(userId, { 
    cascade: true  // Automatically deletes from all agents
  });
  
  console.log(`GDPR deletion complete for user ${userId}`);
  console.log(`- Profile deleted: ${result.profileDeleted}`);
  console.log(`- Memories deleted: ${result.memoriesDeleted}`);
  console.log(`- Agents affected: ${result.agentsAffected.join(', ')}`);
  
  return result;
}

// Or manual approach with universal filters
async function manualGDPRDeletion(userId: string) {
  const deletionLog = [];
  
  // 1. Export user data first (GDPR requirement)
  const agents = await cortex.agents.list();
  for (const agent of agents) {
    const userData = await cortex.memory.export(agent.id, {
      userId: userId,
      format: 'json'
    });
    if (userData.length > 0) {
      await saveToFile(`gdpr-export-${userId}-${agent.id}.json`, userData);
    }
  }
  
  // 2. Delete from all agents using deleteMany
  for (const agent of agents) {
    const result = await cortex.memory.deleteMany(agent.id, {
      userId: userId  // Universal filter!
    });
    
    if (result.deleted > 0) {
      deletionLog.push({
        agentId: agent.id,
        deleted: result.deleted
      });
    }
  }
  
  // 3. Delete user profile
  await cortex.users.delete(userId);
  
  console.log(`Deleted all data for user ${userId}`);
  return deletionLog;
}
```

## Querying User Profiles

### Search Users

Find users with filters (same pattern as memory operations):

```typescript
// Find all pro users
const proUsers = await cortex.users.search({
  metadata: { tier: 'pro' }
});

// Find users by company
const companyUsers = await cortex.users.search({
  metadata: { company: 'Acme Corp' }
});

// Find inactive users
const inactive = await cortex.users.search({
  metadata: {
    lastSeen: { 
      $lte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) 
    }
  }
});

// Find users with specific preferences
const darkModeUsers = await cortex.users.search({
  preferences: { theme: 'dark' }
});
```

### List Users (Paginated)

```typescript
// List all users
const page1 = await cortex.users.list({
  limit: 50,
  offset: 0,
  sortBy: 'createdAt',
  sortOrder: 'desc'
});

// List with filters
const recentUsers = await cortex.users.list({
  metadata: {
    signupDate: { 
      $gte: new Date('2025-10-01') 
    }
  },
  limit: 100
});
```

### Count Users

```typescript
// Total user count
const total = await cortex.users.count();

// Count by tier
const proCount = await cortex.users.count({
  metadata: { tier: 'pro' }
});

// Count active users (last 30 days)
const activeCount = await cortex.users.count({
  metadata: {
    lastSeen: { 
      $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
    }
  }
});
```

### Bulk Operations

```typescript
// Update multiple users
await cortex.users.updateMany({
  metadata: { tier: 'free' }
}, {
  preferences: {
    newFeatureEnabled: true
  }
});

// Delete inactive free users
await cortex.users.deleteMany({
  metadata: {
    tier: 'free',
    lastSeen: { 
      $lte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) 
    }
  }
});
```

## Multi-Tenant Considerations

### Tenant Isolation

If building multi-tenant apps, include tenant ID:

```typescript
// User ID includes tenant
const userId = `${tenantId}:${userLocalId}`;

// Or use metadata
await cortex.users.update(userId, {
  displayName: 'Alex',
  metadata: {
    tenantId: 'tenant-abc',
    role: 'admin'
  }
});

// Query by tenant (universal filters work here too!)
const tenantUsers = await cortex.users.search({
  metadata: { tenantId: 'tenant-abc' }
});

// Count users per tenant
const count = await cortex.users.count({
  metadata: { tenantId: 'tenant-abc' }
});

// Export tenant data (includes user profiles, can link to memories)
const tenantData = await cortex.users.export({
  metadata: { tenantId: 'tenant-abc' },
  format: 'json',
  includeMemories: true  // Optional: export user's memories too
});

// Export will include:
// - User profiles
// - Associated vector memories (if includeMemories=true)
// - conversationRef links to ACID conversations
// - Can optionally export full conversations from ACID
```

> **Note**: User profiles are NOT stored in ACID conversations or vector memories. They're a separate entity type in Convex, but memories can reference users via `userId` field.

## Profile Version History

### Viewing Profile Changes

```typescript
// Get current profile
const user = await cortex.users.get('user-123');

console.log(`Current version: ${user.version}`);
console.log(`Display name: ${user.displayName}`);
console.log(`Theme: ${user.preferences.theme}`);

// View all versions
user.previousVersions?.forEach(v => {
  console.log(`v${v.version} (${v.timestamp}):`);
  console.log(`  Display name: ${v.displayName}`);
  console.log(`  Theme: ${v.preferences?.theme}`);
});
```

### Get Specific Version

```typescript
// What were user's preferences on a specific date?
const historicalProfile = await cortex.users.getAtTimestamp('user-123',
  new Date('2025-08-01')
);

console.log('Theme in August:', historicalProfile.preferences.theme);
```

### Track Preference Changes

```typescript
// Analyze how preferences evolved
async function analyzePreferenceChanges(userId: string) {
  const user = await cortex.users.get(userId);
  
  const changes = [];
  let previous = user.previousVersions?.[user.previousVersions.length - 1];
  
  for (const version of [...(user.previousVersions || []), user]) {
    if (previous) {
      // Detect changes
      if (version.preferences?.theme !== previous.preferences?.theme) {
        changes.push({
          field: 'theme',
          from: previous.preferences?.theme,
          to: version.preferences?.theme,
          when: version.timestamp || version.updatedAt
        });
      }
    }
    previous = version;
  }
  
  return changes;
}
```

## Profile Analytics

### Usage Tracking

```typescript
// Track profile access
const user = await cortex.users.get(userId);

// Automatically tracked:
console.log({
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  version: user.version,
  lastSeen: user.metadata.lastSeen
});

// Log access for analytics
await analytics.track('profile-accessed', {
  userId,
  timestamp: new Date(),
  accessedBy: agentId
});
```

### Profile Completeness

Measure how complete a profile is:

```typescript
function calculateCompleteness(user: UserProfile): number {
  const fields = [
    user.displayName,
    user.email,
    user.preferences.theme,
    user.preferences.language,
    user.preferences.timezone
  ];
  
  const filled = fields.filter(f => f !== undefined && f !== null).length;
  return (filled / fields.length) * 100;
}

const user = await cortex.users.get(userId);
const completeness = calculateCompleteness(user);

if (completeness < 50) {
  console.log('Profile incomplete - prompt user for more info');
}
```

## Cloud Mode Features

> **Cloud Mode Only**: Enhanced profile features with Cortex Cloud

### Profile Analytics Dashboard

- User engagement metrics
- Preference trends
- Profile completeness scores
- User segmentation

### Smart Defaults

AI-powered default suggestions:
- "Most users in this region prefer timezone X"
- "Users with similar usage patterns prefer Y"
- Auto-detect language from messages

### Profile Synchronization

Sync with external systems:
- Auth0, Clerk, Supabase Auth
- CRM systems (Salesforce, HubSpot)
- Identity providers (Okta, Azure AD)

## Universal Filters for Users

> **Core Principle**: User operations support the same filter patterns as memory operations

```typescript
// The same filters work for:
const filters = {
  metadata: {
    tier: 'pro',
    signupDate: { $gte: new Date('2025-01-01') }
  },
  preferences: {
    language: 'en'
  }
};

// Search
await cortex.users.search(filters);

// Count
await cortex.users.count(filters);

// List
await cortex.users.list(filters);

// Update many
await cortex.users.updateMany(filters, { metadata: { reviewed: true } });

// Delete many
await cortex.users.deleteMany(filters);

// Export
await cortex.users.export(filters);
```

**Supported Filters:**
- `metadata.*` - Any metadata field with operators ($gte, $lte, $eq, etc.)
- `preferences.*` - Any preference field
- `createdBefore/After` - Date range for creation
- `updatedBefore/After` - Date range for updates
- `email` - Email address (exact or pattern match)
- `displayName` - Name (exact or pattern match)

## Best Practices

### 1. Minimal Required Fields

Only require what you truly need:

```typescript
// ✅ Start minimal
await cortex.users.update(userId, {
  displayName: 'Alex'  // That's it!
});

// Add more over time as you learn
```

### 2. Default Values

Provide sensible defaults:

```typescript
const defaultPreferences = {
  theme: 'light',
  language: 'en',
  timezone: 'UTC',
  notifications: true
};

await cortex.users.update(userId, {
  displayName: name,
  preferences: { ...defaultPreferences, ...customPreferences }
});
```

### 3. Update Timestamp

Track when user was last seen:

```typescript
async function recordUserActivity(userId: string) {
  await cortex.users.update(userId, {
    metadata: {
      lastSeen: new Date()
    }
  });
}
```

### 4. Privacy-First

Don't store unnecessary PII:

```typescript
// ❌ Storing unnecessary data
await cortex.users.update(userId, {
  metadata: {
    ssn: '123-45-6789',  // Don't store this!
    creditCard: '4111...' // Definitely not this!
  }
});

// ✅ Store only what's needed
await cortex.users.update(userId, {
  preferences: {
    paymentMethod: 'card-ending-1234'  // Reference only
  }
});
```

### 5. Version Control for Important Changes

Use versioning for preference tracking:

```typescript
// Enable versioning for preference changes
await cortex.users.update(userId, {
  preferences: {
    emailNotifications: false  // User opts out
  }
}, {
  skipVersioning: false,  // Create version (default)
  versionReason: 'user-requested'
});

// Skip versioning for routine updates
await cortex.users.update(userId, {
  metadata: {
    lastSeen: new Date(),
    sessionCount: user.metadata.sessionCount + 1
  }
}, {
  skipVersioning: true  // Don't create version for stats
});
```

## Next Steps

- **[Context Chains](./04-context-chains.md)** - Multi-agent coordination
- **[Conversation History](./06-conversation-history.md)** - Message persistence
- **[API Reference](../03-api-reference/04-user-operations.md)** - User API docs

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).

