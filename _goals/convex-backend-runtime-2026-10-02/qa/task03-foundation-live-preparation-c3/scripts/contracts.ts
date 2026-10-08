import { ConvexHttpClient, ConvexClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
/** Pinned Convex1.46 source declares this @internal deployment-operator seam;
 * it is deliberately absent from the browser public type export. Runtime verifies presence. */
export interface TrustedNativeOperatorClient extends ConvexHttpClient {setAdminAuth(token:string):void}
export interface OwnedRef { table:string; id:string }
export interface OwnedRow { table:string; value:unknown }
export interface AuthorityReference {principalId:string;principalVersion:number;membershipId:string;membershipVersion:number;grantId:string;grantVersion:number;tenantId:string;tenantEpoch:number;memorySpaceId?:string;memorySpaceEpoch?:number}
export interface LiveContext {
 run:string; issuer:string; deploymentUrl:string; kindByPath:Record<string,'query'|'mutation'|'action'>;
 identities:Record<string,string>;users:Record<string,string>;principals:Record<string,string>;grants:Record<string,string>;references:Record<string,AuthorityReference>;
 scopes:{tenantId:string;memorySpaceId:string;writerMemorySpaceId:string;foreignTenantId:string;foreignMemorySpaceId:string};refs:OwnedRef[];
 seed(rows:OwnedRow[]):Promise<OwnedRef[]>;operator(name:string,args:Record<string,unknown>):Promise<unknown>;call(identity:string,path:string,args:Record<string,unknown>):Promise<unknown>;
 snapshot(refs?:OwnedRef[]):Promise<unknown[]>;cleanup(refs?:OwnedRef[]):Promise<unknown>;discoverOwnedEffects():Promise<OwnedRef[]>;
 bounded<T>(action:()=>Promise<T>):Promise<T>;httpClient():ConvexHttpClient;reactiveClient(identity:string):ConvexClient;tokenFor(identity:string):string;
}
// Compile-only native API seams. No invocation, client construction or signing.
export function typecheckNativeSurface(http:TrustedNativeOperatorClient,reactive:ConvexClient):void {
 void http.setAdminAuth;
 void http.setAuth;
 void reactive.setAuth;
 void reactive.onUpdate;
 void makeFunctionReference<'query'>;
}
