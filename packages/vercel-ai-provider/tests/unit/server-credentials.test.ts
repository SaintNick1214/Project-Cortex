/** Credential forwarding through actual provider paths and the built production Cortex. */
import { Cortex } from '@cortexmemory/sdk';
import { createCortexMemory, createCortexMemoryAsync } from '../../src/index';
import { CortexMemoryProvider } from '../../src/provider';
import { createMemoryPrepareCall } from '../../src/v6-compat';
import { serverRuntimeOptions } from '../../src/server-credentials';
import { createMockLLM, createTestConfig } from '../helpers/test-utils';

const mockEvents: string[] = [];
const mockClients: any[] = [];
let mockSetterFailure = false;
let mockQueryFailure = false;
let mockSetterMissing = false;
jest.mock('convex/browser', () => {
  const actual = jest.requireActual('convex/browser');
  return { ...actual, ConvexClient: jest.fn(() => {
    const client = {
      authenticated: false,
      setAdminAuth: jest.fn(function(this: any, ...args: unknown[]) {
        mockEvents.push('admin'); expect(args).toHaveLength(1);
        if (mockSetterFailure) throw new Error('controlled-secret-cause');
        this.authenticated = true;
      }),
      query: jest.fn(async () => { mockEvents.push('query'); expect(client.authenticated).toBe(true); if(mockQueryFailure) throw new Error('controlled-secret-cause'); return []; }),
      mutation: jest.fn(async () => { mockEvents.push('mutation'); expect(client.authenticated).toBe(true); return {}; }),
      action: jest.fn(async () => { mockEvents.push('action'); expect(client.authenticated).toBe(true); return []; }),
      onUpdate: jest.fn(() => { mockEvents.push('subscription'); expect(client.authenticated).toBe(true); return () => {}; }),
      close: jest.fn(async () => { mockEvents.push('close-complete'); }),
    };
    if (mockSetterMissing) (client as any).setAdminAuth=undefined;
    mockClients.push(client); mockEvents.push('transport'); return client;
  }) };
});
const key = 'task28-controlled-key';
const credentials = { deploymentKey: key };
beforeEach(() => { mockClients.length = 0; mockEvents.length = 0; mockSetterFailure = false; mockQueryFailure = false; mockSetterMissing = false; jest.clearAllMocks(); });

function assertSafe(error: unknown) {
  expect(String(error)).not.toContain(key); expect(String(error)).not.toContain('controlled-secret-cause');
  expect(JSON.stringify(error)).not.toContain(key); expect(error).not.toHaveProperty('cause');
}
describe('private server credentials helper', () => {
  it('does nothing without credentials, including browser context', () => {
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    try { expect(serverRuntimeOptions()).toBeUndefined(); } finally { delete (globalThis as any).window; }
  });
  it.each([undefined, null, '', '   ', 7])('refuses invalid key %s without echo', (deploymentKey) => {
    expect(() => serverRuntimeOptions({ deploymentKey } as any)).toThrow('nonempty deployment key');
  });
  it('sanitizes a throwing credential accessor and reads an accepted key only once', () => {
    expect(() => serverRuntimeOptions({get deploymentKey(): string {throw new Error('controlled-secret-cause');}})).toThrow('nonempty deployment key');
    const getter=jest.fn(() => key); serverRuntimeOptions({get deploymentKey(){return getter();}});
    expect(getter).toHaveBeenCalledTimes(1);
  });
  it('refuses browser credentials without reading or retaining key', () => {
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    try { expect(() => serverRuntimeOptions(credentials)).toThrow('server context'); } finally { delete (globalThis as any).window; }
  });
  it('feature detects setter and passes exactly one argument with native receiver', () => {
    const client = { setAdminAuth: jest.fn(function(this: unknown, ...args: unknown[]) { expect(this).toBe(client); expect(args).toEqual([key]); }) };
    expect(serverRuntimeOptions(credentials)!.initializeTransport!(client as any)).toBeUndefined();
    expect(serverRuntimeOptions(credentials)!.deploymentOperator).toBe(true);
    expect(client.setAdminAuth).toHaveBeenCalledTimes(1);
  });
  it.each(['missing', 'throw'])('fails closed on %s setter without raw cause', mode => {
    const client = mode === 'missing' ? {} : { setAdminAuth() { throw new Error('controlled-secret-cause'); } };
    let error: unknown; try { serverRuntimeOptions(credentials)!.initializeTransport!(client as any); } catch(failure) { error = failure; }
    assertSafe(error); expect(String(error)).toContain('authentication initialization failed');
  });
});

