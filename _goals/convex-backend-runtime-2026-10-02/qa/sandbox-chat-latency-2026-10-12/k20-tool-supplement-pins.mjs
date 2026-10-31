import assert from 'node:assert/strict';
import {requireK20ReadyPins} from './k20-collector-pins.mjs';

/** Deliberate successor inputs; root fills only from genuine hosted observations. */
export const K20_TOOL_PINS=Object.freeze({
  go:false,runId:'UNREADY',operationId:'UNREADY',expectedRequestHash:'UNREADY',
  fixedFourProof:'UNREADY',fixedFourProofSha256:'UNREADY',
  observedWaitingApproval:false,observerDisconnectedReconnected:false,
  approvedOnce:false,finalComplete:false,
});
export function requireK20ToolGo(){
  const ready=requireK20ReadyPins();
  assert.equal(K20_TOOL_PINS.go,true,'UNREADY_K20_TOOL: explicit supplemental GO required');
  assert.match(K20_TOOL_PINS.runId,/^run:[a-f0-9]{64}$/);
  assert.ok(!ready.runIds.includes(K20_TOOL_PINS.runId),'Supplemental run must be separate');
  assert.match(K20_TOOL_PINS.operationId,/^agent-op:[a-f0-9]{64}$/);
  assert.match(K20_TOOL_PINS.expectedRequestHash,/^[a-f0-9]{64}$/);
  assert.match(K20_TOOL_PINS.fixedFourProofSha256,/^[a-f0-9]{64}$/);
  for(const key of ['observedWaitingApproval','observerDisconnectedReconnected','approvedOnce','finalComplete'])
    assert.equal(K20_TOOL_PINS[key],true,'Actual supplemental observation required: '+key);
  return K20_TOOL_PINS;
}
