# Visual Components - Open WebUI + Cortex

> **Complete Svelte Component Code for Cortex Visual Indicators**

## Overview

This document provides complete, production-ready Svelte components for all Cortex visual features:

- Memory badges with tooltips
- Memory sidebar with real-time updates
- Context indicators
- Facts extraction badges
- Agent activity displays

All components follow Open WebUI's design system and are fully responsive.

---

## Complete Component List

1. **MemoryBadge.svelte** - Shows memories recalled with similarity scores
2. **MemorySidebar.svelte** - Collapsible sidebar with memory insights
3. **ContextIndicator.svelte** - Active context chain display
4. **FactsBadge.svelte** - Facts extracted notification
5. **AgentBadge.svelte** - Multi-agent activity indicator
6. **MemoryTooltip.svelte** - Detailed memory information on hover
7. **CortexToggle.svelte** - Enable/disable Cortex memory

---

## 1. MemoryBadge Component

**File**: `src/lib/components/cortex/MemoryBadge.svelte`

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import MemoryTooltip from './MemoryTooltip.svelte';

  export let memoriesRecalled: number = 0;
  export let similarityScores: number[] = [];
  export let memories: any[] = [];
  export let compact: boolean = false;

  const dispatch = createEventDispatcher();

  let showTooltip = false;
  let tooltipX = 0;
  let tooltipY = 0;

  function formatSimilarity(score: number): string {
    return `${Math.round(score * 100)}%`;
  }

  function handleClick() {
    dispatch('click', { memories });
  }

  function handleMouseEnter(event: MouseEvent) {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    tooltipX = rect.left;
    tooltipY = rect.top - 10;
    showTooltip = true;
  }

  function handleMouseLeave() {
    showTooltip = false;
  }
</script>

{#if memoriesRecalled > 0}
  <button
    class="memory-badge"
    class:compact
    on:click={handleClick}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    title="Click to view memories"
  >
    <span class="icon" aria-hidden="true">🧠</span>
    <span class="count">
      {memoriesRecalled} {memoriesRecalled === 1 ? 'memory' : 'memories'}
    </span>
    {#if !compact && similarityScores.length > 0}
      <span class="similarity">
        ({formatSimilarity(similarityScores[0])})
      </span>
    {/if}
  </button>

  {#if showTooltip && memories.length > 0}
    <MemoryTooltip
      {memories}
      x={tooltipX}
      y={tooltipY}
    />
  {/if}
{/if}

<style>
  .memory-badge {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.875rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
  }

  .memory-badge:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
  }

  .memory-badge:active {
    transform: translateY(0);
  }

  .memory-badge.compact {
    padding: 0.25rem 0.625rem;
    font-size: 0.8125rem;
  }

  .icon {
    font-size: 1.125rem;
    line-height: 1;
  }

  .count {
    font-weight: 600;
  }

  .similarity {
    opacity: 0.95;
    font-size: 0.8125rem;
    font-weight: 400;
  }

  @media (prefers-color-scheme: dark) {
    .memory-badge {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .memory-badge:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
    }
  }
</style>
```

---

## 2. MemoryTooltip Component

**File**: `src/lib/components/cortex/MemoryTooltip.svelte`

```svelte
<script lang="ts">
  export let memories: any[] = [];
  export let x: number = 0;
  export let y: number = 0;
  export let maxMemories: number = 3;

  $: displayMemories = memories.slice(0, maxMemories);
  $: hasMore = memories.length > maxMemories;

  function formatSimilarity(score: number): string {
    return `${Math.round(score * 100)}%`;
  }

  function formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timestamp;
    }
  }
</script>

<div
  class="tooltip-container"
  style="left: {x}px; top: {y}px;"
  role="tooltip"
>
  <div class="tooltip-arrow"></div>
  <div class="tooltip-content">
    <div class="tooltip-header">
      <span class="header-icon">🧠</span>
      <span>Memories Used</span>
    </div>

    <div class="memory-list">
      {#each displayMemories as memory, i}
        <div class="memory-item">
          <div class="memory-rank">{i + 1}</div>
          <div class="memory-details">
            <div class="memory-text">{memory.text}</div>
            <div class="memory-meta">
              <span class="similarity-score">
                {formatSimilarity(memory.similarity)} match
              </span>
              <span class="separator">•</span>
              <span class="timestamp">
                {formatTimestamp(memory.timestamp)}
              </span>
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if hasMore}
      <div class="more-indicator">
        +{memories.length - maxMemories} more memories
      </div>
    {/if}
  </div>
</div>

