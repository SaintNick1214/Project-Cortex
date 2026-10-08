/** Candidate freeze only; never creates independent approval or service evidence. */
import { readdirSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { repo, preparation, fixture, sourcePreflight, sha256, canonical } from './guard.mjs';
if(lstatSync(resolve(preparation,'independent-preparation-review.json'),{throwIfNoEntry:false}))throw new Error('Preserve independent reviewed candidate; new review cycle required');
// Before first freeze, verify production copies and immutable history. Future repairs must use a new reviewed candidate.
if(!lstatSync(resolve(preparation,'runtime-freeze.json'),{throwIfNoEntry:false}))sourcePreflight();
const selected=[];
function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){if(['node_modules','_generated','evidence'].includes(entry.name))continue;const path=resolve(directory,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile()&&!entry.name.endsWith('.md')&&!['runtime-freeze.json','offline-receipts.json','independent-preparation-review.json'].includes(entry.name))selected.push(path);}}
walk(preparation);walk(fixture);walk(resolve(repo,'dist'));selected.push(resolve(repo,'package.json'),resolve(repo,'package-lock.json'),resolve(repo,'tests/unit/runtimeMemory/fixture.ts'));
const files=[...new Set(selected)].sort().map(path=>({path:relative(repo,canonical(path,repo)),sha256:sha256(readFileSync(path))}));
writeFileSync(resolve(preparation,'runtime-freeze.json'),JSON.stringify({version:1,state:'FROZEN_CANDIDATE_AWAITING_INDEPENDENT_REVIEW',generatedBindings:'ABSENT_UNTIL_OFFICIAL_CODEGEN_SEPARATE_PRIVATE_RECEIPT',privateArtifactsExcluded:true,files},null,2)+'\n');
sourcePreflight();console.log(JSON.stringify({scope:'OFFLINE_CANDIDATE_FREEZE',status:'PASS',operationalFiles:files.length,candidateSha256:sha256(readFileSync(resolve(preparation,'runtime-freeze.json'))),dispatches:0,signatures:0}));
