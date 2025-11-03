# Side-by-Side Comparison - Open WebUI + Cortex

> **Split-Screen Visual Proof of Cortex Impact**

## Overview

The side-by-side comparison provides the most compelling visual proof: same conversation, same question, dramatically different results.

**Left**: Open WebUI without Cortex  
**Right**: Open WebUI with Cortex

Users immediately see the value of memory integration.

---

## Component Architecture

**File**: `src/lib/components/cortex/ComparisonView.svelte`

```svelte
<script lang="ts">
  import { writable } from 'svelte/store';

  // Dual chat states
  let leftMessages = [];  // Without Cortex
  let rightMessages = []; // With Cortex

  let inputMessage = '';
  let isSending = false;

  async function sendToComparison() {
    if (!inputMessage.trim() || isSending) return;

    isSending = true;
    const message = inputMessage;
    inputMessage = '';

    // Send to both sides simultaneously
    const [leftResponse, rightResponse] = await Promise.all([
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          enable_memory: false  // Left side: NO Cortex
        })
      }),
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          enable_memory: true   // Right side: WITH Cortex
        })
      })
    ]);

    const leftData = await leftResponse.json();
    const rightData = await rightResponse.json();

    // Update both chats
    leftMessages = [
      ...leftMessages,
      { role: 'user', content: message },
      { role: 'assistant', content: leftData.text }
    ];

    rightMessages = [
      ...rightMessages,
      { role: 'user', content: message },
      { role: 'assistant', content: rightData.text, cortex: rightData.cortex }
    ];

    isSending = false;
  }
</script>

<div class="comparison-container">
  <div class="comparison-header">
    <h2>Before & After Cortex</h2>
    <p>Same question, dramatically different results</p>
  </div>

  <div class="split-view">
    <!-- LEFT: Without Cortex -->
    <div class="chat-panel left-panel">
      <div class="panel-header">
        <h3>❌ Without Cortex</h3>
        <span class="subtitle">Standard Open WebUI</span>
      </div>

      <div class="messages-container">
        {#each leftMessages as message}
          <div class="message message-{message.role}">
            <div class="message-content">{message.content}</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- RIGHT: With Cortex -->
    <div class="chat-panel right-panel">
      <div class="panel-header cortex-enabled">
        <h3>✅ With Cortex Memory</h3>
        <span class="subtitle">Context-aware responses</span>
      </div>

      <div class="messages-container">
        {#each rightMessages as message}
          <div class="message message-{message.role}">
            <div class="message-content">{message.content}</div>

            {#if message.cortex}
              <div class="cortex-indicator">
                🧠 {message.cortex.memoriesRecalled} memories used
                • {Math.round(message.cortex.similarityScores?.[0] * 100)}% match
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Shared Input -->
  <div class="shared-input">
    <form on:submit|preventDefault={sendToComparison}>
      <input
        bind:value={inputMessage}
        placeholder="Type a message to send to both..."
        disabled={isSending}
      />
      <button type="submit" disabled={isSending}>
        {isSending ? 'Sending...' : 'Send to Both'}
      </button>
    </form>
  </div>

  <!-- Difference Highlights -->
  {#if leftMessages.length > 0}
    <div class="insights-panel">
      <h4>Key Differences</h4>
      <ul>
        <li>✅ Contextual awareness from {rightMessages[rightMessages.length - 1]?.cortex?.memoriesRecalled || 0} memories</li>
        <li>✅ Personalized response based on conversation history</li>
        <li>❌ Left side has no context from previous chats</li>
      </ul>
    </div>
  {/if}
</div>

<style>
  .comparison-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 2rem;
  }

  .comparison-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .split-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .chat-panel {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 600px;
  }

  .panel-header {
    padding: 1.5rem;
    background: #f7fafc;
    border-bottom: 2px solid #e2e8f0;
  }

  .panel-header.cortex-enabled {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .panel-header h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.125rem;
  }

  .subtitle {
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .message {
    margin-bottom: 1rem;
    padding: 1rem;
    border-radius: 0.5rem;
  }

  .message-user {
    background: #edf2f7;
    margin-left: auto;
    max-width: 80%;
  }

  .message-assistant {
    background: #f7fafc;
    max-width: 80%;
  }

  .cortex-indicator {
    margin-top: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .shared-input {
    background: white;
    padding: 1.5rem;
    border-radius: 0.75rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
  }

  .shared-input form {
    display: flex;
    gap: 1rem;
  }

  .shared-input input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 1rem;
  }

  .shared-input button {
    padding: 0.75rem 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .shared-input button:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .shared-input button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .insights-panel {
    background: #f0fdf4;
    padding: 1.5rem;
    border-radius: 0.75rem;
    border-left: 4px solid #10b981;
  }

  .insights-panel h4 {
    margin: 0 0 1rem 0;
    color: #065f46;
  }

  .insights-panel ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .insights-panel li {
    padding: 0.5rem 0;
    color: #047857;
  }

  @media (max-width: 1024px) {
    .split-view {
      grid-template-columns: 1fr;
    }
  }
</style>
```

---

## Integration into Routes

**File**: `src/routes/cortex/compare/+page.svelte`

```svelte
<script>
  import ComparisonView from '$lib/components/cortex/ComparisonView.svelte';
</script>

<svelte:head>
  <title>Before & After Cortex - Comparison</title>
</svelte:head>

<ComparisonView />
```

---

## Toggle in Main Chat

Add comparison mode toggle to regular chat:

```svelte
<!-- In Chat.svelte -->
<script>
  let comparisonMode = false;
</script>

<button on:click={() => comparisonMode = !comparisonMode}>
  {comparisonMode ? 'Exit' : 'Enter'} Comparison Mode
</button>

{#if comparisonMode}
  <ComparisonView />
{:else}
  <!-- Regular single chat -->
{/if}
```

---

## Pre-Built Comparison Scenarios

**File**: `src/lib/comparison-scenarios.ts`

```typescript
export const comparisonScenarios = [
  {
    id: "personal-assistant",
    name: "Personal Assistant Memory",
    setup: [
      {
        message: "I prefer TypeScript for backend development",
        response: "Noted!",
      },
      { message: "I work on Node.js projects mostly", response: "Understood!" },
    ],
    testQuestion: "What programming language should I use for my new backend?",
    expectedLeft: "Generic recommendation",
    expectedRight: "Personalized recommendation based on TypeScript preference",
  },
  {
    id: "customer-support",
    name: "Customer Support Context",
    setup: [
      { message: "My email is alice@example.com", response: "Saved!" },
      {
        message: "I had an issue with order #12345",
        response: "Looking into it!",
      },
    ],
    testQuestion: "Can you check my recent orders?",
    expectedLeft: "Asks for email and order details",
    expectedRight: "Uses remembered email and order number",
  },
];
```

---

## Key Benefits Shown

1. **Contextual Responses**: Right side uses conversation history
2. **Personalization**: Responses tailored to user preferences
3. **Efficiency**: No need to repeat information
4. **Memory Persistence**: Works across sessions

---

## Next Steps

- **Deployment** → [09-DEPLOYMENT.md](09-DEPLOYMENT.md)
- **Scenarios** → [10-USAGE-SCENARIOS.md](10-USAGE-SCENARIOS.md)
- **Troubleshooting** → [11-TROUBLESHOOTING.md](11-TROUBLESHOOTING.md)
