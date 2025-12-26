/**
 * Types for the init wizard
 */

/**
 * Configuration collected by the wizard
 */
export interface WizardConfig {
  projectName: string;
  projectPath: string;
  installationType: "new" | "existing";
  convexSetupType: "new" | "existing" | "local";
  convexUrl?: string;
  deployKey?: string;
  /** Convex team slug (from login status) */
  teamSlug?: string;
  /** Sanitized project name for Convex (max 60 chars) */
  sanitizedProjectName?: string;
  graphEnabled: boolean;
  graphType?: "neo4j" | "memgraph" | "skip";
  graphUri?: string;
  graphUsername?: string;
  graphPassword?: string;
  installCLI?: boolean;
  openaiApiKey?: string;
}

/**
 * Convex deployment configuration
 */
export interface ConvexConfig {
  convexUrl: string;
  deployKey?: string;
  deployment?: string;
}

/**
 * Graph database configuration
 */
export interface GraphConfig {
  type: "neo4j" | "memgraph";
  uri: string;
  username: string;
  password: string;
}

/**
 * Status of a setup component
 */
export type SetupStatus = "ok" | "warning" | "error" | "not_configured";

/**
 * Status dashboard data
 */
export interface StatusDashboard {
  environment: {
    convexUrl: string | null;
    convexDeployKey: boolean;
    neo4jUri: string | null;
    openaiKey: boolean;
  };
  convexBackend: {
    status: SetupStatus;
    message: string;
    functionCount?: number;
  };
  graphDatabase: {
    status: SetupStatus;
    message: string;
    type?: string;
  };
  sdkVersion: {
    current: string | null;
    latest: string | null;
    upToDate: boolean;
  };
  connection: {
    status: SetupStatus;
    latency?: number;
    error?: string;
  };
}
