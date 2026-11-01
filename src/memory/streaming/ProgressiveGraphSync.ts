/** Progressive graph events follow the actual native partial source; no transient legacy nodes are created. */
import type {GraphAdapter} from "../../graph/types";
import {GraphDatabaseError} from "../../graph/types";
import type {MemoryEntry} from "../../types";
import type {GraphSyncEvent,StreamContext} from "../../types/streaming";
import type {ProgressiveStorageHandler} from "./ProgressiveStorageHandler";
export class ProgressiveGraphSync {
  private events:GraphSyncEvent[]=[];private lastSyncTime=0;private revision=0;
  constructor(private readonly adapter:GraphAdapter,private readonly interval=5000,private readonly storage?:ProgressiveStorageHandler) {}
  private observe(eventType:GraphSyncEvent["eventType"]):string {
    const evidence=this.storage?.getPartialSourceEvidence();
    if(!evidence||!evidence.graphJobs.length)throw new GraphDatabaseError("Progressive graph sync requires actual scoped partial storage and captured native jobs.","GRAPH_PARTIAL_STORAGE_REQUIRED");
    const job=evidence.graphJobs[evidence.graphJobs.length-1];
    if(evidence.sourceRevision>this.revision) {
      this.events.push({timestamp:Date.now(),eventType:evidence.graphDisposition==="queued"?"queued":eventType,nodeId:job.identity.key,
        details:evidence.graphDisposition==="queued"?"Original native graph job queued; delivery is pending.":"Original native partial graph job delivered."});
      this.revision=evidence.sourceRevision;this.lastSyncTime=Date.now();
    }
    return job.identity.key;
  }
  async initializePartialNode(partial:Partial<MemoryEntry>&{memoryId:string}):Promise<string> {
    if(partial.memoryId!==this.storage?.getPartialMemoryId())throw new GraphDatabaseError("Partial graph identity is not the captured native source.","GRAPH_PARTIAL_SELECTION_CHANGED");
    return this.observe("node-created");
  }
  async updatePartialNode(_content:string,_context:StreamContext):Promise<void> {this.observe("node-updated");}
  async finalizeNode(memory:MemoryEntry):Promise<void> {
    if(memory._id!==this.storage?.getPartialSourceEvidence()?.physicalSourceId)throw new GraphDatabaseError("Final primary memory cannot relabel the retained partial source.","GRAPH_PARTIAL_SELECTION_CHANGED");
    this.recordFinalizedPartial();
  }
  recordFinalizedPartial():void {if(!this.storage?.isComplete())throw new GraphDatabaseError("Partial finalization is not acknowledged.","GRAPH_PARTIAL_OUTCOME_UNKNOWN");this.observe("finalized");}
  async rollback():Promise<void> {if(!this.storage)throw new GraphDatabaseError("Captured native partial source is required.","GRAPH_PARTIAL_STORAGE_REQUIRED");/* Storage owns exact guarded deletion/delivery. */}
  shouldSync():boolean {return !!this.storage?.getPartialSourceEvidence()&&Date.now()-this.lastSyncTime>=this.interval;}
  getSyncEvents():GraphSyncEvent[] {return [...this.events];}
  getPartialNodeId():string|null {const evidence=this.storage?.getPartialSourceEvidence();return evidence?.graphJobs[evidence.graphJobs.length-1]?.identity.key??null;}
  reset():void {this.events=[];this.lastSyncTime=0;this.revision=0;}
}
export function createProgressiveGraphSync(adapter:GraphAdapter,interval?:number,storage?:ProgressiveStorageHandler):ProgressiveGraphSync {return new ProgressiveGraphSync(adapter,interval,storage);}
