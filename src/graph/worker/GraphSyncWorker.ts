/** Exact-scope reactive worker. One drain owns all deliveries and stop awaits its real work. */
import type {ConvexClient} from "convex/browser";
import {api} from "../../common/backendApi";
import type {Id} from "../../../convex-dev/_generated/dataModel";
import type {GraphAdapter,GraphJob,GraphJobReceipt} from "../types";
import {GraphDatabaseError,GraphJobUnresolved} from "../types";
import {validateGraphJob} from "../identity";
import {deliverGraphJob} from "../erasure";
import {assertManagedGraphCompatibility} from "../schema/initSchema";
export interface GraphSyncWorkerOptions {batchSize?:number;retryAttempts?:number;verbose?:boolean;}
export interface SyncHealthMetrics {isRunning:boolean;totalProcessed:number;successCount:number;failureCount:number;avgSyncTimeMs:number;lastSyncAt?:number;queueSize:number;lastErrorCode?:string;}
export class GraphSyncWorker {
  private readonly options:Required<GraphSyncWorkerOptions>;
  private starting?:Promise<void>;private startGeneration=0;
  private running=false;private unsubscribe?:()=>void;private drain?:Promise<void>;
  private readonly pending=new Map<string,GraphJob>();private totalTime=0;
  private metrics:SyncHealthMetrics={isRunning:false,totalProcessed:0,successCount:0,failureCount:0,avgSyncTimeMs:0,queueSize:0};
  constructor(private readonly client:ConvexClient,private readonly adapter:GraphAdapter,options?:GraphSyncWorkerOptions,
    private readonly scope:{tenantId?:string}={}) {
    const batchSize=options?.batchSize??100,retryAttempts=options?.retryAttempts??3,verbose=options?.verbose??false;
    if(!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>128||!Number.isSafeInteger(retryAttempts)||retryAttempts<1||retryAttempts>10||typeof verbose!=="boolean"||
      scope.tenantId!==undefined&&typeof scope.tenantId!=="string")throw new GraphDatabaseError("Invalid bounded graph worker options.","GRAPH_WORKER_OPTIONS_INVALID");
    this.options={batchSize,retryAttempts,verbose};
  }
  async start():Promise<void> {
    if(this.running)return;
    if(this.starting)return this.starting;
    const generation=++this.startGeneration;
    const starting=(async()=>{
    await assertManagedGraphCompatibility(this.adapter);
    if(generation!==this.startGeneration)return;
    this.running=true;this.metrics.isRunning=true;
    this.unsubscribe=this.client.onUpdate(api.graphSync.getUnsyncedItems,{limit:this.options.batchSize,tenantId:this.scope.tenantId},items=>{
      if(!this.running)return;
      try {
        for(const value of items) {const job=validateGraphJob(value as unknown as GraphJob);
          if(job.identity.tenantId!==(this.scope.tenantId??null))throw new GraphDatabaseError("Foreign graph queue item.","GRAPH_SCOPE_MISMATCH");
          this.pending.set(job._id,job);
        }
        this.metrics.queueSize=items.length;this.schedule();
      }catch(error){this.metrics.lastErrorCode=error instanceof GraphDatabaseError?error.code:"GRAPH_JOB_UNRESOLVED";}
    },()=>{this.metrics.lastErrorCode="GRAPH_QUEUE_TRANSPORT_FAILED";});
    })();
    this.starting=starting;
    try{await starting;}finally{if(this.starting===starting)this.starting=undefined;}
  }
  private schedule():void {
    if(this.drain||!this.running)return;
    this.drain=this.processPending().catch(()=>{this.metrics.lastErrorCode="GRAPH_WORKER_DRAIN_FAILED";}).finally(()=>{
      this.drain=undefined;if(this.running&&this.pending.size)this.schedule();
    });
  }
  private async processPending():Promise<void> {
    while(this.running&&this.pending.size) {
      const [id,job]=this.pending.entries().next().value!;this.pending.delete(id);const start=Date.now();
      const receipt:GraphJobReceipt={id:job._id,generation:job.generation,identity:job.identity,sourceRevision:job.sourceRevision};
      try {await deliverGraphJob(this.client,this.adapter,receipt);this.metrics.successCount++;this.metrics.lastErrorCode=undefined;}
      catch(error) {
        this.metrics.failureCount++;const code=error instanceof GraphJobUnresolved?error.code:error instanceof GraphDatabaseError?error.code??"GRAPH_DELIVERY_FAILED":"GRAPH_ACK_UNKNOWN";
        this.metrics.lastErrorCode=code;
        try {await this.client.mutation(api.graphSync.markFailed,{id:job._id as Id<"graphSyncQueue">,generation:job.generation,
          attemptToken:job.attemptToken,tenantId:this.scope.tenantId,errorCode:/^[A-Z0-9_]{1,96}$/.test(code)?code:"GRAPH_DELIVERY_FAILED",maxAttempts:this.options.retryAttempts});}
        catch {this.metrics.lastErrorCode="GRAPH_FAILURE_ACK_UNRESOLVED";}
      }finally{this.metrics.totalProcessed++;this.totalTime+=Date.now()-start;this.metrics.avgSyncTimeMs=this.totalTime/this.metrics.totalProcessed;this.metrics.lastSyncAt=Date.now();}
    }
  }
  async stop():Promise<void> {
    this.startGeneration++;this.running=false;this.metrics.isRunning=false;this.unsubscribe?.();this.unsubscribe=undefined;
    await this.starting;await this.drain;this.pending.clear();this.metrics.queueSize=0;
  }
  getMetrics():SyncHealthMetrics {return {...this.metrics};}
}
