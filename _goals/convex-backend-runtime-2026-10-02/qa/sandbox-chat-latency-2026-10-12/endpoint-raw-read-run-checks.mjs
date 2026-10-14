import { readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const r = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const q = `${r}/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12`;
const node = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node';
const npm = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
const source = ['convex-dev/runtimeAgent.ts', 'convex-dev/runtimeModelPolicy.ts', 'tests/unit/runtimeAgent/endpoint-raw-read-scopes.test.ts'];
const suites = [
 'tests/unit/runtimeAgent/endpoint-raw-read-scopes.test.ts',
 'tests/unit/runtimeAgent/checkpoint-composition.test.ts', 'tests/unit/runtimeAgent/turn-native-composition.test.ts',
 'tests/unit/runtimeAgent/turn-action.test.ts', 'tests/unit/runtimeAgent/tool-context.test.ts',
 'tests/unit/runtimeAgent/native-transcript-read-parent.test.ts', 'tests/unit/runtimeAgent/turn-workflow.test.ts',
 'tests/unit/runtimeAuth/authority-read-scope.test.ts', 'tests/unit/runtimeAuth/native-transcript-read-scope.test.ts',
 'tests/unit/runtimeAuth/policy-metadata-read-scope.test.ts', 'tests/unit/runtimeAuth/authority.test.ts',
 'tests/unit/runtimeAuth/provisioning.test.ts', 'tests/unit/runtimeTranscript/managed.test.ts',
 'tests/unit/runtimeTranscript/contracts.test.ts', 'tests/unit/runtime/model-policy-admission.test.ts',
 'tests/unit/runtime/profile-policy-selection.test.ts', 'tests/unit/runtime/model-policy-model-drift.test.ts',
 'tests/unit/runtime/gateway-backend.test.ts', 'tests/unit/runtime/gateway-dispatch.test.ts',
 'tests/unit/runtime/gateway-terminal-composition.test.ts', 'tests/unit/runtimeMemory/repository.test.ts',
 'tests/unit/runtimeMemory/profiles.test.ts', 'tests/unit/runtimeMemory/public-boundary.test.ts',
];
const hashes = () => Object.fromEntries(source.map(file => [file, createHash('sha256').update(readFileSync(`${r}/${file}`)).digest('hex')]));
const env = { ...process.env, PATH: `${node.slice(0,node.lastIndexOf('/'))}:${process.env.PATH}`, CORTEX_TEST_ENV_MODE: 'explicit', CONVEX_URL: 'http://127.0.0.1:9' };
const checks = [];
const receipt = `${q}/endpoint-raw-read-final-checks.json`;
const selected = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runTestsByPath', ...suites];
const commands = [
 ['root-types-final-v2', ['node_modules/typescript/bin/tsc', '--noEmit']],
 ['backend-types-final', ['node_modules/typescript/bin/tsc', '--project', 'convex-dev/tsconfig.json', '--noEmit']],
 ['lint-types-final', ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.lint.json', '--noEmit']],
 ['scoped-lint-final', ['node_modules/eslint/bin/eslint.js', ...source, '--report-unused-disable-directives']],
 ['discovery-final', [...selected, '--listTests', '--json', '--runInBand', '--watchman=false', '--forceExit=false']],
 ['affected-final', [...selected, '--runInBand', '--watchman=false', '--forceExit=false', '--json', `--outputFile=${q}/endpoint-raw-read-affected-final.json`]],
 ['root-lint-final', [npm, 'run', 'lint']],
 ['build-final', [npm, 'run', 'build']],
 ['contracts-final', [npm, 'run', 'test:contracts']],
];
for (const [name, args] of commands) {
 const log = `${q}/endpoint-raw-read-${name}.log`, fd = openSync(log, 'wx', 0o600), before = hashes(), start = performance.now();
 const result = spawnSync(node, args, { cwd:r,env,stdio:['ignore',fd,fd] }); closeSync(fd);
 const check = {name,command:[node,...args],cwd:r,exitCode:result.status,signal:result.signal,elapsedMs:performance.now()-start,before,after:hashes(),log};
 if (name === 'affected-final' && result.status === 0) { const j=JSON.parse(readFileSync(`${q}/endpoint-raw-read-affected-final.json`,'utf8'));check.counts={discovered:j.numTotalTests,passed:j.numPassedTests,failed:j.numFailedTests,skipped:j.numPendingTests,todo:j.numTodoTests,suites:j.numTotalTestSuites,passedSuites:j.numPassedTestSuites}; }
 if (name === 'discovery-final' && result.status === 0) check.discoveredSuites=JSON.parse(readFileSync(log,'utf8')).length;
 checks.push(check);writeFileSync(receipt,JSON.stringify({sourceBaseline:'6156ea97aa8776accee52879176cdcd12e802d89',explicitOffline:true,selectedSuites:suites,reusedPassingSuites:['tests/unit/runtimeAgent/execution.test.ts','tests/unit/runtimeAgent/model-owner.test.ts','tests/unit/runtimeMemory/authority-scope-entries.test.ts','tests/unit/runtimeMemory/vector-delivery-batch.test.ts'],reusedReceipt:`${q}/endpoint-raw-read-focused-v1.json`,checks},null,2)+'\n');
 console.log(JSON.stringify({name,exitCode:result.status,...(check.counts??{})}));
 if (result.status !== 0) process.exit(result.status??1);
}
