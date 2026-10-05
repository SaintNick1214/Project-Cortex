import { actionGeneric, makeFunctionReference, type GenericActionCtx, type GenericDataModel } from "convex/server";
import { v } from "convex/values";
import { BINDING, CASES } from "./compiled.ts";
import { canonical, exact } from "./canonical.ts";
import type { Case, Observation } from "./guard.ts";
type Context=GenericActionCtx<GenericDataModel>;
export const REFERENCES={reserve:makeFunctionReference<"mutation">("guard:reserveCheckpoint"),enter:makeFunctionReference<"mutation">("guard:enterPeer"),capture:makeFunctionReference<"mutation">("guard:capture")};
export type Peer = (c:Case, dispatchIdentity:string, signal:AbortSignal)=>Promise<Observation>;
/** Owned bounded promise accounting, including action entry/reservation/peer and late capture.
 * Deadlines fence local work; they never manufacture upstream termination/zero charge. */
export class Lifecycle {
  pending=0; timedOut=false; private tasks=new Set<Promise<unknown>>();
  track<T>(promise:Promise<T>):Promise<T>{this.pending++;const task=promise.finally(()=>{this.pending--;this.tasks.delete(task);});this.tasks.add(task);return task;}
  async bounded<T>(promise:Promise<T>,milliseconds:number):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{this.timedOut=true;reject(new Error("LOCAL_DEADLINE_UNKNOWN"));},milliseconds);})]);}finally{if(timer)clearTimeout(timer);}}
  async complete(milliseconds:number){try{await this.bounded(Promise.allSettled([...this.tasks]),milliseconds);}catch{/* Pending owned handlers remain installed; no terminal inference. */}return {pending:this.pending,timedOut:this.timedOut};}
}
export function buildRunner(peer:Peer|null,timing={entry:1000,peer:15000,persistence:1000,cleanup:1000}) {
  return async function handler(ctx:Context,args:{scenarioId:string;ownerRunId:string}) {
    exact(args,["scenarioId","ownerRunId"]);if(args.ownerRunId!==BINDING.ownerRunId||!CASES.some(c=>c.scenarioId===args.scenarioId))throw new Error("NO_PERMIT");
    const life=new Lifecycle(),abort=new AbortController();
    const execution=life.track((async()=>{
      const identity=await life.bounded(life.track(ctx.auth.getUserIdentity()),timing.entry);if(!identity||identity.tokenIdentifier!==BINDING.principal)throw new Error("FORBIDDEN");
      // No paid/native factory exists in this packet. Default action cannot provision/reserve or lookup tokens.
      if(!peer)throw new Error("OFFICIAL_NATIVE_DRIVER_NOT_IMPLEMENTED");
      const ticket=await life.bounded(life.track(ctx.runMutation(REFERENCES.reserve,{...args,principal:identity.tokenIdentifier})),timing.entry) as {dispatch:boolean;dispatchIdentity:string;status:string};
      if(!ticket.dispatch)return {status:ticket.status,dispatched:false};
      const c=CASES.find(c=>c.scenarioId===args.scenarioId)!;
      // Entry deadline may expire during reservation. A late committed checkpoint never invokes closure.
      if(life.timedOut)return {status:"checkpoint-unknown",dispatched:false};
      const fence=await life.bounded(life.track(ctx.runMutation(REFERENCES.enter,{...args,principal:identity.tokenIdentifier,dispatchIdentity:ticket.dispatchIdentity})),timing.entry) as {enter:boolean};
      if(!fence.enter||life.timedOut)return {status:"fenced-unknown",dispatched:false};
      const observed=life.track(Promise.resolve().then(()=>peer(c,ticket.dispatchIdentity,abort.signal)));
      const captured=life.track(observed.then(r=>ctx.runMutation(REFERENCES.capture,{scenarioId:c.scenarioId,dispatchIdentity:ticket.dispatchIdentity,observationCanonical:canonical(r)})));
      await life.bounded(captured,timing.peer+timing.persistence);return {status:"captured",dispatched:true};
    })());
    try {return await life.bounded(execution,timing.entry+timing.peer+timing.persistence);}catch(error){abort.abort();throw error;}finally{await life.complete(timing.cleanup);}
  };
}
/** Published action is fail closed. Composition/native profile must be separately implemented/reviewed. */
export const run = actionGeneric({args:{scenarioId:v.string(),ownerRunId:v.string()},handler:buildRunner(null)});
