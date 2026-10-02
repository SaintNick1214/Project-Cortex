import { describe, it, expect, jest } from '@jest/globals';
import { resolveTenantId } from '../../src/auth/tenant';
import { MutableAPI } from '../../src/mutable';
import { VectorAPI } from '../../src/vector';
import type { ConvexClient } from 'convex/browser';

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
  it('passes configured scope to vector retrieval', async () => {
    const query = jest.fn<(...args: unknown[]) => Promise<null>>().mockResolvedValue(null);
    const api = new VectorAPI({query} as unknown as ConvexClient,undefined,undefined,{userId:'user-example',tenantId:'tenant-example'});
    await api.get('space-example','mem-example');
    expect(query).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({tenantId:'tenant-example'}));
  });
});
