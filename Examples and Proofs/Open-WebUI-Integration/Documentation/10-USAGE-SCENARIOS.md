# Usage Scenarios - Open WebUI + Cortex

> **Pre-Built Scenarios Demonstrating Cortex Features**

Five interactive scenarios showing real-world Cortex capabilities. Load, watch, and continue chatting.

---

## Scenario System

**File**: `src/lib/scenarios/definitions.ts`

```typescript
export interface ScenarioMessage {
  role: "user" | "assistant";
  content: string;
  cortexAction?: string;
  expectedCortex?: {
    memoriesRecalled?: number;
    factsExtracted?: number;
    contextActive?: string;
  };
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  category: "A" | "B" | "C"; // Feature category
  messages: ScenarioMessage[];
  learningPoints: string[];
}
```

---

## Scenario 1: Personal Assistant Memory (Category A)

```typescript
export const personalAssistantScenario: Scenario = {
  id: "personal-assistant",
  name: "Personal Assistant with Memory",
  description:
    "Demonstrate how Cortex remembers preferences and provides contextual responses",
  category: "A",
  messages: [
    {
      role: "user",
      content: "I prefer TypeScript for backend development",
      cortexAction: "STORE",
      expectedCortex: { memoriesRecalled: 0 },
    },
    {
      role: "assistant",
      content:
        "Great choice! TypeScript provides excellent type safety for backend services. I'll remember your preference.",
      cortexAction: "STORED",
      expectedCortex: { factsExtracted: 1 },
    },
    {
      role: "user",
      content: "I usually work with Node.js and Express",
      cortexAction: "STORE",
    },
    {
      role: "assistant",
      content:
        "Perfect! TypeScript pairs excellently with Node.js and Express. I've noted your tech stack.",
      cortexAction: "STORED",
      expectedCortex: { factsExtracted: 2 },
    },
    {
      role: "user",
      content: "What should I use for my new backend project?",
      cortexAction: "RECALL",
      expectedCortex: { memoriesRecalled: 2 },
    },
    {
      role: "assistant",
      content:
        "Based on your preferences, I recommend TypeScript with Node.js and Express - exactly what you're comfortable with. This aligns perfectly with your previous projects.",
      cortexAction: "RECALLED + STORED",
      expectedCortex: { memoriesRecalled: 2 },
    },
  ],
  learningPoints: [
    "Memories persist across conversations",
    "Semantic search finds relevant context",
    "Personalized recommendations based on history",
    "Facts extracted automatically (preferences, tech stack)",
  ],
};
```

---

## Scenario 2: Customer Support (Category B)

```typescript
export const customerSupportScenario: Scenario = {
  id: "customer-support",
  name: "Customer Support with User Profiles",
  description: "Show how Cortex maintains customer context and history",
  category: "B",
  messages: [
    {
      role: "user",
      content:
        "Hi, I need help with my account. My email is sarah.jones@company.com",
      cortexAction: "STORE",
      expectedCortex: { factsExtracted: 1 },
    },
    {
      role: "assistant",
      content:
        "Hello Sarah! I've pulled up your account (sarah.jones@company.com). How can I help you today?",
      cortexAction: "CREATE_USER_PROFILE",
    },
    {
      role: "user",
      content: "I'm having trouble with order #A4532",
      cortexAction: "STORE",
      expectedCortex: { factsExtracted: 1 },
    },
    {
      role: "assistant",
      content:
        "I see order #A4532 in your account. Let me look into that issue for you.",
      cortexAction: "STORED",
    },
    // ... later conversation
    {
      role: "user",
      content: "Can you check my recent orders?",
      cortexAction: "RECALL",
      expectedCortex: { memoriesRecalled: 3 },
    },
    {
      role: "assistant",
      content:
        "Of course! I can see your recent order #A4532 which we just discussed. Would you like details on that or other orders?",
      cortexAction: "RECALLED",
    },
  ],
  learningPoints: [
    "User profiles maintain customer context",
    "GDPR-compliant data storage",
    "Customer history across sessions",
    "No need to repeat information",
  ],
};
```

---

## Scenario 3: Multi-Project Contexts (Category B)