describe('actual Cortex and provider construction paths', () => {
  it.each(['sync', 'async'] as const)('authenticates %s owner once and wrappers borrow until owner release', async mode => {
    const config = createTestConfig({ enableGraphMemory: false, enableMemoryStorage: false, enableMemorySearch: false });
    const owner = mode === 'sync' ? createCortexMemory(config, credentials) : await createCortexMemoryAsync(config, credentials);
    try {
    const one = owner(createMockLLM()), two = owner(createMockLLM());
    expect(mockEvents).toEqual(['transport', 'admin']); expect(mockClients).toHaveLength(1);
    expect(owner.getConfig()).not.toHaveProperty('deploymentKey'); expect(JSON.stringify(owner.getConfig())).not.toContain(key);
    await Promise.all([one.close(), two.close(), one.close()]); expect(mockClients[0].close).not.toHaveBeenCalled();
    expect(await owner.search('retained')).toEqual([]); expect(mockEvents.indexOf('action')).toBeGreaterThan(mockEvents.indexOf('admin'));
    await one.doGenerate({prompt:[{role:'user', content:[{type:'text',text:'retained'}]}]});
    await Promise.all([owner.close(), owner.close()]); expect(mockClients[0].close).toHaveBeenCalledTimes(1);
    expect(mockClients[0].setAdminAuth).toHaveBeenCalledTimes(1);
    } finally { await owner.close(); }
  });
  it.each(['direct', 'static'] as const)('authenticates owned %s provider before first operation and releases once', async mode => {
    const config = createTestConfig({ enableGraphMemory: false, enableMemoryStorage: false, enableMemorySearch: false });
    const model = createMockLLM();
    const provider = mode === 'direct' ? new CortexMemoryProvider(model, config, undefined, undefined, credentials) : await CortexMemoryProvider.create(model, config, credentials);
    try {
    expect(mockEvents).toEqual(['transport','admin']);
    await provider.doGenerate({prompt:[{role:'user',content:[{type:'text',text:'hello'}]}]}); expect(model.doGenerate).toHaveBeenCalledTimes(1);
    await Promise.all([provider.close(),provider.close()]); expect(mockClients[0].close).toHaveBeenCalledTimes(1);
    } finally { await provider.close(); }
  });
  it.each(['missing','throw'])('refuses %s setter before any model-property access', async mode => {
    mockSetterMissing=mode==='missing'; mockSetterFailure=mode==='throw';
    const access=jest.fn(); const model=new Proxy({}, {get(){access();throw new Error('model accessed');}});
    let error: unknown;
    try {new CortexMemoryProvider(model,createTestConfig(),undefined,undefined,credentials);} catch(failure){error=failure;}
    assertSafe(error); expect(String(error)).toContain('transport initialization failed'); expect(access).not.toHaveBeenCalled();
    expect(mockClients[0].close).toHaveBeenCalledTimes(1); expect(mockClients[0].query).not.toHaveBeenCalled();
  });
  it('initiates owned disposal on post-auth model failure and preserves manual adapter', async () => {
    const adapter={disconnect:jest.fn()}; const failure=new Error('post-auth model failure');
    const model=new Proxy({}, {get(){throw failure;}});
    expect(()=>new CortexMemoryProvider(model,createTestConfig(),undefined,adapter as any,credentials)).toThrow(failure);
    for(let index=0;index<20;index++) await Promise.resolve();
    expect(mockClients[0].setAdminAuth).toHaveBeenCalledTimes(1); expect(mockClients[0].close).toHaveBeenCalledTimes(1);
    expect(mockEvents).toEqual(['transport','admin','close-complete']); expect(adapter.disconnect).not.toHaveBeenCalled();
  });
  it('rejects borrowed Cortex plus credentials before caller/model/config access', async () => {
    const borrowed = new Cortex({convexUrl:'http://127.0.0.1:45510',resilience:{enabled:false}});
    try {
    const inaccessible = new Proxy({}, { get() { throw new Error('caller accessed'); } });
    expect(() => new CortexMemoryProvider(inaccessible, inaccessible as any, borrowed, undefined, credentials)).toThrow('borrowed Cortex');
    expect(mockClients[0].setAdminAuth).not.toHaveBeenCalled(); expect(mockClients[0].close).not.toHaveBeenCalled();
    } finally { await borrowed.shutdown(); }
    expect(mockClients[0].close).toHaveBeenCalledTimes(1);
  });
  it.each(['sync','async','direct','static','prepareCall'])('sanitizes failed %s initialization before operation/model escape', async mode => {
    mockSetterFailure = true; const config = createTestConfig({enableGraphMemory:false}); let error: unknown;
    try {
      if(mode==='sync') createCortexMemory(config,credentials);
      else if(mode==='async') await createCortexMemoryAsync(config,credentials);
      else if(mode==='direct') new CortexMemoryProvider(createMockLLM(),config,undefined,undefined,credentials);
      else if(mode==='static') await CortexMemoryProvider.create(createMockLLM(),config,credentials);
      else await createMemoryPrepareCall(config,credentials)({options:{userId:'owned-user',memorySpaceId:'owned-space'},messages:[{role:'user',content:'hello'}]});
    } catch(failure) { error=failure; }
    assertSafe(error); expect(String(error)).toContain('transport initialization failed'); expect(mockClients).toHaveLength(1);
    expect(mockClients[0].close).toHaveBeenCalledTimes(1); expect(mockClients[0].query).not.toHaveBeenCalled();
  });
  it('protected prepareCall recall rejects sanitized and never falls back while awaiting cleanup', async () => {
    const probe = new Cortex({convexUrl:'http://127.0.0.1:45510',resilience:{enabled:false}});
    const prototype = Object.getPrototypeOf(probe.memory);
    await probe.shutdown(); mockClients.length=0; mockEvents.length=0;
    const recall=jest.spyOn(prototype,'recall').mockRejectedValue(new Error('controlled-secret-cause'));
    const warn=jest.spyOn(console,'warn').mockImplementation(() => {});
    try {
      const prepare=createMemoryPrepareCall({convexUrl:'http://127.0.0.1:45510'},credentials);
      const error=await prepare({options:{userId:'owned-user',memorySpaceId:'owned-space'},messages:[{role:'user',content:'hello'}]}).catch(error=>error);
      assertSafe(error); expect(String(error)).toContain('protected memory recall failed');
      expect(warn).not.toHaveBeenCalled(); expect(mockClients).toHaveLength(1); expect(mockClients[0].close).toHaveBeenCalledTimes(1);
      expect(mockEvents).toEqual(['transport','admin','close-complete']);
    } finally { recall.mockRestore(); warn.mockRestore(); }
  });
  it('prepareCall authenticates its actual ephemeral Cortex before recall and awaits owned closure', async () => {
    const prepare = createMemoryPrepareCall({convexUrl:'http://127.0.0.1:45510',includeGraph:false,includeFacts:false}, credentials);
    const result = await prepare({options:{userId:'owned-user',memorySpaceId:'owned-space'},instructions:'retained',messages:[{role:'user',content:'hello'}]});
    expect(result.instructions).toContain('retained'); expect(mockClients[0].setAdminAuth).toHaveBeenCalledTimes(1);
    expect(mockEvents.indexOf('action')).toBeGreaterThan(mockEvents.indexOf('admin')); expect(mockEvents.at(-1)).toBe('close-complete');
  });
});
