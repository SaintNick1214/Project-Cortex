import { afterEach } from "@jest/globals";
import {
  createCortexMemory as createSync,
  createCortexMemoryAsync as createAsync,
  type CortexMemoryConfig,
  type CortexMemoryModel,
} from "../../src/index";

const factories = new Set<CortexMemoryModel>();
afterEach(async () => {
  await Promise.all([...factories].map((factory) => factory.close()));
  factories.clear();
});

export function createCortexMemory(config: CortexMemoryConfig): CortexMemoryModel {
  const factory = createSync(config);
  factories.add(factory);
  return factory;
}
export async function createCortexMemoryAsync(config: CortexMemoryConfig): Promise<CortexMemoryModel> {
  const factory = await createAsync(config);
  factories.add(factory);
  return factory;
}
