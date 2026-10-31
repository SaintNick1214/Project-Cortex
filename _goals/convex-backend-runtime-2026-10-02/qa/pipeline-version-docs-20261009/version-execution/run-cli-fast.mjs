import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const receipt = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (receipt.status !== 'OFFLINE_COMMAND_INPUTS_READY' || receipt.privateCredentialsExported !== false) throw new Error('Qualified command inputs required');
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: 'true', ...receipt.environment };
const result = spawnSync('npm', ['run', 'test:fast', '--workspace=@cortexmemory/cli', '--', '--runInBand', '--watchman=false', '--json', `--outputFile=${process.argv[3]}`], { cwd: process.cwd(), env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
