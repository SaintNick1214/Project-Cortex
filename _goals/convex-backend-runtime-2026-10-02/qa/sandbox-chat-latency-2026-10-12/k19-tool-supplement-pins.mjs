import assert from 'node:assert/strict';
import {requireK19ReadyPins} from './k19-collector-pins.mjs';

/** Deliberate successor inputs; root fills only from genuine hosted observations. */
export const K19_TOOL_PINS=Object.freeze({
  go:false,runId:'UNREADY',operationId:'UNREADY',expectedRequestHash:'UNREADY',
  fixedFourProof:'UNREADY',fixedFourProofSha256:'UNREADY',
  observedWaitingApproval:false,observerDisconnectedReconnected:false,
  approvedOnce:false,finalComplete:false,
});
export function requireK19ToolGo(){
  const ready=requireK19ReadyPins();
  assert.equal(K19_TOOL_PINS.go,true,'UNREADY_K19_TOOL: explicit supplemental GO required');
  assert.match(K19_TOOL_PINS.runId,/^run:[a-f0-9]{64}$/);
  assert.ok(!ready.runIds.includes(K19_TOOL_PINS.runId),'Supplemental run must be separate');
  assert.match(K19_TOOL_PINS.operationId,/^agent-op:[a-f0-9]{64}$/);
  assert.match(K19_TOOL_PINS.expectedRequestHash,/^[a-f0-9]{64}$/);
  assert.match(K19_TOOL_PINS.fixedFourProofSha256,/^[a-f0-9]{64}$/);
  for(const key of ['observedWaitingApproval','observerDisconnectedReconnected','approvedOnce','finalComplete'])
    assert.equal(K19_TOOL_PINS[key],true,'Actual supplemental observation required: '+key);
  return K19_TOOL_PINS;
}
