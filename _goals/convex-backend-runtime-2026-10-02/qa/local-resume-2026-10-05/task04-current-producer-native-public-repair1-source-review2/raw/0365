import identity from './fs-identity.cjs';
import path from 'node:path';import {composition} from './composition-engine.mjs';
const W=path.dirname(new URL(import.meta.url).pathname);
export function prepareComposition(id,...extra){if(extra.length)throw Error('QA_BRIDGE_COMMAND_ID');const c=composition({id,entry:path.join(W,'composition-runtime-controls.mjs')});return Object.freeze({...c,async installOwnReviewPorts(entry){if(entry!==path.join(W,'composition-runtime-controls.mjs'))throw Error('QA_BRIDGE_OWN_CONTROL_ONLY');return c.install();}});}
