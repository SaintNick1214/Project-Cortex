/**
 * CLI Test Utilities
 *
 * Helper functions for testing CLI commands
 */

import { jest } from "@jest/globals";
import { Command } from "commander";
import type { CLIConfig } from "../../src/types.js";

/**
 * Default test configuration
 */
export const testConfig: CLIConfig = {
  deployments: {
    local: {
      url: "http://127.0.0.1:3210",
      deployment: "test:anonymous-cortex-cli-test",
    },
    cloud: {
      url: "https://test.convex.cloud",
      key: "test-deploy-key",
    },
  },
  default: "local",
  format: "table",
  confirmDangerous: true,
};

/**
 * Console capture interface
 */
export interface CapturedOutput {
  stdout: string[];
  stderr: string[];
  logs: string[];
  errors: string[];
  warns: string[];
}

/** Children copy Commander exit handlers at construction; fence a completed registry. */
export function preventCommandExit(program: Command): Command {
  program.exitOverride();
  for (const command of program.commands) preventCommandExit(command);
  return program;
}

/**
 * Capture console output during test execution
 */
export function captureConsole(): {
  output: CapturedOutput;
  restore: () => void;
} {
  const output: CapturedOutput = {
    stdout: [],
    stderr: [],
    logs: [],
    errors: [],
    warns: [],
  };

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  console.log = (...args: unknown[]) => {
    output.logs.push(args.map(String).join(" "));
  };

  console.error = (...args: unknown[]) => {
    output.errors.push(args.map(String).join(" "));
  };

  console.warn = (...args: unknown[]) => {
    output.warns.push(args.map(String).join(" "));
  };

  process.stdout.write = ((chunk: string | Buffer) => {
    output.stdout.push(chunk.toString());
    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: string | Buffer) => {
    output.stderr.push(chunk.toString());
    return true;
  }) as typeof process.stderr.write;

  const restore = () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  };

  return { output, restore };
}

/**
 * Mock prompts module for testing user input
 */
export function mockPrompts(
  answers: Record<string, unknown> | unknown[],
): jest.Mock {
  const mockFn = jest.fn();

  if (Array.isArray(answers)) {
    // Queue of answers for multiple prompts
    let index = 0;
    mockFn.mockImplementation(() => {
      const answer = answers[index] ?? {};
      index++;
      return Promise.resolve(answer);
    });
  } else {
    // Single answer object
    mockFn.mockResolvedValue(answers);
  }

  return mockFn;
}

/**
 * Create a test command program with common options
 */
export function createTestProgram(): Command {
  const program = new Command();

  program
    .name("cortex-test")
    .enablePositionalOptions()
    .option("-d, --deployment <name>", "Deployment name")
    .option("-u, --url <url>", "Convex deployment URL")
    .option("-k, --key <key>", "Convex deploy key")
    .option("-f, --format <format>", "Output format", "table")
    .option("-q, --quiet", "Suppress output", false)
    .option("--debug", "Debug mode", false);

  // Prevent exit on error
  program.exitOverride();

  return program;
}

/**
 * Parse command args without executing
 */
export function parseArgs(
  program: Command,
  args: string[],
): { opts: Record<string, unknown>; args: string[] } {
  program.parse(["node", "test", ...args]);
  return {
    opts: program.opts(),
    args: program.args,
  };
}

/**
 * Create a mock file system for testing
 */
export interface MockFile {
  content: string;
  exists: boolean;
}

export function createMockFileSystem(
  files: Record<string, string | MockFile>,
): {
  existsSync: jest.Mock;
  readFileSync: jest.Mock;
  writeFileSync: jest.Mock;
  readFile: jest.Mock;
  writeFile: jest.Mock;
  mkdir: jest.Mock;
  ensureDir: jest.Mock;
} {
  const normalizedFiles = new Map<string, MockFile>();

  for (const [path, value] of Object.entries(files)) {
    if (typeof value === "string") {
      normalizedFiles.set(path, { content: value, exists: true });
    } else {
      normalizedFiles.set(path, value);
    }
  }

  const existsSync = jest.fn((path: string) => {
    return normalizedFiles.get(path)?.exists ?? false;
  });

  const readFileSync = jest.fn((path: string) => {
    const file = normalizedFiles.get(path);
    if (!file?.exists) {
      const error = new Error(
        `ENOENT: no such file or directory, open '${path}'`,
      );
      (error as NodeJS.ErrnoException).code = "ENOENT";
      throw error;
    }
    return file.content;
  });

  const writeFileSync = jest.fn((path: string, content: string) => {
    normalizedFiles.set(path, { content, exists: true });
  });

  const readFile = jest.fn(async (path: string) => {
    const file = normalizedFiles.get(path);
    if (!file?.exists) {
      const error = new Error(
        `ENOENT: no such file or directory, open '${path}'`,
      );
      (error as NodeJS.ErrnoException).code = "ENOENT";
      throw error;
    }
    return file.content;
  });

  const writeFile = jest.fn(async (path: string, content: string) => {
    normalizedFiles.set(path, { content, exists: true });
  });

  const mkdir = jest.fn(async () => undefined);
  const ensureDir = jest.fn(async () => undefined);

  return {
    existsSync,
    readFileSync,
    writeFileSync,
    readFile,
    writeFile,
    mkdir,
    ensureDir,
  };
}

