/** Private owned-host fixture. All inference stays in the original governed job handler. */
import { internalAction, internalQuery } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { getServiceToken } from 'convex/server';
import { officialMediaFactory, processSubmissionHandler } from './runtimeMediaGateway';
import type { MediaNativeFactory } from './runtimeMediaGateway';
import { privateDiagnostic } from './imageDiagnosticMetadata';
import { IMAGE_INPUT, IMAGE_MARKER } from './imageDiagnosticScope';

export function observedFactory(report: (value: unknown) => void, factory: MediaNativeFactory = officialMediaFactory): MediaNativeFactory {
  return modelId => {
    const native = factory(modelId);
    return { ...native, image: async input => {
      try {
        const output = await native.image(input);
        try { report({ phase: 'native-image-returned', modelId }); } catch { /* Observability cannot change output. */ }
        return output;
      } catch (error) {
        // This is before the original handler collapses the exception to a public failure code.
        // Metadata failure must never replace or retry the original native exception.
        try { report({ phase: 'native-image-threw', modelId, diagnostic: await privateDiagnostic(error, [IMAGE_INPUT.prompt]) }); }
        catch { try { report({ phase: 'diagnostic-capture-unavailable', modelId }); } catch { /* Preserve original error. */ } }
        throw error;
      }
    } };
  };
}
export async function instrumentedSubmission(ctx: ActionCtx, args: { jobId: string }): Promise<null> {
  return processSubmissionHandler(ctx, args, observedFactory(value => {
    // Only private deployment logs receive bounded metadata. The coordinator never prints this line.
    console.error(IMAGE_MARKER + JSON.stringify({ jobId: args.jobId, value }));
  }));
}
export const snapshot = internalQuery({ args: {}, handler: async ctx => {
  const [attempts, operations, accounts, jobs] = await Promise.all([
    ctx.db.query('runtimeModelAttempts').take(3), ctx.db.query('runtimeModelOperations').take(3),
    ctx.db.query('runtimeBudgetAccounts').take(4), ctx.db.query('runtimeMediaJobs').take(3),
  ]);
  if (attempts.length > 1 || operations.length > 1 || jobs.length > 1 || accounts.length > 2) throw Error('IMAGE_ONLY_LEDGER_BOUND');
  return { attempts, operations, accounts, jobs };
} });
export const catalog = internalAction({ args: {}, handler: async () => {
  const token = await getServiceToken('ai-gateway');
  const response = await fetch('https://ai-gateway.convex.dev/v1/models', {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000), redirect: 'error',
  });
  const parsed = await response.json() as { data?: Array<{ id?: string }> };
  return { checkedAt: Date.now(), status: response.status, imageModelPresent: parsed.data?.some(row => row.id === 'openai/gpt-image-1') === true };
} });
