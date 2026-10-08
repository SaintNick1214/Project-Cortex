/** Exhaustive LIFO restoration, retaining the first failure and every later failure. */
export function resourceOwner(){
 const actions=[];let closed=false;
 return Object.freeze({
  acquired(stage,cleanup,order=-actions.length){if(closed||typeof cleanup!=='function')throw Error('QA_BRIDGE_RESOURCE_STATE');actions.push({stage,cleanup,order});},
  async close(primary){if(closed)throw Error('QA_BRIDGE_RESOURCE_CLOSED');closed=true;const secondary=[],attempted=[];for(const {stage,cleanup}of actions.sort((a,b)=>a.order-b.order))try{await cleanup();attempted.push({stage,status:'SUCCESS'});}catch(error){attempted.push({stage,status:'FAIL',error:error?.message??String(error)});if(primary===undefined)primary=error;else secondary.push({stage,error});}const proof={allScheduledAttempted:true,scheduled:actions.map(x=>x.stage),attempted};if(primary!==undefined){if(!(primary instanceof Error))primary=Error(String(primary));if(!Object.isExtensible(primary))primary=new AggregateError([primary,...secondary.map(x=>x.error)],primary.message,{cause:primary});Object.defineProperty(primary,'qaCleanupProof',{value:proof,enumerable:true,configurable:true});Object.defineProperty(primary,'qaCleanupSecondary',{value:secondary,enumerable:true,configurable:true});throw primary;}return proof;},
  pending:()=>actions.map(x=>x.stage),
 });
}
