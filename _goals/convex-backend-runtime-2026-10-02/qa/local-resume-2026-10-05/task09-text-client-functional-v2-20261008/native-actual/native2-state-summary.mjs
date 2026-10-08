import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {qa} from './common.mjs';
const s=JSON.parse(await readFile(join(qa,'native2-inspection-state.json')));
console.log(JSON.stringify({modelOps:s.runtimeModelOperations.map(x=>({operationId:x.operationId,key:x.operationKey,state:x.state,reserved:x.reservedUnits,uncertain:x.uncertainUnits,visible:x.visibleEvidenceHash,toolInputVisible:x.toolInputVisible,toolResultVisible:x.toolResultVisible,terminal:JSON.parse(x.terminalEvidenceCanonical??'null')})),attempts:s.runtimeModelAttempts.map(x=>({operation:x.operationDocumentId,state:x.state,slotReleased:x.slotReleased,resultAttachmentState:x.resultAttachmentState,resultWithheld:x.resultWithheld,outputVisible:x.outputVisible,toolInputVisible:x.toolInputVisible,toolResultVisible:x.toolResultVisible,terminal:JSON.parse(x.terminalEvidenceCanonical??'null')}))},null,2));
