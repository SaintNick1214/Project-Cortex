/**
 * Rich Console Display
 *
 * Provides beautiful console output showing Cortex's "thinking" process,
 * mirroring the UI visualization from the Vercel AI quickstart.
 */

import type { LayerEvent } from "./cortex.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BOX_WIDTH = 70;

const LAYER_INFO: Record<
  string,
  { icon: string; name: string; description: string }
> = {
  memorySpace: {
    icon: "📦",
    name: "Memory Space",
    description: "Isolated namespace for multi-tenancy",
  },
  user: {
    icon: "👤",
    name: "User",
    description: "User profile and identity",
  },
  agent: {
    icon: "🤖",
    name: "Agent",
    description: "AI agent participant",
  },
  conversation: {
    icon: "💬",
    name: "Conversation",
    description: "Message storage with threading",
  },
  vector: {
    icon: "🎯",
    name: "Vector Store",
    description: "Semantic embeddings for search",
  },
  facts: {
    icon: "💡",
    name: "Facts",
    description: "Extracted structured information",
  },
  graph: {
    icon: "🕸️",
    name: "Graph",
    description: "Entity relationships",
  },
};

const STATUS_SYMBOLS: Record<string, string> = {
  pending: "○",
  in_progress: "◐",
  complete: "✓",
  error: "✗",
  skipped: "○",
};

