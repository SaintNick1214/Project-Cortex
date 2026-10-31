/** Read-only carried financial baseline. No account mutation, reset or scope restoration. */
import assert from 'node:assert/strict';
import {openOwnedContext} from './common.mjs';
const context=await openOwnedContext();
try {
 const tenants=[['task10-fe3a2599-d6fd-41f1-984e-141c8373423e',100000],['task10-fe3a2599-d6fd-41f1-984e-141c8373423e-managed',400000]];
 const rows=await Promise.all(tenants.map(async([tenantId,expected])=>{
  const ledger=await context.admin.query('mediaProbe:ledger',{tenantId});
  const tenant=ledger.accounts.find(row=>row.kind==='tenant');assert.ok(tenant);assert.equal(tenant.reservedUnits+tenant.uncertainUnits+tenant.settledUnits,expected);assert.equal(tenant.activeConcurrency,0);
  return {tenantId,accounts:ledger.accounts,attempts:ledger.attempts,retainedUnits:expected,newAttempts:0};
 }));
 await context.publish('prior-financial1',{status:'PASS',readOnly:true,rows,totalRetainedUnits:500000,allSlotsReleased:true,retiredScopesRestored:false,modelCalls:0});
 console.log(JSON.stringify({status:'PRIOR_LIABILITY_PRESERVED',totalRetainedUnits:500000,newAttempts:0}));
}finally{await context.close();}
