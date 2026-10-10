import type { Cortex } from '@cortexmemory/sdk';

export async function listApprovedSessions(cortex: Cortex, tenantId: string) {
  const sessions = await cortex.sessions.list({ tenantId, status: 'active', limit: 25, offset: 0 });
  return sessions.map(session => ({ id: session.sessionId,
    userId: session.userId, lastActiveAt: session.lastActiveAt }));
}
