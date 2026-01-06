/**
 * Cortex CLI Types
 */

/**
 * Output format options
 */
export type OutputFormat = "table" | "json" | "csv";

/**
 * Template app types
 */
export type AppType = "basic" | "vercel-ai-quickstart";

/**
 * Configuration for an installed template app
 */
export interface AppConfig {
  /** Type of template app */
  type: AppType;
  /** Relative path from project root (e.g., "quickstart") */
  path: string;
  /** Absolute path to the project root where this app was installed */
  projectPath: string;
  /** Whether this app should be started with `cortex start` */
  enabled: boolean;
  /** Port for the dev server (default varies by app type) */
  port?: number;
  /** Start command (default: "npm run dev") */
  startCommand?: string;
}

/**
 * CLI configuration stored in ~/.cortexrc or ./cortex.config.json
 */
export interface CLIConfig {
  deployments: Record<string, DeploymentConfig>;
  /** Installed template apps (e.g., vercel-ai-quickstart) */
  apps?: Record<string, AppConfig>;
  default: string;
  format: OutputFormat;
  confirmDangerous: boolean;
}

/**
 * Configuration for a single deployment
 */
export interface DeploymentConfig {
  url: string;
  key?: string;
  deployment?: string;
  /**
   * Path to the project directory for this deployment.
   * Allows running `cortex start -d <name>` from anywhere.
   * Not needed for remote-only deployments (e.g., Vercel).
   */
  projectPath?: string;
  /**
   * Whether this deployment should be started with `cortex start`.
   * Defaults to true for the default deployment, false for others.
   */
  enabled?: boolean;
}

/**
 * Global CLI options that can be passed to any command
 */
export interface GlobalOptions {
  deployment?: string;
  url?: string;
  key?: string;
  format?: OutputFormat;
  quiet?: boolean;
  debug?: boolean;
}

/**
 * Memory space types
 */
export type MemorySpaceType = "personal" | "team" | "project" | "custom";

/**
 * Memory space status
 */
export type MemorySpaceStatus = "active" | "archived";

/**
 * Fact types
 */
export type FactType =
  | "preference"
  | "identity"
  | "knowledge"
  | "relationship"
  | "event"
  | "observation"
  | "custom";

/**
 * Source types for memories
 */
export type SourceType =
  | "conversation"
  | "system"
  | "tool"
  | "a2a"
  | "fact-extraction";

/**
 * Statistics result for memory spaces
 */
export interface SpaceStats {
  memorySpaceId: string;
  conversationCount: number;
  memoryCount: number;
  factCount: number;
  participantCount: number;
  lastActivity?: number;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  memorySpaces: number;
  conversations: number;
  memories: number;
  facts: number;
  users: number;
  immutableRecords: number;
  mutableRecords: number;
  contexts: number;
}

/**
 * Backup data structure
 */
export interface BackupData {
  version: string;
  timestamp: number;
  deployment: string;
  data: {
    memorySpaces?: unknown[];
    conversations?: unknown[];
    memories?: unknown[];
    facts?: unknown[];
    users?: unknown[];
    immutable?: unknown[];
    mutable?: unknown[];
    contexts?: unknown[];
  };
}

/**
 * Result of a delete operation
 */
export interface DeleteResult {
  deleted: boolean;
  count: number;
  ids: string[];
}

/**
 * Result of a cascade deletion
 */
export interface CascadeDeleteResult {
  deleted: boolean;
  memoriesDeleted: number;
  conversationsDeleted: number;
  factsDeleted: number;
  contextsDeleted: number;
  totalDeleted: number;
}

/**
 * User delete result with GDPR cascade
 */
export interface UserDeleteResult {
  userId: string;
  deletedAt: number;
  conversationsDeleted: number;
  conversationMessagesDeleted: number;
  immutableRecordsDeleted: number;
  mutableKeysDeleted: number;
  vectorMemoriesDeleted: number;
  factsDeleted: number;
  graphNodesDeleted?: number;
  verification: {
    complete: boolean;
    issues: string[];
  };
  totalDeleted: number;
  deletedLayers: string[];
}

/**
 * Command handler context
 */
export interface CommandContext {
  config: CLIConfig;
  convexUrl: string;
  convexKey?: string;
  format: OutputFormat;
  quiet: boolean;
  debug: boolean;
}
