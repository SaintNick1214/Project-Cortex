/** Read-only deployment-authenticated official Gateway model metadata; no media request. */
import assert from 'node:assert/strict';
import {openOwnedContext} from './common.mjs';
const context=await openOwnedContext();
try{await context.verifyTarget('native-media-metadata1-target-verified');const result=await context.admin.action('mediaMetadata:metadata',{});assert.equal(result.modelCalls,0);await context.publish('native-media-metadata1-outcomes',{scope:'ACTUAL_UNPAID_METADATA_ONLY_NOT_MEDIA_QUALIFICATION',projectId:context.state.projectId,result});console.log(JSON.stringify({status:'METADATA_CAPTURED',httpStatus:result.status,modelCalls:0}));}
catch(error){await context.publish('native-media-metadata1-outcomes',{status:'FAIL_OR_UNKNOWN',scope:'UNPAID_METADATA_ONLY',error:context.publicError(error),modelCalls:0,noBlindRepeat:true});throw error;}finally{await context.close();}
