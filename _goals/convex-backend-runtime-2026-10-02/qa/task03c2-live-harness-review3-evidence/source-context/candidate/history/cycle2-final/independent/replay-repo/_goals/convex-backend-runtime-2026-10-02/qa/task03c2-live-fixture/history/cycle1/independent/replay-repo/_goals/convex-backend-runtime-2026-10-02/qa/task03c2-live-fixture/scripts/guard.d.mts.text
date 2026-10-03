import type { KeyObject } from "node:crypto";
export const root: string, repo: string, scratch: string, fixture: string, keyFile: string, receiptFile: string, envFile: string;
export function canonical(path: string, base: string, options?: { privateFile?: boolean; existing?: boolean }): string;
export function hash(data: string | Buffer): string;
export function localPreflight(outputName?: string): string | undefined;
export interface Target { projectId: number; deploymentName: string; deploymentUrl: string; }
export function livePreflight(outputName?: string): { target: Target; output: string; envFile: string; env: Record<string, string>; privateKey: KeyObject; jwk: { kid: string } };
export function writeEvidence(outputName: string, value: unknown, live?: boolean): void;
