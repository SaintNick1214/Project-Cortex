import { createAuthContext } from '@cortexmemory/sdk';

export const metadata = createAuthContext({ userId: 'user-123', tenantId: 'tenant-123' });
