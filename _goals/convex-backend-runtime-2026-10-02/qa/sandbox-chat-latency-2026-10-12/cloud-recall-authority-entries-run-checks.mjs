import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const cwd='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const q=`${cwd}/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12`;
const node='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node';
const config={preset:'ts-jest/presets/default-esm',testEnvironment:'node',roots:['<rootDir>/tests'],testMatch:['**/*.test.ts'],extensionsToTreatAsEsm:['.ts'],transform:{'^.+\\.(ts|tsx|js)$':['ts-jest',{useESM:true,tsconfig:{allowJs:true,module:'ESNext',moduleResolution:'bundler'}}]},moduleNameMapper:{'^(\\.{1,2}/.*)\\.js$':'$1'},transformIgnorePatterns:['node_modules/(?!(convex|openai))']};
const paths=['authority-scope-entries','repository','profiles','services','public-boundary','public-functional','vector-delivery-batch','public-closure'].map(x=>`tests/unit/runtimeMemory/${x}.test.ts`);
paths.push(...['context','context-permissions','cached-compatibility'].map(x=>`tests/unit/runtimeIngestion/${x}.test.ts`));
paths.push(...['admission-native','observation-native','observe-delivery'].map(x=>`tests/unit/client-runtime/${x}.test.ts`));
paths.push(...['model-policy-admission','model-policy-model-drift','profile-policy-selection'].map(x=>`tests/unit/runtime/${x}.test.ts`));
paths.push('tests/unit/runtimeAuth/authority-read-scope.test.ts');
paths.push(...['memory-context','model-policy','sources','profile'].map(x=>`tests/unit/domain/${x}.test.ts`));
const jest=['--experimental-vm-modules','node_modules/jest/bin/jest.js',`--config=${JSON.stringify(config)}`,'--runInBand','--runTestsByPath',...paths];
const cases=[['discovery',['--experimental-vm-modules','node_modules/jest/bin/jest.js',`--config=${JSON.stringify(config)}`,'--runInBand','--listTests','--runTestsByPath',...paths]],
['affected',[...jest,'--json',`--outputFile=${q}/cloud-recall-authority-entries-affected-v2.json`]],['backend-types',['node_modules/typescript/bin/tsc','--project','convex-dev/tsconfig.json','--noEmit']],['root-types-final',['node_modules/typescript/bin/tsc','--noEmit']],['lint-types',['node_modules/typescript/bin/tsc','--project','tsconfig.lint.json','--noEmit']],['eslint',['node_modules/eslint/bin/eslint.js','convex-dev/runtimeMemory.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeClient.ts','tests/unit/runtimeMemory/authority-scope-entries.test.ts','--report-unused-disable-directives','--max-warnings=0']]];
const hash=x=>createHash('sha256').update(x).digest('hex');
const records=[];
for(const [name,args] of cases){
 const result=spawnSync(node,args,{cwd,env:{...process.env,CORTEX_TEST_ENV_MODE:'explicit',CONVEX_URL:'http://127.0.0.1:9'},encoding:'utf8',maxBuffer:8*1024*1024});
 const log=`cloud-recall-authority-entries-${name}-v2.log`;const output=(result.stdout??'')+(result.stderr??'');writeFileSync(`${q}/${log}`,output);
 const record={name,node,nodeVersion:process.version,args,cwd,exitCode:result.status,signal:result.signal,log,logSha256:hash(output)};records.push(record);writeFileSync(`${q}/cloud-recall-authority-entries-${name}-v2-exit.json`,JSON.stringify(record,null,2)+'\n');
 console.log(JSON.stringify({name,exitCode:result.status}));
}
writeFileSync(`${q}/cloud-recall-authority-entries-checks-final.json`,JSON.stringify({version:1,nodeVersion:process.version,environment:{CORTEX_TEST_ENV_MODE:'explicit',CONVEX_URL:'http://127.0.0.1:9',fixturePortsOnly:true},selectedPaths:paths,checks:records},null,2)+'\n');