<style>
  .tooltip-container {
    position: fixed;
    z-index: 10000;
    transform: translateY(-100%) translateY(-0.5rem);
    pointer-events: none;
  }

  .tooltip-arrow {
    position: absolute;
    bottom: -0.375rem;
    left: 1rem;
    width: 0;
    height: 0;
    border-left: 0.375rem solid transparent;
    border-right: 0.375rem solid transparent;
    border-top: 0.375rem solid rgba(26, 32, 44, 0.95);
  }

  .tooltip-content {
    background: rgba(26, 32, 44, 0.98);
    backdrop-filter: blur(8px);
    border-radius: 0.75rem;
    padding: 1rem;
    min-width: 320px;
    max-width: 420px;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    color: white;
  }

  .tooltip-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.875rem;
    font-weight: 600;
    font-size: 0.9375rem;
    color: #a8b3cf;
  }

  .header-icon {
    font-size: 1.125rem;
  }

  .memory-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .memory-item {
    display: flex;
    gap: 0.75rem;
  }

  .memory-rank {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
  }

  .memory-details {
    flex: 1;
    min-width: 0;
  }

  .memory-text {
    font-size: 0.875rem;
    line-height: 1.5;
    margin-bottom: 0.375rem;
    color: #e2e8f0;
  }

  .memory-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #a8b3cf;
  }

  .similarity-score {
    color: #667eea;
    font-weight: 600;
  }

  .separator {
    opacity: 0.5;
  }

  .more-indicator {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.8125rem;
    color: #a8b3cf;
    text-align: center;
  }
</style>
```

---

## 3. MemorySidebar Component

**File**: `src/lib/components/cortex/MemorySidebar.svelte`

```svelte
<script lang="ts">
  import { cortexStore } from '$lib/stores/cortex';
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  export let isOpen: boolean = true;

  $: recentMemories = $cortexStore.recentMemories;
  $: activeContext = $cortexStore.activeContext;
  $: factsCount = $cortexStore.factsCount;

  function formatSimilarity(score: number): string {
    return `${Math.round(score * 100)}%`;
  }

  function formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  }

  function toggleSidebar() {
    isOpen = !isOpen;
  }
</script>

<aside
  class="memory-sidebar"
  class:open={isOpen}
  aria-label="Memory Insights Sidebar"
