import config from './jest.config.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
export default {...config,setupFiles:[base+'/lifecycle-setup.mjs'],setupFilesAfterEnv:[base+'/lifecycle-after.mjs']};
