// Controlled legacy administration; no native authentication or services run in these mocks.
const legacyCredentials = { deploymentKey: "unit-controlled-key" };
import { createCortexMemoryAsync } from '../../src/index';
import { CortexMemoryProvider } from '../../src/provider';
import { createMockLLM, createTestConfig } from '../helpers/test-utils';
const mockCortex = {
  deploymentOperator: true,
  memory: { search: jest.fn().mockResolvedValue([{ content: 'retained shared memory' }]), list: jest.fn().mockResolvedValue([]) },
  shutdown: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@cortexmemory/sdk', () => ({ Cortex: Object.assign(jest.fn(() => mockCortex), { create: jest.fn(async () => mockCortex) }) }));
const { Cortex } = jest.requireMock('@cortexmemory/sdk');
beforeEach(() => { jest.clearAllMocks(); Cortex.create.mockResolvedValue(mockCortex); mockCortex.shutdown.mockResolvedValue(undefined); });
describe('graph creation and shared owner lifecycle', () => {
  it.each([false, true, undefined])('both async paths forward explicit enabled=%s to the shared SDK resolver', async (enableGraphMemory) => {
    const graphConfig = { type: 'memgraph' as const, uri: 'bolt://127.0.0.1:45388', username: 'selected', password: 'private' };
    const config = createTestConfig({ enableGraphMemory, graphConfig });
    const owner = await createCortexMemoryAsync(config, legacyCredentials);
    const provider = await CortexMemoryProvider.create(createMockLLM(), config, legacyCredentials);
    expect(Cortex.create).toHaveBeenNthCalledWith(1, { convexUrl: config.convexUrl, graph: undefined, graphEnabled: enableGraphMemory, graphConnection: graphConfig }, expect.objectContaining({ deploymentOperator: true, initializeTransport: expect.any(Function) }));
    expect(Cortex.create).toHaveBeenNthCalledWith(2, { convexUrl: config.convexUrl, graph: undefined, graphEnabled: enableGraphMemory, graphConnection: graphConfig }, expect.objectContaining({ deploymentOperator: true, initializeTransport: expect.any(Function) }));
    await owner.close(); await provider.close();
  });
  it('manual adapter takes priority and stays caller-owned', async () => {
    const adapter = { disconnect: jest.fn(), isConnected: jest.fn().mockResolvedValue(true) } as any;
    const config = createTestConfig({ enableGraphMemory: false, graphConfig: { adapter } });
    const owner = await createCortexMemoryAsync(config, legacyCredentials);
    expect(Cortex.create.mock.calls[0][0].graph).toEqual({ adapter });
    await owner.close(); expect(adapter.disconnect).not.toHaveBeenCalled(); expect(await adapter.isConnected()).toBe(true);
  });
  it('two borrowed wrappers close without releasing shared factory or manual operations', async () => {
    const owner = await createCortexMemoryAsync(createTestConfig(), legacyCredentials);
    const one = owner(createMockLLM()); const two = owner(createMockLLM());
    await Promise.all([one.close(), two.close(), one.close()]);
    expect(mockCortex.shutdown).not.toHaveBeenCalled();
    expect(await owner.search('retained')).toEqual([{ content: 'retained shared memory' }]);
    // SDK owns idempotency; all owner calls address that same shared instance.
    await Promise.all([owner.close(), owner.close()]); expect(mockCortex.shutdown).toHaveBeenCalledTimes(1);
  });
  it('class async factory owns exactly one disposal promise', async () => {
    const provider = await CortexMemoryProvider.create(createMockLLM(), createTestConfig(), legacyCredentials);
    await Promise.all([provider.close(), provider.close()]); expect(mockCortex.shutdown).toHaveBeenCalledTimes(1);
  });
  it('construction failure after connection awaits owner cleanup', async () => {
    const config = createTestConfig();
    await expect(CortexMemoryProvider.create(null, config, legacyCredentials)).rejects.toThrow();
    expect(mockCortex.shutdown).toHaveBeenCalledTimes(1);
  });
  it('factory failure after initialization releases shared owner before rejection', async () => {
    const logger = { debug: jest.fn((message: string) => { if (message.includes('Cortex SDK initialized')) throw new Error('initialization sentinel'); }), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    await expect(createCortexMemoryAsync(createTestConfig({ logger }), legacyCredentials)).rejects.toThrow('initialization sentinel');
    expect(mockCortex.shutdown).toHaveBeenCalledTimes(1);
  });
  it('shared SDK configuration/connection rejection is propagated by both paths', async () => {
    for (const message of ['Graph configuration is ambiguous.', 'Graph tuple is incomplete.', 'Graph database authentication failed.']) {
      Cortex.create.mockRejectedValueOnce(new Error(message));
      await expect(createCortexMemoryAsync(createTestConfig({ enableGraphMemory: true }), legacyCredentials)).rejects.toThrow(message);
      Cortex.create.mockRejectedValueOnce(new Error(message));
      await expect(CortexMemoryProvider.create(createMockLLM(), createTestConfig({ enableGraphMemory: true }), legacyCredentials)).rejects.toThrow(message);
    }
  });
  it('disposal rejection propagates without raw credential logging', async () => {
    mockCortex.shutdown.mockRejectedValue(new Error('Cortex resource cleanup failed.'));
    const config = createTestConfig({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } });
    const provider = await CortexMemoryProvider.create(createMockLLM(), config, legacyCredentials);
    await expect(provider.close()).rejects.toThrow('Cortex resource cleanup failed.');
    expect(config.logger!.warn).not.toHaveBeenCalled(); expect(config.logger!.error).not.toHaveBeenCalled();
  });
});
