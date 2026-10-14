/** Request controls only. The backend resolves policy and performs discovery. */
import { normalizeMemoryEffortRequest } from "@cortexmemory/sdk/runtime";
import type { MemoryEffortRequest } from "@cortexmemory/sdk/runtime";
import { AppError } from "./cortex.js";
export function memoryRequest(value: unknown): MemoryEffortRequest {
  try { return normalizeMemoryEffortRequest(value as MemoryEffortRequest); }
  catch { throw new AppError("INVALID_MEMORY_EFFORT"); }
}
