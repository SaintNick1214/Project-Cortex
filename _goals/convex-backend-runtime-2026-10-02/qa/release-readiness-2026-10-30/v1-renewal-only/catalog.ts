/** Nonbillable catalog check in the new private V1 host; no model dispatch path. */
import { internalAction } from './_generated/server';
import { getServiceToken } from 'convex/server';

export const check = internalAction({ args: {}, handler: async () => {
  const token = await getServiceToken('ai-gateway');
  const response = await fetch('https://ai-gateway.convex.dev/v1/models', {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  const body = await response.json() as { data?: Array<{ id?: string }> };
  return { status: response.status, checkedAt: Date.now(),
    models: body.data?.filter(row => row.id === 'openai/gpt-4o-mini') ?? [] };
} });
