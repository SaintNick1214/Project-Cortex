# Usage Examples - Open WebUI + Cortex Integration

> **Real-world scenarios demonstrating Cortex features in action**

This document presents five practical scenarios that showcase how Open WebUI + Cortex transforms AI interactions with persistent memory, context chains, facts extraction, and multi-agent coordination.

## Table of Contents
- [Scenario 1: Personal Assistant with Memory](#scenario-1-personal-assistant-with-memory)
- [Scenario 2: Customer Support with User Profiles](#scenario-2-customer-support-with-user-profiles)
- [Scenario 3: Multi-Project Management with Context Chains](#scenario-3-multi-project-management-with-context-chains)
- [Scenario 4: Knowledge Base with Facts Extraction](#scenario-4-knowledge-base-with-facts-extraction)
- [Scenario 5: Multi-Agent Team Collaboration](#scenario-5-multi-agent-team-collaboration)

---

## Scenario 1: Personal Assistant with Memory

### Use Case
A software developer uses Open WebUI as their daily AI assistant. With Cortex, the assistant remembers preferences, past conversations, and context across days and weeks.

### Without Cortex (Default Open WebUI)
```
Day 1:
User: "I prefer TypeScript for new projects"
AI: "Got it!"

Day 2:
User: "Should I use Python or TypeScript for this API?"
AI: "Both are good choices. What do you prefer?"
  ❌ Forgot the preference from Day 1
```

### With Cortex Memory
```
Day 1:
User: "I prefer TypeScript for new projects"
AI: "Got it! I'll remember that."
  → Cortex stores: fact(Alice, preference_language, TypeScript)

Day 2:
User: "Should I use Python or TypeScript for this API?"
AI: [Cortex recalls preference from Day 1]
AI: "Based on your preference for TypeScript, I'd recommend 
     TypeScript for this API. You mentioned liking it for new 
     projects yesterday."
  ✅ Remembered preference across sessions
```

### Technical Flow

**1. Storing Preference (Day 1):**
```typescript
await cortex.memory.remember({
  memorySpaceId: 'alice-123',
  conversationId: 'conv-day1-001',
  userMessage: 'I prefer TypeScript for new projects',
  agentResponse: "Got it! I'll remember that.",
  userId: 'alice-123',
  userName: 'Alice',
  importance: 8,  // High importance for preferences
  extractFacts: true,  // Extract the preference as a fact
  metadata: {
    category: 'preference',
    topic: 'programming_language'
  }
});

// Cortex automatically extracts:
// Fact: { entity: "Alice", attribute: "language_preference", value: "TypeScript" }
```

**2. Recalling Preference (Day 2):**
```typescript
const memories = await cortex.memory.recall({
  memorySpaceId: 'alice-123',
  query: 'programming language preference TypeScript Python',
  limit: 5
});

// Returns memories including Day 1 preference
// AI uses this context to make informed recommendation
```

### Benefits Demonstrated
- ✅ Long-term memory across sessions
- ✅ Automatic fact extraction (preference storage)
- ✅ Semantic search (finds related conversations)
- ✅ Personalized responses

---

## Scenario 2: Customer Support with User Profiles

### Use Case
A SaaS company uses Open WebUI for customer support. Each customer has a profile with their account details, preferences, and history. Support agents can instantly access customer context.

### Without Cortex
```
Customer: "I'm having issues with my account"
Agent: "Can you provide your email and account details?"
  ❌ Every interaction starts from scratch
```

### With Cortex
```
Customer: "I'm having issues with my account"
Agent: [Cortex loads user profile automatically]
Agent: "Hi Sarah! I see you're on the Pro plan since March 2024, 
       and you contacted us about API rate limits last week. 
       What's happening now?"
  ✅ Full context loaded automatically
```

### Technical Implementation

**1. Create User Profile:**
```typescript
// When customer first contacts support
await cortex.users.create({
  userId: 'customer-sarah-456',
  name: 'Sarah Chen',
  email: 'sarah@company.com',
  metadata: {
    account: {
      plan: 'Pro',
      joined: '2024-03-15',
      company: 'Tech Innovations Inc',
      industry: 'SaaS'
    },
    preferences: {
      timezone: 'America/Los_Angeles',
      contact_method: 'email'
    },
    support_tier: 'priority'
  }
});
```

**2. Store Support Interaction:**
```typescript
// Each support interaction is stored
await cortex.memory.remember({
  memorySpaceId: 'support-team',
  conversationId: 'support-2024-11-02-001',
  userMessage: 'Having issues with API rate limits',
  agentResponse: 'Increased your rate limit to 10,000/hour',
  userId: 'customer-sarah-456',
  userName: 'Sarah Chen',
  contextId: 'support-tickets',
  importance: 7,
  extractFacts: true,
  metadata: {
    ticketId: 'TICKET-12345',
    category: 'api',
    resolved: true,
    resolution: 'rate_limit_increase'
  }
});
```

**3. Recall Customer History:**
```typescript
// When customer contacts support again
const profile = await cortex.users.get('customer-sarah-456');
const history = await cortex.memory.recall({
  memorySpaceId: 'support-team',
  query: 'customer issues',
  userId: 'customer-sarah-456',
  contextId: 'support-tickets',
  limit: 10
});

// Agent sees:
// - Full customer profile
// - Past 10 support interactions
// - Extracted facts (issues, resolutions)
```

**4. GDPR Compliance:**
```typescript
// Customer requests data deletion
await cortex.users.delete('customer-sarah-456', {
  cascade: true,  // Delete ALL customer data
  verify: true    // Ensure complete removal
});

// Deletes:
// ✅ User profile
// ✅ All support conversations
// ✅ All extracted facts
// ✅ All memories
```

### Benefits Demonstrated
- ✅ Rich user profiles
- ✅ Complete customer history
- ✅ GDPR-compliant deletion
- ✅ Faster resolution times

---

## Scenario 3: Multi-Project Management with Context Chains

### Use Case
A development team uses Open WebUI to manage multiple projects simultaneously. Context chains organize conversations by project → sprint → task hierarchy.

### Without Cortex
```
User: "What's the status of the homepage redesign?"
AI: [Searches through all conversations mixed together]
AI: "I found mentions of homepage, but I'm not sure which 
     project you're referring to..."
  ❌ No project organization
```

### With Cortex Context Chains
```
User: [Selects context: Website Redesign → Sprint 1 → Homepage]
User: "What's the status?"
AI: [Searches only within selected context]
AI: "In the Homepage context, we completed the hero section 
     yesterday and you're currently working on the navigation 
     menu. Next up is the footer."
  ✅ Organized by project hierarchy
```

### Technical Implementation

**1. Create Project Hierarchy:**
```typescript
// Root: Project
const project = await cortex.contexts.create({
  name: 'Website Redesign',
  description: 'Q4 2025 website overhaul',
  memorySpaceId: 'team-dev',
  parentId: null,
  metadata: {
    deadline: '2025-12-31',
    budget: 50000,
    priority: 'high'
  }
});

// Level 2: Sprint
const sprint1 = await cortex.contexts.create({
  name: 'Sprint 1: Homepage',
  description: 'Landing page components',
  memorySpaceId: 'team-dev',
  parentId: project.contextId,
  metadata: {
    startDate: '2025-11-01',
    endDate: '2025-11-15',
    sprintGoal: 'Complete homepage redesign'
  }
});

// Level 3: Task
const heroTask = await cortex.contexts.create({
  name: 'Hero Section',
  description: 'Design and implement hero section',
  memorySpaceId: 'team-dev',
  parentId: sprint1.contextId,
  metadata: {
    assignedTo: 'alice-123',
    status: 'in_progress',
    estimatedHours: 8
  }
});
```

**2. Store Work in Context:**
```typescript
// Conversation in hero section context
await cortex.memory.remember({
  memorySpaceId: 'team-dev',
  conversationId: 'conv-hero-001',
  userMessage: 'Should we use a video or image for the hero?',
  agentResponse: 'Video creates more engagement but increases load time...',
  contextId: heroTask.contextId,  // Associate with task
  importance: 6,
  extractFacts: true
});
```

**3. Context-Aware Search:**
```typescript
// Search within specific context
const heroMemories = await cortex.memory.recall({
  memorySpaceId: 'team-dev',
  contextId: heroTask.contextId,
  query: 'hero design decisions',
  includeParentContexts: true,  // Also search parent contexts
  limit: 10
});

// Returns only memories from:
// - Hero Section task
// - Sprint 1 (parent)
// - Website Redesign (grandparent)
```

**4. Get Full Context Chain:**
```typescript
const chain = await cortex.contexts.getChain(heroTask.contextId);

console.log('Context chain:');
chain.forEach((ctx, i) => {
  console.log(`${'  '.repeat(i)}${ctx.name}`);
});

// Output:
// Website Redesign
//   Sprint 1: Homepage
//     Hero Section
```

### Benefits Demonstrated
- ✅ Hierarchical project organization
- ✅ Context-scoped searches
- ✅ Team collaboration
- ✅ Project tracking

---

## Scenario 4: Knowledge Base with Facts Extraction

### Use Case
A company builds an internal knowledge base through natural conversations. Cortex automatically extracts and structures facts for easy retrieval.

### Without Cortex
```
User: "Alice works at Acme Corp as a Senior Engineer"
AI: "Got it!"

Later:
User: "Who works at Acme Corp?"
AI: "I don't have structured information about that."
  ❌ Information buried in conversation history
```

### With Cortex Facts Extraction
```
User: "Alice works at Acme Corp as a Senior Engineer 
       specializing in TypeScript. She joined in 2020."
AI: "Got it! I'll remember that."
  → Cortex extracts facts automatically

Later:
User: "Who works at Acme Corp?"
AI: [Queries structured facts]
AI: "Alice works at Acme Corp as a Senior Engineer."

User: "What's Alice's specialization?"
AI: "Alice specializes in TypeScript."

User: "When did she join?"
AI: "Alice joined in 2020."
  ✅ Structured, queryable knowledge
```

### Technical Implementation

**1. Automatic Fact Extraction:**
```typescript
await cortex.memory.remember({
  memorySpaceId: 'company-kb',
  conversationId: 'kb-001',
  userMessage: 'Alice works at Acme Corp as a Senior Engineer specializing in TypeScript. She joined in 2020.',
  agentResponse: "Got it! I'll remember that.",
  extractFacts: true,  // Enable automatic extraction
  importance: 8
});

// Cortex automatically extracts:
// Fact 1: { entity: "Alice", attribute: "employer", value: "Acme Corp" }
// Fact 2: { entity: "Alice", attribute: "role", value: "Senior Engineer" }
// Fact 3: { entity: "Alice", attribute: "specialization", value: "TypeScript" }
// Fact 4: { entity: "Alice", attribute: "join_year", value: "2020" }
```

**2. Query Facts:**
```typescript
// Query by entity
const aliceFacts = await cortex.facts.query({
  memorySpaceId: 'company-kb',
  entity: 'Alice',
  limit: 10
});

aliceFacts.forEach(fact => {
  console.log(`${fact.attribute}: ${fact.value}`);
});

// Output:
// employer: Acme Corp
// role: Senior Engineer
// specialization: TypeScript
// join_year: 2020
```

**3. Query by Attribute:**
```typescript
// Find everyone at Acme Corp
const acmeEmployees = await cortex.facts.query({
  memorySpaceId: 'company-kb',
  attribute: 'employer',
  value: 'Acme Corp',
  limit: 50
});

// Returns all employees at Acme Corp
```

**4. Manual Fact Extraction:**
```typescript
// Extract facts from existing text
const facts = await cortex.facts.extract({
  content: 'Bob lives in Seattle and loves coffee. He works remotely.',
  memorySpaceId: 'company-kb',
  extractorType: 'llm'
});

// Extracts:
// { entity: "Bob", attribute: "location", value: "Seattle" }
// { entity: "Bob", attribute: "interest", value: "coffee" }
// { entity: "Bob", attribute: "work_style", value: "remote" }
```

### Storage Efficiency

**Before (Full Conversation Storage):**
- 500-word conversation = ~500 tokens
- 1,000 conversations = 500,000 tokens
- Cost: Significant storage and retrieval overhead

**After (Facts Extraction):**
- 500-word conversation → 5 facts = ~50 tokens
- 1,000 conversations → 5,000 facts = 50,000 tokens
- **90% storage reduction**

### Benefits Demonstrated
- ✅ Automatic knowledge extraction
- ✅ Structured, queryable facts
- ✅ 60-90% storage savings
- ✅ Precise information retrieval

---

## Scenario 5: Multi-Agent Team Collaboration

### Use Case
A creative team uses multiple AI models (GPT-4 for design, Claude for writing, Llama for research) in a shared memory space. Each agent can access and build on others' work.

### Without Cortex
```
User → GPT-4: "Design a logo"
GPT-4: "Here's a modern design..."

User → Claude: "Write a tagline for the logo"
Claude: "What logo? Can you describe it?"
  ❌ Claude can't see GPT-4's work
```

### With Cortex Hive Mode
```
User → GPT-4: "Design a logo"
GPT-4: "Here's a modern, minimalist design in blue..."
  → Stored in shared hive memory

User → Claude: "Write a tagline for the logo"
Claude: [Accesses GPT-4's logo design from hive memory]
Claude: "Based on the modern blue design GPT-4 created, 
         I suggest: 'Simple. Powerful. Yours.'"
  ✅ Claude builds on GPT-4's work

User → Llama: "Research competitors"
Llama: [Accesses both GPT-4 and Claude's work]
Llama: "Given your modern logo and tagline, your main 
        competitors are..."
  ✅ Llama sees complete project context
```

### Technical Implementation

**1. Create Hive Memory Space:**
```typescript
await cortex.memorySpaces.create({
  memorySpaceId: 'creative-team-hive',
  name: 'Creative Team Hive',
  mode: 'hive',  // Shared memory
  participants: [
    { participantId: 'gpt-4', role: 'designer' },
    { participantId: 'claude-3-opus', role: 'copywriter' },
    { participantId: 'llama-70b', role: 'researcher' }
  ],
  metadata: {
    team: 'creative',
    project: 'brand-identity'
  }
});
```

**2. Register Agents:**
```typescript
// Register each AI model
await cortex.agents.register({
  agentId: 'gpt-4',
  name: 'GPT-4',
  capabilities: ['design', 'reasoning', 'coding'],
  metadata: { provider: 'openai', model: 'gpt-4-turbo' }
});

await cortex.agents.register({
  agentId: 'claude-3-opus',
  name: 'Claude 3 Opus',
  capabilities: ['writing', 'analysis', 'reasoning'],
  metadata: { provider: 'anthropic', model: 'claude-3-opus' }
});

await cortex.agents.register({
  agentId: 'llama-70b',
  name: 'Llama 2 70B',
  capabilities: ['research', 'reasoning'],
  metadata: { provider: 'ollama', model: 'llama2:70b', selfHosted: true }
});
```

**3. GPT-4 Adds Design:**
```typescript
await cortex.memory.remember({
  memorySpaceId: 'creative-team-hive',
  conversationId: 'conv-design-001',
  userMessage: 'Design a modern logo',
  agentResponse: 'I created a minimalist design with blue (#2C3E50) as primary color...',
  participantId: 'gpt-4',
  importance: 8,
  extractFacts: true,
  metadata: {
    task: 'logo-design',
    deliverable: 'logo_v1.svg'
  }
});
```

**4. Claude Accesses GPT-4's Work:**
```typescript
// Claude recalls logo design
const designMemories = await cortex.memory.recall({
  memorySpaceId: 'creative-team-hive',
  query: 'logo design',
  participantId: 'claude-3-opus',
  includeOtherParticipants: true,  // See other agents' work
  limit: 5
});

// Add Claude's tagline
await cortex.memory.remember({
  memorySpaceId: 'creative-team-hive',
  conversationId: 'conv-tagline-001',
  userMessage: 'Write a tagline',
  agentResponse: 'Based on the modern blue design: "Simple. Powerful. Yours."',
  participantId: 'claude-3-opus',
  importance: 8,
  metadata: {
    task: 'tagline',
    references: ['conv-design-001']  // References GPT-4's work
  }
});
```

**5. Llama Researches with Full Context:**
```typescript
// Llama sees both GPT-4 and Claude's work
const projectContext = await cortex.memory.recall({
  memorySpaceId: 'creative-team-hive',
  query: 'project brand identity',
  participantId: 'llama-70b',
  includeOtherParticipants: true,
  limit: 20
});

// Llama provides research informed by full project context
```

**6. Cross-Agent Workflow:**
```typescript
// List all agents
const agents = await cortex.agents.list();

// Get work by specific agent
const gpt4Work = await cortex.memory.recall({
  memorySpaceId: 'creative-team-hive',
  query: '*',  // All memories
  participantId: 'gpt-4',
  limit: 100
});

console.log(`GPT-4 created ${gpt4Work.length} memories`);
```

### Benefits Demonstrated
- ✅ Unified memory across AI models
- ✅ Seamless agent handoffs
- ✅ Cross-model collaboration
- ✅ No context loss when switching agents

---

## Summary

These five scenarios demonstrate:

| Scenario | Features | Benefits |
|----------|----------|----------|
| 1. Personal Assistant | Memory persistence, facts | Long-term preferences, personalization |
| 2. Customer Support | User profiles, GDPR | Complete customer context, compliance |
| 3. Project Management | Context chains, hierarchy | Project organization, team coordination |
| 4. Knowledge Base | Facts extraction, queries | Structured knowledge, 90% storage savings |
| 5. Multi-Agent | Hive mode, agent registry | Unified memory, seamless collaboration |

**All scenarios work simultaneously** - you can have personal assistants, customer support, project management, knowledge bases, and multi-agent teams all using Cortex in the same deployment!

Next: [08-COMPARISON.md](./08-COMPARISON.md) - Before/After analysis with metrics

