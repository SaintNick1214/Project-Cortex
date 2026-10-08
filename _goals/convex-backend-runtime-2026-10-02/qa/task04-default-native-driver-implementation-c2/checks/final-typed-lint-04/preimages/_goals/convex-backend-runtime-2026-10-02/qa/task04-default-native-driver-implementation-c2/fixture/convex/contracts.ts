import { CASES } from './cases.ts';
export type Case = typeof CASES[number];
export type CaseId = Case['scenarioId'];
export type Method = Case['method'];
export type Model = Case['modelId'];
export type H = string;
export interface BindingV2 {manifestHash:H;targetHash:H;sourceHash:H;installedClosureHash:H;operatorHash:H;grantHash:H;sourceRecordHash:H;profileHash:H;grantEpoch:number;sourceEpoch:number;sourceRevision:number;profileEpoch:number;windowEpoch:number;validatorRevision:1}
export interface Counts {input:number|null;output:number|null}
export type Reason='none'|'missing-evidence'|'unsupported'|'contradiction'|'bound-violation'|'authority-closed';
export const CATEGORIES=['cache-read','cache-write','cancelled','inference','rejected','routing','surcharge'] as const;
export type Category=typeof CATEGORIES[number];
export interface Receipt {version:2;evidenceScope:'actual-experiment-native';binding:BindingV2;scenarioId:CaseId;dispatchIdentity:H;nativeHash:H;expectedWireHash:H;rawDigest:H;method:Method;interface:'chat'|'embedding';requestedModel:Model;responseId:string|null;actualModel:string|null;rawFinish:'stop'|'length'|'content_filter'|null;nativeFinish:'stop'|'length'|'content-filter'|'tool-calls'|'error'|'other'|null;nativeRawFinish:string|null;rawCounts:Counts;mappedCounts:Counts;usage:'unknown'|'validated-raw-mapped';lifetime:'unknown'|'validated-provider-terminal';lifetimeProof:H|null;serving:'unknown'|'validated-bound-premises'|'drift';servingProof:H|null;money:'unknown'|'validated-whole-invocation-usd';observedCostDecimal:string|null;observedCurrency:string|null;observedCategories:Category[];microUSD:number|null;moneyProof:H|null;resultHash:H|null;reason:Reason}
export type Facts=Omit<Receipt,'rawDigest'|'reason'> & {firstRawDigest:H;refinementRawDigests:H[];stopReason:Reason};
export interface Attempt {scenarioId:CaseId;dispatchIdentity:H;identityCanonical:string;state:'dispatch_pending'|'inflight'|'unknown'|'terminal';checkpoint:true;slotReleased:boolean;k:number;known:number|null;firstCapture:string|null;refinements:string[];facts:Facts|null;attachment:'pending'|'attached'|'closed';privateCanonical:string|null;trigger:'none'|'revoke'|'cancel';triggerStageHash:H|null;triggerIdentityHash:H|null}
export interface Account {version:2;evidenceScope:'actual-experiment-native';hypothesis:true;binding:BindingV2;retainedTriggerCanonical:string;retainedTriggerSetHash:H;next:number;active:CaseId|null;reserved:number;known:number;stopped:boolean;overrun:boolean;revoked:boolean;cancelled:boolean;sourceCurrent:boolean;profileCurrent:boolean;proofCurrent:boolean;windowCurrent:boolean;attempts:Attempt[]}
export interface StageIdentity {version:1;scenarioId:'C09'|'C10';dispatchIdentity:H;binding:BindingV2;partSequence:number;rawPartDigest:H;stageCanonicalHash:H;trigger:'revoke'|'cancel'}
export interface TriggerItem {scenarioId:'C09'|'C10';dispatchIdentity:H;trigger:'revoke'|'cancel';stageHash:H;stageIdentityHash:H;stageIdentityCanonical:string}
export interface TriggerProjection {domain:'cortex.experiment.trigger-set.v1';version:1;accountHash:H;bindingHash:H;triggers:TriggerItem[]}
export interface Scope {tenantHash:H;spaceHash:H;ownerHash:H}
export interface Owned {accountHash:H;targetHash:H;manifestHash:H;operatorHash:H;scope:Scope;sourceId:string;chunkId:string;grantId:string}
export type Operation='delete'|'revoke'|'purge';
export type Deny={kind:'denied';reason:'wrong-owner'|'wrong-scope'|'wrong-target'|'stale'|'corrupt'|'closed'|'scope'};
export type Data=Record<string,unknown>;
