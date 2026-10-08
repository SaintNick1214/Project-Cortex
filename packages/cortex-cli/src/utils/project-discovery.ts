import { dirname, resolve } from "node:path";

/** Finite nearest-first ancestors, ending at HOME when reached or filesystem root. */
export function* projectSearchDirectories(cwd: string, home: string): Generator<string> {
  const boundary = resolve(home);
  let directory = resolve(cwd);
  while (true) {
    yield directory;
    const parent = dirname(directory);
    if (directory === boundary || parent === directory) return;
    directory = parent;
  }
}
