/**
 * Types for create-cortex-memories wizard
 */

export interface WizardConfig {
  projectName: string;
  projectPath: string;
  installationType: 'new' | 'existing';
  convexSetupType: 'new' | 'existing' | 'local';
  convexUrl?: string;
  deployKey?: string;
  graphEnabled: boolean;
  graphType?: 'neo4j' | 'memgraph' | 'skip';
  graphUri?: string;
  graphUsername?: string;
  graphPassword?: string;
}

export interface ConvexConfig {
  convexUrl: string;
  deployKey?: string;
  deployment?: string;
}

export interface GraphConfig {
  type: 'neo4j' | 'memgraph';
  uri: string;
  username: string;
  password: string;
}

