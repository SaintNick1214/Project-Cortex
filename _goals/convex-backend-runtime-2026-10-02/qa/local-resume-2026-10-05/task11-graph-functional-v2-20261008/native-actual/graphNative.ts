/** Disposable Task11 fixture only. No inference, graph credentials, or product fault flags. */
import {ConvexError, v} from 'convex/values';
import {makeFunctionReference} from 'convex/server';
import {internalQuery, mutation} from './_generated/server';

const TENANT = 'task11-7c3504e9-96d6-48e9-9022-7d1e8f655226';
const SPACE = TENANT + '-space';
function own(args: {tenantId: string; memorySpaceId: string}) {
  if (args.tenantId !== TENANT || args.memorySpaceId !== SPACE) throw new ConvexError('FIXTURE_SCOPE_DENIED');
}

/** A real nested registered fact mutation, followed by a real parent transaction failure. */
export const storeThenRollback = mutation({
  args: {tenantId: v.string(), memorySpaceId: v.string(), text: v.string()},
  handler: async (ctx, args) => {
    own(args);
    await ctx.runMutation(makeFunctionReference<'mutation'>('facts:store'), {
      tenantId: args.tenantId, memorySpaceId: args.memorySpaceId, fact: args.text,
      factType: 'knowledge', confidence: 100, sourceType: 'manual', tags: ['task11-native-rollback'],
      entities: [{name: 'Task11 rollback sentinel', type: 'project'}], relations: [],
    });
    throw new ConvexError('FIXTURE_REQUESTED_PARENT_ROLLBACK');
  },
});

/** Internal operator readback of only the exact new Task11 test scope. */
export const inspect = internalQuery({
  args: {tenantId: v.string(), memorySpaceId: v.string()},
  handler: async (ctx, args) => {
    own(args);
    const {tenantId, memorySpaceId} = args;
    const [facts, sources, connectors, scope, graphSources, revisions, payloads, outbox, receipts, reads] = await Promise.all([
      ctx.db.query('facts').withIndex('by_tenant_space', q => q.eq('tenantId', tenantId).eq('memorySpaceId', memorySpaceId)).collect(),
      ctx.db.query('runtimeMemorySources').withIndex('by_scope_source', q => q.eq('tenantId', tenantId).eq('memorySpaceId', memorySpaceId)).collect(),
      ctx.db.query('runtimeGraphConnectors').withIndex('by_scope', q => q.eq('tenantId', tenantId).eq('memorySpaceId', memorySpaceId)).collect(),
      ctx.db.query('runtimeGraphScopes').withIndex('by_scope', q => q.eq('tenantId', tenantId).eq('memorySpaceId', memorySpaceId)).unique(),
      ctx.db.query('runtimeGraphSources').withIndex('by_scope', q => q.eq('tenantId', tenantId).eq('memorySpaceId', memorySpaceId)).collect(),
      ctx.db.query('runtimeGraphRevisions').withIndex('by_scope_revision', q => q.eq('tenantId', tenantId).eq('memorySpaceId', memorySpaceId)).collect(),
      ctx.db.query('runtimeGraphPayloads').withIndex('by_revision', q => q.eq('tenantId', tenantId).eq('memorySpaceId', memorySpaceId)).collect(),
      ctx.db.query('runtimeGraphOutbox').withIndex('by_queue', q => q.eq('tenantId', tenantId).eq('memorySpaceId', memorySpaceId)).collect(),
      ctx.db.query('runtimeGraphReceipts').withIndex('by_job', q => q.eq('tenantId', tenantId).eq('memorySpaceId', memorySpaceId)).collect(),
      ctx.db.query('runtimeGraphReads').withIndex('by_request', q => q.eq('tenantId', tenantId).eq('memorySpaceId', memorySpaceId)).collect(),
    ]);
    return {facts, sources, connectors, scope, graphSources, revisions, payloads, outbox, receipts, reads};
  },
});
