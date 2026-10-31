import type { RecallItem } from "../types/index.js";
import type { SourceLineage } from "./contracts.js";
import type { EffectiveMemoryEffortPolicy, MemoryEffortStopReason } from "./memory-effort.js";
import { emptyMemoryEffortTrace } from "./memory-effort.js";
export interface MemoryEvidenceNode { key: string; item: RecallItem; lineage: SourceLineage; depth?: number; path?: string[]; literalPropertyPriority?: true }
export interface MemoryEvidenceEdge { node: MemoryEvidenceNode; relationship: "supporting-source" | "derived-fact" | "exact-entity" }
export interface MemoryEvidencePage { edges: MemoryEvidenceEdge[]; cursor: string | null; unavailableStages?: string[]; work?: number }
/** BFS over actual bounded adjacency. Membership/hydration rows never add depth. */
export async function traverseMemoryEvidence(input: {
  seeds: readonly MemoryEvidenceNode[]; policy: EffectiveMemoryEffortPolicy; now(): number; startedAt?: number;
  cancelled?(): boolean | Promise<boolean>;
  /** Private native caller: every seed finished its full bind before expiry.
   * Allows pure bounded fitting after time expires, never another edge read. */
  retainValidatedSeedPrefixOnDeadline?: true;
  expand(node: MemoryEvidenceNode, cursor: string | null, limit: number): Promise<MemoryEvidencePage>;
}) {
  if(input.startedAt!==undefined&&(!Number.isFinite(input.startedAt)||input.startedAt<0))throw new Error("INVALID_INPUT: invalid retrieval work start");
  const enteredAt = input.now(), start = input.policy.evidenceRankingVersion!==1||input.startedAt === undefined ? enteredAt : Math.min(enteredAt, input.startedAt);
  const trace = emptyMemoryEffortTrace(input.policy), seen = new Map<string, MemoryEvidenceNode>();
  const queue: MemoryEvidenceNode[] = [], selected: MemoryEvidenceNode[] = [];
  let work = 0,candidateBytes=0;
  const unitsFor=(node:MemoryEvidenceNode)=>new TextEncoder().encode(JSON.stringify({content:node.item.content,key:node.key,depth:node.depth,path:node.path})).length;
  const stop = (reason: MemoryEffortStopReason) => { if (!trace.stopReasons.includes(reason)) trace.stopReasons.push(reason); };
  const add = (node: MemoryEvidenceNode, depth: number, path: string[]) => {
    if (!Number.isFinite(node.item.score) || node.item.score <= 0) { stop("relevance"); return; }
    if (seen.has(node.key)) { trace.deduplicated++; return; }
    const bytes=new TextEncoder().encode(JSON.stringify({key:node.key,content:node.item.content,path})).length;
    if(candidateBytes+bytes>input.policy.maxCandidateBytes){stop("work");return;}candidateBytes+=bytes;
    const next = { ...node, depth, path }; seen.set(node.key, next); queue.push(next); trace.reachedDepth = Math.max(trace.reachedDepth, depth);
  };
  const bounded = async () => {
    if (await input.cancelled?.()) { stop("cancellation"); return true; }
    if (input.now() - start >= input.policy.retrievalDeadlineMs) { stop("deadline"); return true; }
    if (work >= input.policy.maxWork) { stop("work"); return true; } return false;
  };
  for (const seed of input.seeds.slice(0,input.policy.maxWork).sort((a,b) => (input.policy.evidenceRankingVersion===1?Number(!!b.literalPropertyPriority)-Number(!!a.literalPropertyPriority):0)
    || b.item.score-a.item.score || a.key.localeCompare(b.key))) {
    if (input.policy.evidenceRankingVersion===1&&await bounded()
      && !(input.retainValidatedSeedPrefixOnDeadline&&trace.stopReasons.includes("deadline")&&!trace.stopReasons.includes("cancellation")&&!trace.stopReasons.includes("work"))) break;
    if (++work > input.policy.maxWork) { stop("work"); break; } add(seed, 1, [seed.key]);
  }
  // An empty/retired frontier must still report a spent inherited work budget.
  if (input.policy.evidenceRankingVersion===1&&!queue.length) await bounded();
  for (let index=0; index<queue.length; index++) {
    if (await bounded()) break;
    const node = queue[index]!;
    if (input.policy.maxEntries !== null && selected.length >= input.policy.maxEntries) { stop("entries"); break; }
    // Conservative UTF-8 units include metadata/citations and never undercount text.
    const units = unitsFor(node);
    if (trace.selectedInputUnits + units > input.policy.maxContextTokens) { stop("input"); continue; }
    selected.push(node); trace.selectedInputUnits += units;
    if (input.policy.maxDepth !== null && node.depth! >= input.policy.maxDepth) { stop("depth"); continue; }
    let cursor: string | null = null;
    do {
      if (await bounded()) break;
      const page = await input.expand(node,cursor,Math.min(input.policy.pageSize,input.policy.maxWork-work));
      work += Math.max(1,page.work ?? page.edges.length); trace.expanded++;
      if (await bounded()) break;
      for (const stage of page.unavailableStages ?? []) if (!trace.unavailableStages.includes(stage)) trace.unavailableStages.push(stage);
      for (const edge of page.edges) add(edge.node,node.depth!+1,[...node.path!,edge.node.key]);
      if (page.cursor === cursor && page.cursor !== null) throw new Error("INVALID_STATE: adjacency cursor did not advance");
      cursor = page.cursor;
    } while (cursor !== null);
  }
  if(input.retainValidatedSeedPrefixOnDeadline&&trace.stopReasons.includes("deadline")&&!trace.stopReasons.includes("cancellation")){
    if(await input.cancelled?.())stop("cancellation");
    else {
      // Only already-bound depth1 seeds are added to the selected prefix. This
      // pass is pure, shares the original caps, and cannot imply full discovery.
      const keys=new Set(selected.map(node=>node.key)),candidates=[...selected,...queue.filter(node=>node.depth===1&&!keys.has(node.key))]
        .sort((a,b)=>Number(!!b.literalPropertyPriority)-Number(!!a.literalPropertyPriority)||b.item.score-a.item.score||a.key.localeCompare(b.key));
      const fitted:MemoryEvidenceNode[]=[];let units=0;
      for(const node of candidates){
        if(input.policy.maxEntries!==null&&fitted.length>=input.policy.maxEntries){stop("entries");break;}
        const nextUnits=unitsFor(node);if(units+nextUnits>input.policy.maxContextTokens){stop("input");continue;}
        fitted.push(node);units+=nextUnits;
      }
      selected.splice(0,selected.length,...fitted);trace.selectedInputUnits=units;
    }
  }
  if(input.policy.evidenceRankingVersion===1){
    // Discovery remains BFS: moving a deeper frontier node ahead of unexpanded
    // parents could bind a non-shortest path. After any selection shedding,
    // include all already discovered/current literal evidence, even if it was
    // encountered but did not fit beside weaker entries. No edge is read here.
    const selectedKeys=new Set(selected.map(node=>node.key));
    const frontier=queue.filter(node=>node.literalPropertyPriority&&!selectedKeys.has(node.key));
    if(frontier.length&&!trace.stopReasons.includes("cancellation")&&!trace.stopReasons.includes("deadline")){
      if(await input.cancelled?.())stop("cancellation");
      else if(input.now()-start>=input.policy.retrievalDeadlineMs)stop("deadline");
      else {
        const candidates=[...selected,...frontier].sort((a,b)=>Number(!!b.literalPropertyPriority)-Number(!!a.literalPropertyPriority));
        const fitted:MemoryEvidenceNode[]=[];let units=0;
        for(const node of candidates){
          if(input.policy.maxEntries!==null&&fitted.length>=input.policy.maxEntries){stop("entries");break;}
          const nextUnits=unitsFor(node);
          if(units+nextUnits>input.policy.maxContextTokens){stop("input");continue;}
          fitted.push(node);units+=nextUnits;
        }
        // The local pass shares the original clock/budget; a late pass cannot
        // replace the previously selected output or extend retrieval time.
        if(input.now()-start>=input.policy.retrievalDeadlineMs)stop("deadline");
        else {selected.splice(0,selected.length,...fitted);trace.selectedInputUnits=units;}
      }
    }
  }
  trace.visited=seen.size; trace.selected=selected.length; trace.durationMs=Math.max(0,input.now()-start);
  for(const node of selected) trace.entriesByKind[node.item.type]++;
  if(trace.unavailableStages.length) stop("unavailable");
  if(!trace.stopReasons.length) stop("exhausted");
  return { nodes:selected, trace };
}
