import type {Data} from './contracts.ts';
import {canonical,digest,record,hash,same,vector,count,id,bool} from './validate.ts';
import {ownership} from './store.ts';
export const VECTOR_KEYS='accountHash targetHash operatorHash manifestHash tenantHash spaceHash ownerHash sourceId chunkId sourceRevision sourceHash profileHash scopeProfileHash vector receiptHash dispatchIdentity writeKey tombstone';
/** Exact accepted six-key UTF8 canonical JSON preimage; no prefix/delimiter/length codec. */
export async function scopeProfileHash(scope:Data){const preimage={domain:'cortex.experiment.scope-profile.v1',version:1,tenantHash:hash(scope.tenantHash),spaceHash:hash(scope.spaceHash),ownerHash:hash(scope.ownerHash),profileHash:hash(scope.profileHash)};return digest(canonical(preimage,1024))}
export async function vectorRow(value:unknown){const r=record(value,VECTOR_KEYS);ownership(r);for(const key of ['tenantHash','spaceHash','ownerHash','profileHash','sourceHash','receiptHash','dispatchIdentity','writeKey','scopeProfileHash'])hash(r[key]);same(r.scopeProfileHash,await scopeProfileHash(r));count(r.sourceRevision,1);id(r.sourceId);id(r.chunkId);bool(r.tombstone);vector(r.vector);return r}
