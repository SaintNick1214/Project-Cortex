"""Finite controlled tests only. No graph/network/target port is created."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
OWN = pathlib.Path(__file__).resolve().parent
label, test_file, source_file = sys.argv[1:]
assert '/' not in label and test_file.endswith('.test.ts')
assert (OWN / test_file).resolve().parent == OWN
source = ROOT / source_file

def digest():
    body = source.read_bytes()
    return {'path': str(source), 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}

command = ['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node',
           '--experimental-vm-modules', str(ROOT / 'node_modules/jest/bin/jest.js'), '--config', str(OWN / 'independent.config.mjs'),
           '--runInBand', '--runTestsByPath', str(OWN / test_file), '--json', '--outputFile', str(OWN / (label + '.results.json'))]
before = digest()
started = time.monotonic()
env = os.environ.copy()
env['CONVEX_URL'] = 'http://127.0.0.1:1'
with (OWN / (label + '.stdout.txt')).open('w') as out, (OWN / (label + '.stderr.txt')).open('w') as err:
    process = subprocess.Popen(command, cwd=ROOT, stdout=out, stderr=err, env=env)
    timed_out = False
    try:
        result = process.wait(timeout=50)
    except subprocess.TimeoutExpired:
        timed_out = True
        process.terminate()
        try:
            result = process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            result = process.wait(timeout=5)
receipt = {'command': command, 'cwd': str(ROOT), 'pid': process.pid, 'exitCode': result,
           'elapsedSeconds': time.monotonic() - started, 'timedOut': timed_out, 'ownedChildWaited': True,
           'scope': 'CONTROLLED_CODE_NO_SERVICE', 'sourceBefore': before, 'sourceAfter': digest()}
(OWN / (label + '.command.json')).write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
print((OWN / (label + '.stderr.txt')).read_text()[-7000:])
