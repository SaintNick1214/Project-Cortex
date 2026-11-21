/** Fixed destinations and exclusive ownership for the disposable local qualification. */
import fs from "node:fs/promises";

export const LOCAL_BACKEND_URL = "http://127.0.0.1:3486";
export const LOCAL_SITE_URL = "http://127.0.0.1:3487";

export async function claimTargetPointer(pointer) {
  try {
    // O_EXCL refuses existing files and symlinks atomically. Callers write through
    // this descriptor, so a path replacement cannot redirect the write.
    return await fs.open(pointer, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error("Existing owned-target pointer must be reconciled first", { cause: error });
    }
    throw error;
  }
}
