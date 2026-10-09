/** Progressive native storage owns a captured physical handle, distinct from the final remember record. */
import type {ConvexClient} from "convex/browser";
import {ConvexError} from "convex/values";
import {api} from "../../common/backendApi";
import type {Id} from "../../../convex-dev/_generated/dataModel";
import type {PartialUpdate,PartialSourceEvidence} from "../../types/streaming";
import type {GraphAdapter,GraphSyncPolicy,GraphJobReceipt} from "../../graph/types";
import {GraphCommittedPartial,GraphPrimaryOutcomeUnknown,GraphDatabaseError} from "../../graph/types";
import {writeGraphMutation} from "../../graph/erasure";
export interface PartialStorageGraphOptions {tenantId?:string;adapter?:GraphAdapter;policy?:GraphSyncPolicy;syncToGraph?:boolean;}
export class ProgressiveStorageHandler {
  private partialMemoryId:string|null=null;private lastUpdateTime=0;private updateHistory:PartialUpdate[]=[];
  private isInitialized=false;private isFinalized=false;private source?:PartialSourceEvidence;
  private unknown=false;private deleted=false;
  constructor(private readonly client:ConvexClient,private readonly memorySpaceId:string,private readonly conversationId:string,
    private readonly userId:string,private readonly updateInterval=3000,private readonly graph:PartialStorageGraphOptions={}) {}
  private adopt(value:unknown,jobs?:GraphJobReceipt[]):void {
    const result=value as {_id?:string;memoryId?:string;sourceRevision?:number;referenceGeneration?:string;ownershipRevision?:number;graphJobs?:GraphJobReceipt[];graphDisposition?:"queued"|"delivered"};
    if(!result||typeof result._id!=="string"||typeof result.memoryId!=="string"||!Number.isSafeInteger(result.sourceRevision)||!result.referenceGeneration||!Number.isSafeInteger(result.ownershipRevision))
      throw new GraphDatabaseError("Native partial storage did not return captured physical evidence.","GRAPH_PARTIAL_SOURCE_UNRESOLVED");
    if(this.source&&(this.source.physicalSourceId!==result._id||this.source.memoryId!==result.memoryId||this.source.referenceGeneration!==result.referenceGeneration))
      throw new GraphDatabaseError("Native partial identity changed.","GRAPH_PARTIAL_SELECTION_CHANGED");
    const receipts=jobs??result.graphJobs??[],prior=this.source?.graphJobs??[];
    for(const receipt of receipts)if(receipt.identity.physicalSourceId!==result._id||receipt.identity.tenantId!==(this.graph.tenantId??null)||receipt.identity.memorySpaceId!==this.memorySpaceId)
      throw new GraphDatabaseError("Foreign partial graph receipt.","GRAPH_SCOPE_MISMATCH");
    this.source={memoryId:result.memoryId,physicalSourceId:result._id,sourceRevision:result.sourceRevision!,referenceGeneration:result.referenceGeneration,
      ownershipRevision:result.ownershipRevision!,tenantId:this.graph.tenantId,memorySpaceId:this.memorySpaceId,
      graphJobs:[...prior,...receipts.filter(r=>!prior.some(p=>p.id===r.id&&p.generation===r.generation))],graphDisposition:result.graphDisposition};
    this.partialMemoryId=result.memoryId;this.isInitialized=true;
  }
  private failed(error:unknown,finalizing=false):void {
    if(error instanceof GraphCommittedPartial){this.adopt(error.primaryResult,error.jobs);if(finalizing)this.isFinalized=true;if(error.graphOutcome==="unknown")this.unknown=true;}
    else if(error instanceof GraphPrimaryOutcomeUnknown || !(error instanceof ConvexError || error instanceof GraphDatabaseError))this.unknown=true;
  }
  private guards() {
    if(!this.source||this.unknown||this.deleted)throw new GraphDatabaseError("Partial response settlement is unresolved; do not retry or delete it.","GRAPH_PARTIAL_OUTCOME_UNKNOWN");
    return {memorySpaceId:this.memorySpaceId,tenantId:this.graph.tenantId,memoryId:this.source.memoryId,expectedPhysicalId:this.source.physicalSourceId as Id<"memories">,
      expectedSourceRevision:this.source.sourceRevision,expectedReferenceGeneration:this.source.referenceGeneration};
  }
  async initializePartialMemory(params:{participantId?:string;userMessage:string;importance?:number;tags?:string[]}):Promise<string> {
    if(this.isInitialized||this.unknown)throw new Error("Partial memory already initialized or unresolved");
    try {
      const result=await writeGraphMutation(this.client,this.graph.adapter,this.graph.policy,api.memories.storePartialMemory,{
        memorySpaceId:this.memorySpaceId,tenantId:this.graph.tenantId,participantId:params.participantId,conversationId:this.conversationId,userId:this.userId,
        content:"[Streaming in progress...]",isPartial:true,metadata:{userMessage:params.userMessage,streamStartTime:Date.now()},importance:params.importance??50,tags:[...(params.tags??[]),"streaming","partial"]},this.graph.syncToGraph);
      this.adopt(result);this.lastUpdateTime=Date.now();return result.memoryId;
    }catch(error){this.failed(error);throw error;}
  }
  async updatePartialContent(content:string,chunkNumber:number,force=false):Promise<boolean> {
    if(!this.isInitialized)throw new Error("Partial memory not initialized");if(this.isFinalized)return false;
    const now=Date.now();if(!force&&now-this.lastUpdateTime<this.updateInterval)return false;
    try {
      const result=await writeGraphMutation(this.client,this.graph.adapter,this.graph.policy,api.memories.updatePartialMemory,{...this.guards(),content,
        metadata:{lastUpdateTime:now,currentChunk:chunkNumber,contentLength:content.length}},this.graph.syncToGraph);
      this.adopt(result);this.lastUpdateTime=now;this.updateHistory.push({timestamp:now,memoryId:this.partialMemoryId!,contentLength:content.length,chunkNumber});return true;
    }catch(error){this.failed(error);if(this.graph.adapter&&this.graph.syncToGraph!==false)throw error;console.warn("Partial update failed; its physical settlement is retained.");return false;}
  }
  async finalizeMemory(fullContent:string,embedding?:number[]):Promise<void> {
    if(!this.isInitialized)throw new Error("Partial memory not initialized");if(this.isFinalized)return;
    try {
      const result=await writeGraphMutation(this.client,this.graph.adapter,this.graph.policy,api.memories.finalizePartialMemory,{...this.guards(),content:fullContent,embedding,
        metadata:{streamCompleteTime:Date.now(),totalUpdates:this.updateHistory.length,finalContentLength:fullContent.length}},this.graph.syncToGraph);
      this.adopt(result);this.isFinalized=true;
    }catch(error){this.failed(error,true);throw error;}
  }
  async rollback():Promise<void> {
    // Never relabel/delete the separate final memory, a finalized retained partial, or an uncertain response.
    if(!this.source||this.isFinalized||this.unknown||this.deleted)return;
    try {
      await writeGraphMutation(this.client,this.graph.adapter,this.graph.policy,api.memories.deleteMemory,{...this.guards(),expectedPartial:true},this.graph.syncToGraph);
      this.deleted=true;this.partialMemoryId=null;this.isInitialized=false;
    }catch(error){if(error instanceof GraphCommittedPartial){this.deleted=true;if(error.graphOutcome==="unknown")this.unknown=true;this.source.graphJobs.push(...error.jobs);}else this.failed(error);throw error;}
  }
  shouldUpdate():boolean {return this.isReady()&&Date.now()-this.lastUpdateTime>=this.updateInterval;}
  getPartialMemoryId():string|null {return this.partialMemoryId;}
  getPartialSourceEvidence():PartialSourceEvidence|undefined {return this.source?{...this.source,graphJobs:[...this.source.graphJobs]}:undefined;}
  isOutcomeUnknown():boolean {return this.unknown;}
  wasDeleted():boolean {return this.deleted;}
  getUpdateHistory():PartialUpdate[] {return [...this.updateHistory];}
  isReady():boolean {return this.isInitialized&&!this.isFinalized&&!this.unknown&&!this.deleted;}
  isComplete():boolean {return this.isFinalized;}
}

/**
 * Helper to estimate optimal update interval based on stream characteristics
 */
export function calculateOptimalUpdateInterval(
  averageChunkSize: number,
  chunksPerSecond: number,
): number {
  // If stream is very fast, update less frequently to reduce load
  if (chunksPerSecond > 10) {
    return 5000; // 5 seconds
  }

  // If stream is slow, update more frequently for better progress tracking
  if (chunksPerSecond < 1) {
    return 1000; // 1 second
  }

  // Default: 3 seconds
  return 3000;
}
