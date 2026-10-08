/** Authorization closure only: canonical cross-data statistics are not qualified yet. */
import { RegistryAccess, deny } from "./runtimeRegistryAuth";

export async function statisticsUnavailable(access: RegistryAccess): Promise<never> {
  // A tenant-only grant cannot turn statistics into a cross-space scan. Select a concrete
  // current space and admit the canonical registry target before reaching this seam.
  if (!access.authority.memorySpaceId || access.authority.memorySpaceEpoch === undefined) deny();
  await access.fence();
  // Uniform readiness does not probe inaccessible data presence or manufacture zero counts.
  // Task05 and its accepted source bridge must restore the original statistics functionality.
  return deny("CAPABILITY_NOT_READY");
}
