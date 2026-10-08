import config from '../../../../jest.config.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {repositoryRoot} from './repository-location.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
export default {...config,rootDir:repositoryRoot,roots:[base+'/copies'],setupFiles:[base+'/setup.mjs'],setupFilesAfterEnv:[],reporters:['default'],cacheDirectory:base+'/cache',testPathIgnorePatterns:['/node_modules/']};
