import { describe, it, expect, jest } from '@jest/globals';
import { Cortex } from '../../src';

describe('SDK lifecycle', () => {
  it('waits for connection closure before shutdown resolves', async () => {
    const cortex = new Cortex({convexUrl:'https://example.convex.cloud'});
    const client = cortex.getClient();
    const realClose = client.close.bind(client);
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const close = jest.spyOn(client,'close').mockImplementation(() => pending);
    let stopped = false;
    const shutdown = cortex.shutdown().then(() => { stopped = true; });
    await new Promise(resolve => setTimeout(resolve,0));
    expect(close).toHaveBeenCalledTimes(1);
    expect(stopped).toBe(false);
    finish();
    await shutdown;
    expect(stopped).toBe(true);
    close.mockRestore();
    await realClose();
  });
});
