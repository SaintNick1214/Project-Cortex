import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const cwd='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const q=`${cwd}/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12`;
const node='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node';
const config={preset:'ts-jest/presets/default-esm',testEnvironment:'node',roots:['<rootDir>/tests'],testMatch:['**/*.test.ts'],extensionsToTreatAsEsm:['.ts'],transform:{'^.+\\.(ts|tsx|js)$':['ts-jest',{useESM:true,tsconfig:{allowJs:true,module:'ESNext',moduleResolution:'bundler'}}]},moduleNameMapper:{'^(\\.{1,2}/.*)\\.js$':'$1'},transformIgnorePatterns:['node_modules/(?!(convex|openai))']};
const paths=['context-routing','empty-context-inline','empty-context-workflow','context-latency','context-source-composition','inline-barrier','execution','model-owner'].map(x=>`tests/unit/runtimeAgent/${x}.test.ts`);
paths.push('tests/unit/runtimeIngestion/context.test.ts','tests/unit/runtimeIngestion/context-permissions.test.ts');
const jest=['--experimental-vm-modules','node_modules/jest/bin/jest.js',`--config=${JSON.stringify(config)}`,'--runInBand','--runTestsByPath',...paths];
const cases=[['discovery',['--experimental-vm-modules','node_modules/jest/bin/jest.js',`--config=${JSON.stringify(config)}`,'--runInBand','--listTests','--runTestsByPath',...paths]],
['affected',[...jest,'--json',`--outputFile=${q}/cloud-context-routing-affected-v1.json`]],['backend-types',['node_modules/typescript/bin/tsc','--project','convex-dev/tsconfig.json','--noEmit']],['root-types-final',['node_modules/typescript/bin/tsc','--noEmit']],['lint-types',['node_modules/typescript/bin/tsc','--project','tsconfig.lint.json','--noEmit']],['eslint',['node_modules/eslint/bin/eslint.js','convex-dev/runtimeAgent.ts','tests/unit/runtimeAgent/context-routing.test.ts','tests/unit/runtimeAgent/empty-context-inline.test.ts','--report-unused-disable-directives','--max-warnings=0']]];
const hash=x=>createHash('sha256').update(x).digest('hex');
const records=[];
for(const [name,args] of cases){
 const result=spawnSync(node,args,{cwd,env:{...process.env,CORTEX_TEST_ENV_MODE:'explicit',CONVEX_URL:'http://127.0.0.1:9'},encoding:'utf8',maxBuffer:8*1024*1024});
 const log=`cloud-context-routing-${name}-v1.log`;const output=(result.stdout??'')+(result.stderr??'');writeFileSync(`${q}/${log}`,output);
 const record={name,node,nodeVersion:process.version,args,cwd,exitCode:result.status,signal:result.signal,log,logSha256:hash(output)};records.push(record);writeFileSync(`${q}/cloud-context-routing-${name}-v1-exit.json`,JSON.stringify(record,null,2)+'\n');
 console.log(JSON.stringify({name,exitCode:result.status}));
}
writeFileSync(`${q}/cloud-context-routing-checks.json`,JSON.stringify({version:1,nodeVersion:process.version,environment:{CORTEX_TEST_ENV_MODE:'explicit',CONVEX_URL:'http://127.0.0.1:9',fixturePortsOnly:true},selectedPaths:paths,checks:records},null,2)+'\n');
