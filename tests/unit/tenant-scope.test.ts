import { describe, it, expect, jest } from '@jest/globals';
import { resolveTenantId } from '../../src/auth/tenant';
import { MutableAPI } from '../../src/mutable';
import { VectorAPI } from '../../src/vector';
import type { ConvexClient } from 'convex/browser';
import { enableDeploymentOperator } from '../../src/common/deploymentOperator';
import { getFunctionName } from 'convex/server';

describe('configured tenant scope', () => {
  it('defaults to the configured tenant and allows matching explicit scope', () => {
    expect(resolveTenantId('tenant-example')).toBe('tenant-example');
    expect(resolveTenantId('tenant-example','tenant-example')).toBe('tenant-example');
    expect(resolveTenantId(undefined,'tenant-example')).toBe('tenant-example');
  });
  it('rejects a conflicting list scope before making a backend request', async () => {
    const query = jest.fn();
    const api = new MutableAPI({query} as unknown as ConvexClient,undefined,undefined,{userId:'user-example',tenantId:'tenant-example'});
    await expect(api.list({namespace:'preferences',tenantId:'tenant-other'})).rejects.toMatchObject({code:'TENANT_SCOPE_MISMATCH'});
    expect(query).not.toHaveBeenCalled();
  });
  it('public vector retrieval leaves tenant authority with the authenticated backend', async () => {
    const mutation = jest.fn<(...args: unknown[]) => Promise<null>>().mockResolvedValue(null);
    const api = new VectorAPI({mutation} as unknown as ConvexClient,undefined,undefined,{userId:'user-example',tenantId:'tenant-example'});
    await api.get('space-example','mem-example');
    expect(mutation).toHaveBeenCalledWith(expect.anything(),{memorySpaceId:'space-example',memoryId:'mem-example'});
    expect(getFunctionName(mutation.mock.calls[0][0] as Parameters<typeof getFunctionName>[0])).toBe('memories:get');
  });
  it('explicit operator vector retrieval passes configured tenant to its internal handler', async () => {
    const query = jest.fn<(...args: unknown[]) => Promise<null>>().mockResolvedValue(null);
    const mutation = jest.fn();
    const client = {query,mutation} as unknown as ConvexClient;
    enableDeploymentOperator(client);
    const api = new VectorAPI(client,undefined,undefined,{userId:'user-example',tenantId:'tenant-example'});
    await api.get('space-example','mem-example');
    expect(query).toHaveBeenCalledWith(expect.anything(),{tenantId:'tenant-example',memorySpaceId:'space-example',memoryId:'mem-example'});
    expect(getFunctionName(query.mock.calls[0][0] as Parameters<typeof getFunctionName>[0])).toBe('cliOperator/memories:get');
    expect(mutation).not.toHaveBeenCalled();
  });
});