```typescript
export const contextChainsScenario: Scenario = {
  id: "context-chains",
  name: "Multi-Project Context Management",
  description: "Hierarchical organization with context switching",
  category: "B",
  messages: [
    {
      role: "user",
      content: "I'm working on two projects: Website Redesign and Mobile App",
      cortexAction: "CREATE_CONTEXTS",
      expectedCortex: { contextActive: "Website Redesign" },
    },
    {
      role: "assistant",
      content:
        "I've created context chains for both projects. Which one would you like to discuss first?",
      cortexAction: "CONTEXTS_CREATED",
    },
    {
      role: "user",
      content: "Let's talk about the Website homepage hero section",
      cortexAction: "SWITCH_CONTEXT",
      expectedCortex: { contextActive: "Website > Homepage > Hero" },
    },
    {
      role: "assistant",
      content:
        "Switched to Website → Homepage → Hero section. What would you like to design?",
      cortexAction: "CONTEXT_SWITCHED",
    },
    {
      role: "user",
      content: "Should we use a video or static image?",
      cortexAction: "STORE_IN_CONTEXT",
    },
    {
      role: "assistant",
      content:
        "For the hero section, I recommend a high-quality static image with lazy-loaded video option...",
      cortexAction: "STORED_IN_CONTEXT",
    },
    // Switch contexts
    {
      role: "user",
      content: "Now let's discuss the Mobile App user onboarding",
      cortexAction: "SWITCH_CONTEXT",
      expectedCortex: { contextActive: "Mobile App > Onboarding" },
    },
    {
      role: "assistant",
      content:
        "Switched to Mobile App → Onboarding. Previous hero section decisions are saved in the Website context.",
      cortexAction: "CONTEXT_SWITCHED",
    },
  ],
  learningPoints: [
    "Organize work in hierarchical contexts",
    "Switch between projects seamlessly",
    "Context-scoped memory searches",
    "Isolated memories per context",
  ],
};
```

---

## Scenario 4: Facts Extraction (Category B)

```typescript
export const factsExtractionScenario: Scenario = {
  id: "facts-extraction",
  name: "Knowledge Base with Facts",
  description: "Automatic structured knowledge extraction",
  category: "B",
  messages: [
    {
      role: "user",
      content:
        "Our company is Tech Innovations Inc, founded in 2018. We have 50 employees and specialize in AI solutions.",
      cortexAction: "EXTRACT_FACTS",
      expectedCortex: { factsExtracted: 4 },
    },
    {
      role: "assistant",
      content:
        "Thank you! I've extracted and stored: Company name, founding year, employee count, and specialization. This helps me understand your context.",
      cortexAction: "FACTS_EXTRACTED",
    },
    {
      role: "user",
      content: "We're based in San Francisco, California",
      cortexAction: "EXTRACT_FACTS",
      expectedCortex: { factsExtracted: 2 },
    },
    {
      role: "assistant",
      content:
        "Noted - San Francisco, California. I now have a complete profile of Tech Innovations Inc.",
      cortexAction: "FACTS_EXTRACTED",
    },
    {
      role: "user",
      content: "When was our company founded?",
      cortexAction: "QUERY_FACTS",
      expectedCortex: { memoriesRecalled: 1 },
    },
    {
      role: "assistant",
      content: "Tech Innovations Inc was founded in 2018.",
      cortexAction: "FACT_RECALLED",
    },
  ],
  learningPoints: [
    "Facts auto-extracted from conversations",
    "Structured knowledge storage",
    "60-90% storage savings vs full conversations",
    "Query facts directly without conversation context",
  ],
};
```

---

## Scenario 5: Multi-Agent Hive (Category C)

```typescript
export const multiAgentScenario: Scenario = {
  id: "multi-agent-hive",
  name: "Team Collaboration (Hive Mode)",
  description: "Multiple AI agents sharing memory and context",
  category: "C",
  messages: [
    {
      role: "user",
      content: "[Agent: GPT-4] Design a modern logo with blue tones",
      cortexAction: "STORE_IN_HIVE",
      expectedCortex: { memoriesRecalled: 0 },
    },
    {
      role: "assistant",
      content:
        "[GPT-4] I'll create a minimalist logo using navy and sky blue. Clean geometric shapes with modern typography.",
      cortexAction: "STORED_IN_HIVE",
      expectedCortex: { factsExtracted: 1 },
    },
    {
      role: "user",
      content: "[Agent: Claude] Write taglines for our brand",
      cortexAction: "SWITCH_AGENT + RECALL_FROM_HIVE",
      expectedCortex: { memoriesRecalled: 1 },
    },
    {
      role: "assistant",
      content:
        '[Claude] Based on GPT-4\'s modern blue logo design, here are taglines that match:\n1. "Innovation in Blue"\n2. "Modern Solutions, Classic Trust"\n3. "Your Future, Designed Today"',
      cortexAction: "RECALLED_GPT4_MEMORY",
      expectedCortex: { memoriesRecalled: 1 },
    },
    {
      role: "user",
      content: "[Agent: Llama] Research competitors using similar branding",
      cortexAction: "SWITCH_AGENT + RECALL_FROM_HIVE",
    },
    {
      role: "assistant",
      content:
        "[Llama] Analyzing competitors with blue branding and modern design... Based on the logo concept and taglines from the team, here are 3 competitors doing similar work...",
      cortexAction: "RECALLED_TEAM_CONTEXT",
      expectedCortex: { memoriesRecalled: 2 },
    },
  ],
  learningPoints: [
    "Shared memory across multiple agents",
    "Cross-agent context awareness",
    "Hive Mode enables team collaboration",
    "What one agent learns, all know",
  ],
};
```

