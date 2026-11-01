/** Explicit native administrator used only by CLI management integration tests. */
import { Cortex as SDK, type CortexConfig } from "@cortexmemory/sdk";
import { cliTestCredentials } from "./test-environment.js";

export class Cortex extends SDK {
  constructor(config: CortexConfig) {
    const target = cliTestCredentials(process.env);
    if (config.convexUrl !== target.url) throw new Error("CLI integration client target mismatch.");
    super({ ...config, convexLogger: false, resilience: { enabled: false } }, {
      deploymentOperator: true,
      initializeTransport(client) {
        (client as unknown as { setAdminAuth(key: string): void }).setAdminAuth(target.key);
      },
    });
  }
}

export async function withErasureTransport<T>(client: Cortex,
  operation: (transport: ReturnType<Cortex["users"]["createErasureTransport"]>) => Promise<T>): Promise<T> {
  const target = cliTestCredentials(process.env);
  const transport = client.users.createErasureTransport({ url: target.url, deploymentKey: target.key });
  try { return await operation(transport); }
  finally { transport.close(); }
}
