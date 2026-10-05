import {composeForControls} from './current-compose.mjs';
const sourceRoot='/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-release-c3/staged-post-root';
console.log(JSON.stringify(composeForControls(process.argv[2],{sourceRoot})));
