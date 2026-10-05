import {defineSchema,defineTable} from 'convex/server';
import {v} from 'convex/values';
const own={accountHash:v.string(),targetHash:v.string(),operatorHash:v.string(),manifestHash:v.string()};
const scope={tenantHash:v.string(),spaceHash:v.string(),ownerHash:v.string()};
export default defineSchema({
 experimentControls:defineTable({key:v.string(),stateCanonical:v.string()}).index('by_key',['key']),
 fixtureInstallation:defineTable({...own,...scope,grantId:v.id('fixtureGrants'),sourceId:v.id('fixtureSources'),chunkId:v.id('fixtureChunks')}).index('by_account',['accountHash']),
 fixtureGrants:defineTable({...own,...scope,grantHash:v.string(),epoch:v.number(),active:v.boolean(),profileHash:v.string()}).index('by_grant',['grantHash']),
 fixtureSources:defineTable({...own,...scope,sourceKey:v.string(),sourceHash:v.string(),revision:v.number(),epoch:v.number(),profileHash:v.string(),tombstone:v.boolean()}).index('by_source',['sourceKey']),
 fixtureChunks:defineTable({...own,...scope,sourceId:v.id('fixtureSources'),chunkKey:v.string(),sourceRevision:v.number(),sourceHash:v.string(),profileHash:v.string(),textHash:v.string(),tombstone:v.boolean()}).index('by_chunk',['chunkKey']),
 fixtureVectors:defineTable({...own,...scope,sourceId:v.id('fixtureSources'),chunkId:v.id('fixtureChunks'),sourceRevision:v.number(),sourceHash:v.string(),profileHash:v.string(),scopeProfileHash:v.string(),vector:v.array(v.number()),receiptHash:v.string(),dispatchIdentity:v.string(),writeKey:v.string(),tombstone:v.boolean()}).index('by_write',['writeKey']).index('by_source',['sourceId']).vectorIndex('by_default_embedding_v1',{vectorField:'vector',dimensions:1536,filterFields:['tenantHash','spaceHash','ownerHash','profileHash','scopeProfileHash']}),
 fixtureStages:defineTable({...own,scenarioId:v.string(),dispatchIdentity:v.string(),stageIdentityCanonical:v.string(),stageIdentityHash:v.string(),partSequence:v.number(),rawPartDigest:v.string(),stageHash:v.string(),privateCanonical:v.string(),trigger:v.string(),sourceEpoch:v.number(),grantEpoch:v.number(),createdAt:v.number()}).index('by_dispatch',['dispatchIdentity']).index('by_account',['accountHash']),
 fixtureEvidence:defineTable({...own,dispatchIdentity:v.string(),rawDigest:v.string(),privateTranscriptCanonical:v.string(),createdAt:v.number()}).index('by_dispatch_digest',['dispatchIdentity','rawDigest']).index('by_account',['accountHash']),
 fixtureLifecycle:defineTable({accountHash:v.string(),operation:v.union(v.literal('delete'),v.literal('revoke'),v.literal('purge')),intentKey:v.string(),intentCanonical:v.string(),intentHash:v.string(),receiptCanonical:v.string(),receiptHash:v.string(),beforeCanonical:v.string(),afterCanonical:v.string(),evidenceCanonical:v.string(),liabilityCanonical:v.string(),triggerCanonical:v.string()}).index('by_intent',['accountHash','operation','intentKey']).index('by_account',['accountHash']),
});