const REVISION_BADGES: Record<string, string> = {
  ADD: "\x1b[32m[NEW]\x1b[0m",
  UPDATE: "\x1b[34m[UPDATED]\x1b[0m",
  SUPERSEDE: "\x1b[33m[SUPERSEDED]\x1b[0m",
  NONE: "\x1b[90m[DUPLICATE]\x1b[0m",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface LayerState {
  status: string;
  latencyMs?: number;
  data?: Record<string, unknown>;
  revisionAction?: string;
  supersededFacts?: string[];
}

const layerStates: Map<string, LayerState> = new Map();
let orchestrationStartTime = 0;
let isOrchestrating = false;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Box Drawing Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function boxTop(): string {
  return "┌" + "─".repeat(BOX_WIDTH - 2) + "┐";
}

function boxBottom(): string {
  return "└" + "─".repeat(BOX_WIDTH - 2) + "┘";
}

function boxDivider(): string {
  return "├" + "─".repeat(BOX_WIDTH - 2) + "┤";
}

function boxLine(content: string, indent = 0): string {
  const indentStr = " ".repeat(indent);
  const text = indentStr + content;
  const padding = BOX_WIDTH - 4 - text.length;
  // Handle ANSI escape codes by not counting them in padding
  const visibleLength = text.replace(/\x1b\[[0-9;]*m/g, "").length;
  const actualPadding = BOX_WIDTH - 4 - visibleLength;
  return "│  " + text + " ".repeat(Math.max(0, actualPadding)) + "│";
}

function boxEmpty(): string {
  return "│" + " ".repeat(BOX_WIDTH - 2) + "│";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Public API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Print orchestration start header
 */
export function printOrchestrationStart(_orchestrationId: string): void {
  orchestrationStartTime = Date.now();
  isOrchestrating = true;
  layerStates.clear();

  console.log("");
  console.log(boxTop());
  console.log(boxLine("MEMORY ORCHESTRATION"));
  console.log(boxDivider());
}

/**
 * Print a layer update event
 */
export function printLayerUpdate(event: LayerEvent): void {
  const info = LAYER_INFO[event.layer];
  if (!info) return;

  // Store state
  layerStates.set(event.layer, {
    status: event.status,
    latencyMs: event.latencyMs,
    data: event.data,
    revisionAction: event.revisionAction,
    supersededFacts: event.supersededFacts,
  });

  // Only print on complete/error/skipped
  if (event.status === "in_progress") return;

  const symbol = STATUS_SYMBOLS[event.status] || "?";
  const latency = event.latencyMs ? `(${event.latencyMs}ms)` : "";
  const revision =
    event.revisionAction && event.layer === "facts"
      ? " " + REVISION_BADGES[event.revisionAction]
      : "";

  // Layer header
  const header = `${info.icon} ${info.name.padEnd(14)} ${symbol} ${event.status} ${revision} ${latency}`;
  console.log(boxLine(header));

  // Layer details based on data
  if (event.data) {
    printLayerData(event.layer, event.data);
  }

  // Superseded facts (for belief revision)
  if (event.supersededFacts && event.supersededFacts.length > 0) {
    console.log(boxLine("Superseded:", 3));
    for (const fact of event.supersededFacts) {
      console.log(boxLine(`• ${truncate(fact, 50)}`, 5));
    }
  }

  console.log(boxEmpty());
}

/**
 * Print layer-specific data
 */
function printLayerData(layer: string, data: Record<string, unknown>): void {
  switch (layer) {
    case "memorySpace":
      if (data.id) console.log(boxLine(`→ ID: ${data.id}`, 3));
      if (data.isolation) console.log(boxLine(`→ Isolation: ${data.isolation}`, 3));
      break;

    case "user":
      if (data.id) console.log(boxLine(`→ ID: ${data.id}`, 3));
      if (data.name) console.log(boxLine(`→ Name: ${data.name}`, 3));
      break;

    case "agent":
      if (data.id) console.log(boxLine(`→ ID: ${data.id}`, 3));
      if (data.name) console.log(boxLine(`→ Name: ${data.name}`, 3));
      break;

    case "conversation":
      if (data.id) console.log(boxLine(`→ ID: ${data.id}`, 3));
      if (data.messageCount)
        console.log(boxLine(`→ Messages: ${data.messageCount}`, 3));
      if (data.preview)
        console.log(boxLine(`→ "${truncate(String(data.preview), 45)}"`, 3));
      break;

    case "vector":
      if (data.dimensions)
        console.log(boxLine(`→ Embedded with ${data.dimensions} dimensions`, 3));
      if (data.importance)
        console.log(boxLine(`→ Importance: ${data.importance}`, 3));
      break;

    case "facts":
      if (Array.isArray(data.facts) && data.facts.length > 0) {
        console.log(boxLine(`→ Extracted ${data.facts.length} fact(s):`, 3));
        for (const fact of data.facts.slice(0, 3)) {
          const f = fact as { content?: string; factType?: string; confidence?: number };
          const type = f.factType ? ` (${f.factType})` : "";
          const conf = f.confidence ? ` ${f.confidence}%` : "";
          console.log(boxLine(`• "${truncate(f.content || "", 40)}"${type}${conf}`, 5));
        }
        if (data.facts.length > 3) {
          console.log(boxLine(`• ... and ${data.facts.length - 3} more`, 5));
        }
      } else if (data.count) {
        console.log(boxLine(`→ Extracted ${data.count} fact(s)`, 3));
      }
      break;

    case "graph":
      if (data.nodes) console.log(boxLine(`→ Nodes: ${data.nodes}`, 3));
      if (data.edges) console.log(boxLine(`→ Edges: ${data.edges}`, 3));
      break;
  }
}

/**
 * Print orchestration complete summary
 */
export function printOrchestrationComplete(totalMs?: number): void {
  if (!isOrchestrating) return;

  const elapsed = totalMs || Date.now() - orchestrationStartTime;

  console.log(boxDivider());
  console.log(boxLine(`Total: ${elapsed}ms`));
  console.log(boxBottom());
  console.log("");

  isOrchestrating = false;
}

/**
 * Print recall results
 */
export function printRecallResults(
  memories: Array<{ content?: string; importance?: number; source?: string }>,
  facts: Array<{ content?: string; factType?: string; confidence?: number }>,
): void {
  console.log("");
  console.log(boxTop());
  console.log(boxLine("MEMORY RECALL"));
  console.log(boxDivider());

  if (memories.length === 0 && facts.length === 0) {
    console.log(boxLine("No relevant memories found"));
  } else {
    if (memories.length > 0) {
      console.log(boxLine(`🎯 ${memories.length} relevant memories:`));
      for (const mem of memories.slice(0, 5)) {
        const imp = mem.importance ? ` [${mem.importance}]` : "";
        console.log(boxLine(`• ${truncate(mem.content || "", 55)}${imp}`, 3));
      }
      if (memories.length > 5) {
        console.log(boxLine(`... and ${memories.length - 5} more`, 3));
      }
      console.log(boxEmpty());
    }

    if (facts.length > 0) {
      console.log(boxLine(`💡 ${facts.length} known facts:`));
      for (const fact of facts.slice(0, 5)) {
        const type = fact.factType ? ` (${fact.factType})` : "";
        console.log(boxLine(`• ${truncate(fact.content || "", 50)}${type}`, 3));
      }
      if (facts.length > 5) {
        console.log(boxLine(`... and ${facts.length - 5} more`, 3));
      }
    }
  }

  console.log(boxBottom());
  console.log("");
}

/**
 * Print welcome banner
 */
export function printWelcome(mode: "cli" | "server"): void {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                                                                  ║");
  console.log("║   🧠 Cortex Memory - Basic Demo                                  ║");
  console.log("║                                                                  ║");
  console.log("║   Demonstrating memory orchestration without UI                  ║");
  console.log("║                                                                  ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log("");

  if (mode === "cli") {
    console.log("Type a message and press Enter to chat.");
    console.log("Commands: /recall <query>, /facts, /history, /clear, /exit");
    console.log("");
  } else {
    console.log("Server mode - POST /chat with { message, conversationId }");
    console.log("");
  }
}

/**
 * Print error message
 */
export function printError(message: string, error?: Error): void {
  console.log("");
  console.log(`\x1b[31m❌ Error: ${message}\x1b[0m`);
  if (error && process.env.DEBUG === "true") {
    console.log(`\x1b[90m${error.stack}\x1b[0m`);
  }
  console.log("");
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  console.log(`\x1b[36mℹ ${message}\x1b[0m`);
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(`\x1b[32m✓ ${message}\x1b[0m`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
