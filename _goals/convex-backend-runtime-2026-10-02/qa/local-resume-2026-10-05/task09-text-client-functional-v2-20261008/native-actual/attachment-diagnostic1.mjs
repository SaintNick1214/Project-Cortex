import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,qa,sha} from './common.mjs';
const c=await openOwnedContext();try{
 await c.verifyTarget('attachment-diagnostic1-target-verified');
 const before=await c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId});
 const op=before.runtimeModelOperations.find(x=>x.operationKey==='agent.respond'),attempt=before.runtimeModelAttempts.find(x=>x.operationDocumentId===op._id);assert.equal(attempt.resultAttachmentState,'pending');
 const evidenceId=sha(Buffer.from(JSON.stringify(['native-terminal-evidence-v1',attempt._id,attempt.dispatchIdentity,attempt.terminalEvidenceCanonical,attempt.terminalEvidenceHash])));
 const args={reference:op.reference,attemptId:attempt._id,evidenceId,privateResultCanonical:'{"diagnosticInvalidResult":true}'};
 let result,error;try{result=await c.admin.mutation('runtimeModelPolicy:attachTerminalResult',args);}catch(e){error=c.publicError(e);}
 const after=await c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId});const latest=after.runtimeModelAttempts.find(x=>x._id===attempt._id);
 const report={status:error?'ERROR_DIAGNOSTIC':'DIAGNOSTIC_RETURNED',invalidSentinel:true,noProviderResultReconstruction:true,argumentTypes:Object.fromEntries(Object.entries(args).map(([k,v])=>[k,typeof v])),referenceFieldTypes:Object.fromEntries(Object.entries(op.reference).map(([k,v])=>[k,typeof v])),attemptId:attempt._id,evidenceIdentityComputedFromOriginalCapturedFields:true,result,error,before:{attachment:attempt.resultAttachmentState,withheld:attempt.resultWithheld,modelAttempts:before.runtimeModelAttempts.length},after:{attachment:latest.resultAttachmentState,withheld:latest.resultWithheld,modelAttempts:after.runtimeModelAttempts.length},noNewPaidCall:true};
 await c.publish('attachment-diagnostic1',report);console.log(JSON.stringify(report));assert.equal(after.runtimeModelAttempts.length,before.runtimeModelAttempts.length);if(!error)assert.deepEqual(result,{attached:false,resultWithheld:true});
}finally{await c.close();}