/**
 * Create test data generators
 */
export const testData = {
  memory: (overrides: Record<string, unknown> = {}) => ({
    memoryId: "test-memory-id",
    memorySpaceId: "test-space",
    content: "Test memory content",
    contentType: "conversation" as const,
    sourceType: "conversation" as const,
    userId: "test-user",
    importance: 50,
    version: 1,
    accessCount: 0,
    tags: ["test"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }),

  user: (overrides: Record<string, unknown> = {}) => ({
    id: "test-user",
    version: 1,
    data: { name: "Test User" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }),

  memorySpace: (overrides: Record<string, unknown> = {}) => ({
    memorySpaceId: "test-space",
    name: "Test Space",
    type: "project" as const,
    status: "active" as const,
    participants: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }),

  fact: (overrides: Record<string, unknown> = {}) => ({
    factId: "test-fact",
    memorySpaceId: "test-space",
    fact: "Test fact content",
    factType: "knowledge" as const,
    confidence: 85,
    subject: "test",
    predicate: "is",
    object: "a test",
    sourceType: "extracted" as const,
    version: 1,
    tags: ["test"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }),

  conversation: (overrides: Record<string, unknown> = {}) => ({
    conversationId: "test-conv",
    memorySpaceId: "test-space",
    type: "user-agent" as const,
    messageCount: 5,
    participants: { userId: "test-user", agentId: "test-agent" },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }),
};

/**
 * Wait for async operations to complete
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Create a test timestamp
 */
export function testTimestamp(daysAgo = 0): number {
  return Date.now() - daysAgo * 24 * 60 * 60 * 1000;
}

/**
 * Strip ANSI color codes from string for comparison
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Compile the actual CLI without prebuild/template effects into an owned staging root. */
export async function stageActualCLI(): Promise<{
  entry: string;
  root: string;
  cleanup: () => Promise<void>;
}> {
  const { mkdtemp, mkdir, symlink, copyFile, rm } = await import("fs/promises");
  const { tmpdir } = await import("os");
  const { join, resolve, dirname } = await import("path");
  const { fileURLToPath } = await import("url");
  const { execFileSync } = await import("child_process");
  const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const repository = resolve(cliRoot, "../..");
  const root = await mkdtemp(join(tmpdir(), "cortex-actual-cli-"));
  try {
    const staged = join(root, "cli");
    await mkdir(staged);
    await copyFile(join(cliRoot, "package.json"), join(staged, "package.json"));
    await symlink(join(cliRoot, "node_modules"), join(staged, "node_modules"));
    await symlink(join(repository, "node_modules"), join(root, "node_modules"));
    execFileSync(
      process.execPath,
      [
        join(repository, "node_modules/typescript/bin/tsc"),
        "--outDir",
        join(staged, "dist"),
      ],
      { cwd: cliRoot, stdio: "pipe", timeout: 30000 },
    );
    return {
      entry: join(staged, "dist/index.js"),
      root,
      cleanup: () => rm(root, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

/** A minimal allowlist avoids inherited credentials/targets; subprocess never opens stdin. */
export async function runActualCLI(
  entry: string,
  args: string[],
  home: string,
  cwd: string,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const { spawnSync } = await import("child_process");
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 15000,
    env: {
      HOME: home,
      PATH: process.env.PATH ?? "",
      NO_COLOR: "1",
      DOTENV_CONFIG_QUIET: "true",
      CONVEX_URL_CLI: "http://127.0.0.1:1",
      CONVEX_URL: "http://127.0.0.1:1",
    },
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
