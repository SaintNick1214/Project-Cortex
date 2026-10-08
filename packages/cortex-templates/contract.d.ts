/** Wire types match cortex-cli/src/utils/templates/contract.ts. No runtime exports. */
export type TemplateId = "basic" | "vercel-ai-quickstart" | "chat-sdk";
export type PackageManager = "npm" | "pnpm";
export interface PayloadFile {
  path: string;
  storagePath?: string;
  kind: "file";
  hash: string;
  bytes: number;
  executable: boolean;
}
export interface CatalogTemplate {
  id: TemplateId;
  version: string;
  payloadHash: string;
  manager: PackageManager;
  schemaVersion: 1;
  apiVersion: 1;
  provenance: string;
  compatibility: { sdk: string; provider?: string; convex: string };
  envNames: string[];
  envExamples?: string[];
  backend: boolean;
  graph: boolean;
  managerMinimum?: string;
  files: PayloadFile[];
}
export interface TemplateCatalog {
  packageName: "@cortexmemory/templates";
  version: string;
  schemaVersion: 1;
  apiVersion: 1;
  templates: CatalogTemplate[];
}
/** Explicit release inputs; source directories are never serialized into the catalog. */
export interface TemplateSource {
  id: TemplateId;
  version: string;
  source: string;
  provenance: string;
  manager: PackageManager;
  envNames: string[];
  envExamples?: string[];
  backend: boolean;
  graph: boolean;
}
export interface AssemblyConfiguration {
  catalogVersion: string;
  templates: TemplateSource[];
}
export interface SourceFileReceipt extends PayloadFile {
  sourceHash: string;
  transformed: boolean;
}
export interface AssemblyReceipt {
  schemaVersion: 1;
  catalogHash: string;
  templates: {
    id: TemplateId;
    version: string;
    provenance: string;
    sourceHash: string;
    payloadHash: string;
    files: SourceFileReceipt[];
  }[];
}
export interface Assembly {
  catalog: TemplateCatalog;
  catalogBytes: Buffer;
  payloads: Map<string, { bytes: Buffer; executable: boolean }>;
  receipt: AssemblyReceipt;
  /** Used only to refuse an output inside an input tree. */
  sourceRoots: string[];
}
