/** Read-only installed checks require a separately verified disposable fixture. */
import { hostToken, runtimeConfig, withRuntime, AppError } from "../../cortex.js";
import type { RuntimeClient } from "../../cortex.js";
export async function installed<T>(work: (client: RuntimeClient, runId: string) => Promise<T>): Promise<T> {
  if (process.env.CORTEX_E2E_TARGET_VERIFIED !== "true" || !process.env.CORTEX_E2E_RUN_ID) throw new AppError("VERIFIED_E2E_FIXTURE_REQUIRED");
  const config = runtimeConfig();
  if (!config.tenantId || !config.memorySpaceId) throw new AppError("E2E_SCOPE_REQUIRED");
  return await withRuntime(async () => hostToken(), async client => {
    const current = await client.session();
    if (current.tenantId !== config.tenantId || current.memorySpaceId !== config.memorySpaceId) throw new AppError("E2E_SCOPE_MISMATCH");
    return work(client, process.env.CORTEX_E2E_RUN_ID!);
  }, { config });
}
