# Demo Pages - Open WebUI + Cortex

> **Interactive Feature Demonstrations**

Complete implementation guide for all 5 Cortex feature demo pages.

## Overview

Each demo page provides an interactive showcase of specific Cortex capabilities. Users can:

- Experience features hands-on
- See visual feedback in real-time
- Understand when to use each feature
- Copy implementation patterns

## Demo Pages Structure

```
src/routes/cortex/demos/
├── memory/+page.svelte           # Memory storage & search
├── contexts/+page.svelte          # Context chains
├── facts/+page.svelte             # Facts extraction
├── agents/+page.svelte            # Multi-agent Hive
└── metrics/+page.svelte           # Before/after comparison
```

---

## 1. Memory Demo Page

**Route**: `/cortex/demos/memory`  
**File**: `src/routes/cortex/demos/memory/+page.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let chatMessages = [];
  let searchQuery = '';
  let searchResults = [];
  let isSearching = false;

  async function sendMessage(message: string) {
    // Call chat API with Cortex enabled
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, enable_memory: true })
    });

    const data = await response.json();

    chatMessages = [
      ...chatMessages,
      { role: 'user', content: message },
      { role: 'assistant', content: data.text, cortex: data.cortex }
    ];
  }

  async function searchMemories() {
    isSearching = true;
    const response = await fetch('/api/cortex/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery, limit: 10 })
    });
    searchResults = await response.json();
    isSearching = false;
  }

  // Pre-populate with example scenario
  onMount(() => {
    // Load "Personal Assistant" scenario
  });
</script>

<div class="demo-page">
  <header class="demo-header">
    <h1>Memory Demo</h1>
    <p>Chat naturally and watch memories accumulate. Search semantically to see relevant recalls.</p>
  </header>

  <div class="demo-layout">
    <!-- Chat Section -->
    <section class="chat-section">
      <div class="messages">
        {#each chatMessages as message}
          <div class="message message-{message.role}">
            <div class="message-content">{message.content}</div>
            {#if message.cortex}
              <div class="cortex-info">
                🧠 {message.cortex.memoriesRecalled || 0} memories recalled
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <form on:submit|preventDefault={() => sendMessage(inputText)}>
        <input bind:value={inputText} placeholder="Type a message..." />
        <button type="submit">Send</button>
      </form>
    </section>

    <!-- Memory Panel -->
    <aside class="memory-panel">
      <h2>Memory Search</h2>

      <div class="search-box">
        <input bind:value={searchQuery} placeholder="Search memories..." />
        <button on:click={searchMemories} disabled={isSearching}>
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {#if searchResults.length > 0}
        <div class="results">
          <h3>Results ({searchResults.length})</h3>
          {#each searchResults as result}
            <div class="result-item">
              <div class="result-text">{result.text}</div>
              <div class="result-score">
                {Math.round(result.similarity * 100)}% similarity
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <div class="memory-timeline">
        <h3>Memory Timeline</h3>
        <!-- Visual timeline of stored memories -->
      </div>
    </aside>
  </div>
</div>

<style>
  .demo-page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  .demo-layout {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 2rem;
    margin-top: 2rem;
  }

  .chat-section {
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .memory-panel {
    background: #f7fafc;
    border-radius: 0.5rem;
    padding: 1.5rem;
  }
</style>
```

---

## 2. Context Chains Demo

**Route**: `/cortex/demos/contexts`  
**Features**:

- Visual tree navigation
- Create/delete contexts
- Switch active context
- See hierarchical memory scope

**Key Components**:

```svelte
<script>
  let contextTree = {
    id: 'root',
    name: 'Website Redesign',
    children: [
      {
        id: 'homepage',
        name: 'Homepage',
        children: [
          { id: 'hero', name: 'Hero Section' }
        ]
      }
    ]
  };

  let activeContext = 'hero';
</script>

<div class="context-tree">
  <TreeView bind:tree={contextTree} bind:active={activeContext} />
</div>

<div class="context-chat">
  <p>Active: {activeContext}</p>
  <Chat contextId={activeContext} />
</div>
```

---

## 3. Facts Extraction Demo

**Route**: `/cortex/demos/facts`  
**Features**:

- Real-time fact extraction visualization
- Query extracted facts
- Storage savings metrics

**Visual Elements**:

- Animated fact extraction notifications
- Facts database view
- Storage comparison chart

---

## 4. Multi-Agent Demo

**Route**: `/cortex/demos/agents`  
**Features**:

- Register multiple agents
- Hive Mode memory sharing
- Agent activity log
- Cross-agent context awareness

**Agent Registry**:

```svelte
<script>
  let agents = [
    { id: 'gpt-4', name: 'GPT-4', role: 'Designer', active: true },
    { id: 'claude', name: 'Claude', role: 'Writer', active: true },
    { id: 'llama', name: 'Llama', role: 'Researcher', active: true }
  ];

  let selectedAgent = 'gpt-4';
  let sharedMemories = [];
</script>

<div class="agent-panel">
  {#each agents as agent}
    <button on:click={() => selectedAgent = agent.id}>
      {agent.name} ({agent.role})
    </button>
  {/each}
</div>

<div class="hive-activity">
  <h3>Shared Memories ({sharedMemories.length})</h3>
  <!-- Show cross-agent memory access -->
</div>
```

---

## 5. Comparison Metrics Dashboard

**Route**: `/cortex/demos/metrics`  
**Features**:

- Search relevance comparison charts
- Context retention metrics
- Storage efficiency graphs
- Side-by-side quality examples

**Charts**:

- Before/After bar charts
- Storage savings pie chart
- Response quality examples

---

## Navigation Menu

**Add to**: `src/lib/components/layout/Sidebar.svelte`

```svelte
<nav>
  <div class="nav-section">
    <h3>Cortex Demos</h3>
    <a href="/cortex/demos/memory">Memory</a>
    <a href="/cortex/demos/contexts">Context Chains</a>
    <a href="/cortex/demos/facts">Facts Extraction</a>
    <a href="/cortex/demos/agents">Multi-Agent</a>
    <a href="/cortex/demos/metrics">Metrics</a>
  </div>
</nav>
```

---

## Shared Components

**File**: `src/lib/components/demos/DemoLayout.svelte`

```svelte
<script>
  export let title = '';
  export let description = '';
</script>

<div class="demo-wrapper">
  <header>
    <h1>{title}</h1>
    <p>{description}</p>
  </header>

  <main>
    <slot />
  </main>
</div>

<style>
  .demo-wrapper {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }
</style>
```

---

## Next Steps

- **Comparison UI** → [08-SIDE-BY-SIDE-COMPARISON.md](08-SIDE-BY-SIDE-COMPARISON.md)
- **Deployment** → [09-DEPLOYMENT.md](09-DEPLOYMENT.md)
- **Scenarios** → [10-USAGE-SCENARIOS.md](10-USAGE-SCENARIOS.md)