---

## Scenario Loader Component

**File**: `src/lib/components/cortex/ScenarioSelector.svelte`

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { scenarios } from '$lib/scenarios/definitions';

  const dispatch = createEventDispatcher();

  let selectedScenario = '';

  function loadScenario() {
    const scenario = scenarios.find(s => s.id === selectedScenario);
    if (scenario) {
      dispatch('load', scenario);
    }
  }
</script>

<div class="scenario-selector">
  <label for="scenario">Load Pre-Built Scenario:</label>
  <select bind:value={selectedScenario} id="scenario">
    <option value="">-- Select Scenario --</option>
    {#each scenarios as scenario}
      <option value={scenario.id}>
        {scenario.name} (Category {scenario.category})
      </option>
    {/each}
  </select>

  <button
    on:click={loadScenario}
    disabled={!selectedScenario}
  >
    Load Scenario
  </button>
</div>

<style>
  .scenario-selector {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 1rem;
    background: #f7fafc;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  select, button {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

---

## Scenario Execution

When scenario is loaded:

1. **Clear chat** (optional)
2. **Execute messages** one by one with delays
3. **Highlight Cortex actions** as they happen
4. **Show expected vs actual** Cortex metadata
5. **Allow continuation** after scenario completes

**Implementation**:

```typescript
async function executeScenario(scenario: Scenario) {
  for (const message of scenario.messages) {
    // Show user message
    if (message.role === "user") {
      await sendMessage(message.content);
    }

    // Highlight what Cortex is doing
    if (message.cortexAction) {
      showCortexAction(message.cortexAction);
    }

    // Delay for readability
    await sleep(2000);

    // Verify expected Cortex behavior
    if (message.expectedCortex) {
      verifyExpectedBehavior(message.expectedCortex, actualCortexData);
    }
  }

  // Show learning points
  displayLearningPoints(scenario.learningPoints);
}
```

---

## Visual Scenario Execution

During scenario playback:

```
┌────────────────────────────────────────┐
│ Running: Personal Assistant Scenario   │
│ Step 2 of 6                            │
├────────────────────────────────────────┤
│ 💬 User: "I prefer TypeScript..."     │
│                                        │
│ 🧠 Cortex Action: STORING MEMORY      │
│    └─ Extracting facts...             │
│    └─ Generating embeddings...        │
│    ✓ Stored: mem_abc123               │
│    ✓ Facts: 1 extracted               │
│                                        │
│ 🤖 Assistant: "Great choice!..."      │
│    🧠 0 memories recalled              │
│    💡 1 fact extracted                │
│                                        │
│ [Next Step] [Pause] [Skip to End]     │
└────────────────────────────────────────┘
```

---

## Learning Points Display

After scenario completes:

```svelte
<div class="learning-summary">
  <h3>What You Just Saw:</h3>
  <ul>
    {#each scenario.learningPoints as point}
      <li>✓ {point}</li>
    {/each}
  </ul>

  <div class="continue-options">
    <button>Try Another Scenario</button>
    <button>Continue Chatting</button>
    <button>View Code</button>
  </div>
</div>
```

---

## All 5 Scenarios Summary

| Scenario           | Category | Key Features           | Duration |
| ------------------ | -------- | ---------------------- | -------- |
| Personal Assistant | A        | Memory, Search, Recall | 2 min    |
| Customer Support   | B        | User Profiles, GDPR    | 3 min    |
| Context Chains     | B        | Hierarchical Contexts  | 3 min    |
| Facts Extraction   | B        | Knowledge Base         | 2 min    |
| Multi-Agent Hive   | C        | Agent Collaboration    | 4 min    |

**Total Demonstration Time**: ~14 minutes to see all features

---

## Next Steps

- **Troubleshooting** → [11-TROUBLESHOOTING.md](11-TROUBLESHOOTING.md)
- **Back to Overview** → [00-PROJECT-OVERVIEW.md](00-PROJECT-OVERVIEW.md)
