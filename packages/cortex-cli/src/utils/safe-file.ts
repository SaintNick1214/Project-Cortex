/** Validate and read one opened regular file, never reopen a checked pathname. */
import fs, { type Stats } from "node:fs";
import { open } from "node:fs/promises";

export class UnsafeFileError extends Error {
  constructor(cause?: unknown) { super("Unsafe or changing regular file", { cause }); }
}
interface ReadOptions {
  maxBytes?: number;
  singleLink?: boolean;
  validate?: (stat: Stats) => void;
}
const flags = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;
function checked(stat: Stats, options: ReadOptions): void {
  if (!stat.isFile() || stat.size > (options.maxBytes ?? Infinity) || (options.singleLink && stat.nlink !== 1)) throw new UnsafeFileError();
  options.validate?.(stat);
}
function stable(before: Stats, after: Stats): void {
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || before.mode !== after.mode || before.uid !== after.uid || before.nlink !== after.nlink) throw new UnsafeFileError();
}
function openError(error: unknown): never {
  if ((error as { code?: string }).code === "ELOOP") throw new UnsafeFileError(error);
  throw error;
}
export function readRegularFileSync(file: string, options: ReadOptions = {}): { bytes: Buffer; stat: Stats } {
  let fd: number;
  try { fd = fs.openSync(file, flags); } catch (error) { return openError(error); }
  try {
    const stat = fs.fstatSync(fd); checked(stat, options);
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) throw new UnsafeFileError();
      offset += count;
    }
    if (fs.readSync(fd, Buffer.alloc(1), 0, 1, offset)) throw new UnsafeFileError();
    stable(stat, fs.fstatSync(fd));
    return { bytes, stat };
  } finally { fs.closeSync(fd); }
}
export async function readRegularFile(file: string, options: ReadOptions = {}): Promise<{ bytes: Buffer; stat: Stats }> {
  let handle;
  try { handle = await open(file, flags); } catch (error) { return openError(error); }
  try {
    const stat = await handle.stat(); checked(stat, options);
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) throw new UnsafeFileError();
      offset += bytesRead;
    }
    if ((await handle.read(Buffer.alloc(1), 0, 1, offset)).bytesRead) throw new UnsafeFileError();
    stable(stat, await handle.stat());
    return { bytes, stat };
  } finally { await handle.close(); }
}
