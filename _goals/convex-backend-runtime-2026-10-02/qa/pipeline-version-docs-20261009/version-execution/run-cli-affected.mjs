import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const receipt = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (receipt.status !== 'OFFLINE_COMMAND_INPUTS_READY' || receipt.privateCredentialsExported !== false) throw new Error('Qualified command inputs required');
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: 'true', ...receipt.environment };
const files = [
  'tests/unit/template-catalog.test.ts',
  'tests/unit/template-integration.test.ts',
  'tests/unit/templates-ownership.test.ts',
  'tests/commands/install-real.test.ts',
  'tests/commands/node-runtime-real.test.ts',
  'src/utils/__tests__/template-backend.test.ts',
  'src/utils/__tests__/runtime-backend.test.ts',
  'src/utils/__tests__/backend-setup.test.ts',
  'src/utils/__tests__/safe-file.test.ts',
].map(file => resolve('packages/cortex-cli', file));
const flags = process.argv[4] === 'discover' ? ['--listTests', '--json'] : ['--runInBand', '--watchman=false', '--json', `--outputFile=${process.argv[3]}`];
const result = spawnSync('npm', ['run', 'test:fast', '--workspace=@cortexmemory/cli', '--', ...flags, '--runTestsByPath', ...files], { cwd: process.cwd(), env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
