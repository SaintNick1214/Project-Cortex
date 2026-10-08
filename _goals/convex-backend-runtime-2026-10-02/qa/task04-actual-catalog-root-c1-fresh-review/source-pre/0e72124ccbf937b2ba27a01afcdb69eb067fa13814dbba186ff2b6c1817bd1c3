import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {composeForControls} from './current-compose.mjs';
const sourceRoot=path.join(path.dirname(fileURLToPath(import.meta.url)),'staged-post-root');
console.log(JSON.stringify(composeForControls(process.argv[2],{sourceRoot})));
