/** Prospective K26 metadata projection. Never generalize the three static camel-case labels. */
const scalarKeys=['runId','attemptNumber','phase','at','runBudgetId','semanticId','operationKey','durationMs','bytes','status'];
const selectionKeys=['selectedMessages','selectedMemories','selectedFacts','selectedPending','contextBytes','inputTokens','inputLimit'];
const claimPhases=new Set(['start.claimNext.begin','start.claimNext.end','start.claimNext.failed']);
export function projectK26TraceMetadata(event){
 if(!event||! /^(?:run:|sha256:)?[a-f0-9]{64}$/.test(event.runId??'')
  ||!( /^[a-z0-9.-]{1,128}$/.test(event.phase??'')||claimPhases.has(event.phase))||!Number.isFinite(event.at))return null;
 const projected=Object.fromEntries(scalarKeys.filter(name=>typeof event[name]==='string'||typeof event[name]==='number'&&Number.isFinite(event[name])).map(name=>[name,event[name]]));
 // Only valid prospective native-mutation durations are measured; absent is unavailable.
 if(typeof projected.durationMs!=='number'||!Number.isFinite(projected.durationMs)||projected.durationMs<0)delete projected.durationMs;
 for(const name of selectionKeys)if(Number.isSafeInteger(event[name])&&event[name]>=0)projected[name]=event[name];
 return projected;
}
