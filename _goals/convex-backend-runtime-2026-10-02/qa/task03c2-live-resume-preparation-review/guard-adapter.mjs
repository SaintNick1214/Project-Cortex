import {lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import * as actual from '/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task03c2-live-resume-fixture/scripts/guard.mjs';
export const root=actual.root;
export const scratch='/workspace/Project-Cortex/work/resume/fresh-identity-review';
export const canonical=actual.canonical,validateTarget=actual.validateTarget,livePreflight=actual.livePreflight;
export {writeEvidence} from './evidence-adapter.mjs';
export function localPreflight(name){actual.localPreflight();if(name===undefined)return; if(typeof name!=='string'||!/^[a-z0-9][a-z0-9.-]*\.json$/.test(name))throw Error('OFFLINE_REJECT');const output=actual.canonical(resolve(scratch,'evidence',name),scratch);if(lstatSync(output,{throwIfNoEntry:false}))throw Error('OFFLINE_REJECT');return output;}
