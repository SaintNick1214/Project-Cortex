import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const { default: config } = await import(pathToFileURL(resolve(root, 'jest.config.mjs')));
const offline = { ...config, rootDir: root, setupFiles: [], setupFilesAfterEnv: [], reporters: ['default'], forceExit: false, watchman: false };
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: 'true', CORTEX_TEST_ENV_MODE: 'explicit', CONVEX_URL: 'https://unit.invalid', CONVEX_URL_CLI: 'https://unit.invalid' };
const result = spawnSync(process.execPath, ['--experimental-vm-modules', resolve(root, 'node_modules/jest/bin/jest.js'), '--config', JSON.stringify(offline), '--runInBand', '--forceExit=false', '--runTestsByPath', 'tests/unit/runtime/gateway-dispatch.test.ts', 'tests/unit/runtime/gateway-terminal-composition.test.ts', '--json', `--outputFile=${output}`], { cwd: root, env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
