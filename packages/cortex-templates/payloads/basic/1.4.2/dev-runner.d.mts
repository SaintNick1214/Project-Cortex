import type { ChildProcess } from "node:child_process";
export declare function runDev(start?: (command: string, args: readonly string[], options: { stdio: "inherit"; env: NodeJS.ProcessEnv }) => ChildProcess): ChildProcess;