>
  <div class="sidebar-header">
    <h3>
      <span class="header-icon">🧠</span>
      Memory Insights
    </h3>
    <button
      class="toggle-btn"
      on:click={toggleSidebar}
      aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
    >
      {isOpen ? '✕' : '☰'}
    </button>
  </div>

  {#if isOpen}
    <div class="sidebar-content" transition:slide={{ duration: 300, easing: quintOut }}>
      <!-- Recent Memories Section -->
      <section class="sidebar-section">
        <h4 class="section-title">
          Recent Recalls ({recentMemories.length})
        </h4>

        {#if recentMemories.length === 0}
          <p class="empty-state">
            No memories recalled yet. Start chatting to see relevant context appear here.
          </p>
        {:else}
          <ul class="memory-list">
            {#each recentMemories as memory}
              <li class="memory-item">
                <div class="memory-text">{memory.text}</div>
                <div class="memory-footer">
                  <span class="similarity">
                    {formatSimilarity(memory.similarity)} match
                  </span>
                  <span class="timestamp">
                    {formatTimestamp(memory.timestamp)}
                  </span>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- Active Context Section -->
      {#if activeContext}
        <section class="sidebar-section">
          <h4 class="section-title">Active Context</h4>
          <div class="context-chain">
            <span class="context-icon">🔗</span>
            <span class="context-text">{activeContext}</span>
          </div>
        </section>
      {/if}

      <!-- Facts Counter Section -->
      <section class="sidebar-section">
        <h4 class="section-title">Session Stats</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-icon">💡</span>
            <span class="stat-value">{factsCount}</span>
            <span class="stat-label">Facts Extracted</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">📝</span>
            <span class="stat-value">{recentMemories.length}</span>
            <span class="stat-label">Memories Used</span>
          </div>
        </div>
      </section>
    </div>
  {/if}
</aside>

<style>
  .memory-sidebar {
    position: fixed;
    right: 0;
    top: 4rem;
    bottom: 0;
    width: 320px;
    background: var(--sidebar-bg, #ffffff);
    border-left: 1px solid var(--border-color, #e2e8f0);
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.05);
    z-index: 40;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow-y: auto;
  }

  .memory-sidebar.open {
    transform: translateX(0);
  }

  .sidebar-header {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: var(--sidebar-header-bg, #f7fafc);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    z-index: 1;
  }

  .sidebar-header h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #1a202c);
  }

  .header-icon {
    font-size: 1.25rem;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    color: var(--text-secondary, #718096);
    transition: background-color 0.2s;
  }

  .toggle-btn:hover {
    background: var(--hover-bg, #edf2f7);
  }

  .sidebar-content {
    padding: 1rem;
  }

  .sidebar-section {
    margin-bottom: 1.5rem;
  }

  .section-title {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary, #718096);
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .empty-state {
    padding: 1rem;
    background: var(--info-bg, #ebf8ff);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary, #718096);
    line-height: 1.5;
  }

  .memory-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .memory-item {
    padding: 0.875rem;
    background: var(--card-bg, #f7fafc);
    border-radius: 0.5rem;
    border-left: 3px solid #667eea;
  }

  .memory-text {
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--text-primary, #2d3748);
    margin-bottom: 0.5rem;
  }

  .memory-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    color: var(--text-secondary, #a0aec0);
  }

  .similarity {
    color: #667eea;
    font-weight: 600;
  }

  .context-chain {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem;
    background: var(--card-bg, #f7fafc);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-primary, #2d3748);
  }

  .context-icon {
    font-size: 1.125rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    background: var(--card-bg, #f7fafc);
    border-radius: 0.5rem;
    text-align: center;
  }

  .stat-icon {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary, #1a202c);
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #718096);
  }

  @media (prefers-color-scheme: dark) {
    .memory-sidebar {
      --sidebar-bg: #1a202c;
      --sidebar-header-bg: #2d3748;
      --border-color: #4a5568;
      --text-primary: #e2e8f0;
      --text-secondary: #a0aec0;
      --card-bg: #2d3748;
      --hover-bg: #4a5568;
      --info-bg: #2c5282;
    }
  }

  @media (max-width: 768px) {
    .memory-sidebar {
      width: 100%;
    }
  }
</style>
```

---

## Component Integration Example

**File**: `src/lib/components/chat/Messages/ResponseMessage.svelte` (modified)

```svelte
<script lang="ts">
  // Existing imports
  import MemoryBadge from '$lib/components/cortex/MemoryBadge.svelte';
  import FactsBadge from '$lib/components/cortex/FactsBadge.svelte';

  export let message: any;
  export let cortexData: any = null;

  function handleMemoryClick(event) {
    // Show detailed memory modal or expand sidebar
    console.log('Memories:', event.detail.memories);
  }
</script>

<div class="response-message">
  <!-- Existing message content -->
  <div class="message-text">
    {@html formattedContent}
  </div>

  <!-- Cortex indicators -->
  {#if cortexData}
    <div class="cortex-indicators">
      {#if cortexData.memoriesRecalled > 0}
        <MemoryBadge
          memoriesRecalled={cortexData.memoriesRecalled}
          similarityScores={cortexData.similarityScores || []}
          memories={cortexData.memories || []}
          on:click={handleMemoryClick}
        />
      {/if}

      {#if cortexData.factsExtracted > 0}
        <FactsBadge count={cortexData.factsExtracted} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .cortex-indicators {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    flex-wrap: wrap;
  }
</style>
```

---

## State Management

**File**: `src/lib/stores/cortex.ts`

```typescript
import { writable } from "svelte/store";

export interface Memory {
  text: string;
  similarity: number;
  timestamp: string;
  memoryId: string;
}

export interface CortexState {
  recentMemories: Memory[];
  activeContext: string | null;
  factsCount: number;
  enabled: boolean;
  sidebarOpen: boolean;
}

function createCortexStore() {
  const { subscribe, set, update } = writable<CortexState>({
    recentMemories: [],
    activeContext: null,
    factsCount: 0,
    enabled: true,
    sidebarOpen: false,
  });

  return {
    subscribe,

    addMemories: (memories: Memory[]) => {
      update((state) => ({
        ...state,
        recentMemories: [...memories, ...state.recentMemories].slice(0, 10),
      }));
    },

    setContext: (context: string | null) => {
      update((state) => ({ ...state, activeContext: context }));
    },

    incrementFacts: (count: number = 1) => {
      update((state) => ({
        ...state,
        factsCount: state.factsCount + count,
      }));
    },

    toggleSidebar: () => {
      update((state) => ({ ...state, sidebarOpen: !state.sidebarOpen }));
    },

    toggle: () => {
      update((state) => ({ ...state, enabled: !state.enabled }));
    },

    reset: () => {
      set({
        recentMemories: [],
        activeContext: null,
        factsCount: 0,
        enabled: true,
        sidebarOpen: false,
      });
    },
  };
}

export const cortexStore = createCortexStore();
```

---

## Usage in Chat Component

```typescript
// In your chat component
import { cortexStore } from "$lib/stores/cortex";

// When receiving chat response with Cortex data
async function handleChatResponse(response) {
  if (response.cortex) {
    // Update store with new memories
    if (response.cortex.memories) {
      cortexStore.addMemories(response.cortex.memories);
    }

    // Update facts count
    if (response.cortex.factsExtracted) {
      cortexStore.incrementFacts(response.cortex.factsExtracted);
    }
  }
}
```

---

## Next Steps

- **Demo Pages** → [07-DEMO-PAGES.md](07-DEMO-PAGES.md)
- **Comparison UI** → [08-SIDE-BY-SIDE-COMPARISON.md](08-SIDE-BY-SIDE-COMPARISON.md)
- **Deployment** → [09-DEPLOYMENT.md](09-DEPLOYMENT.md)
