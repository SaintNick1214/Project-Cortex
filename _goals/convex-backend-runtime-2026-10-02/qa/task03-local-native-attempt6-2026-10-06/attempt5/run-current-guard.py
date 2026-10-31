"""Current frozen-public guard only; negative controls never consume key bytes."""
import datetime
import json
import os
from pathlib import Path
import subprocess

Q = Path(__file__).resolve().parents[1]
OUT = Q / 'attempt5'
NODE = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node'
argv = [NODE, str(Q / 'scripts/offline-guard-check.mjs')]
env = {'PATH': str(Path(NODE).parent) + ':/usr/bin:/bin', 'TMPDIR': str(Q / 'tmp'), 'NODE_OPTIONS': '--require ' + str(Q / 'offline-network-v2.cjs')}
before = set((Q / 'tmp').glob('network-v2-*.json'))
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
result = subprocess.run(argv, cwd=Q.parents[3], env=env, capture_output=True, timeout=45)
for suffix, raw in [('stdout', result.stdout), ('stderr', result.stderr)]:
    with (OUT / ('guard-check.' + suffix)).open('xb') as f:
        f.write(raw)
        f.flush()
        os.fsync(f.fileno())
network = [json.loads(p.read_bytes()) for p in sorted(set((Q / 'tmp').glob('network-v2-*.json')) - before)]
assert network and all(r['deniedAttempts'] == 0 for r in network)
assert result.returncode == 0 and json.loads(result.stdout)['negativeControls'] == 41
(OUT / 'guard-command-receipt.json').write_text(json.dumps({'scope': 'NEW_ATTEMPT5_FROZEN_PUBLIC_SOURCE_GUARD_ONLY', 'argv': argv, 'startedAt': start, 'exitCode': result.returncode, 'guardNegatives': 41, 'allPrior40RetainedPlusGallantRetired': True, 'actualPrivateBytes': 0, 'services': 0, 'networkCounters': network}, indent=2) + '\n')
print(result.stdout.decode().strip())
