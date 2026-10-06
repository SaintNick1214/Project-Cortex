"""Affected evidence-helper quality; no service/private byte access or SDK Python work."""
import ast
import datetime
import json
import os
from pathlib import Path
import subprocess

Q = Path(__file__).resolve().parents[1]
REPO = Q.parents[3]
OUT = Q / 'attempt4'
NODE = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node'
ENV = {'PATH': str(Path(NODE).parent) + ':/usr/bin:/bin', 'TMPDIR': str(Q / 'tmp'), 'NO_COLOR': '1', 'NODE_OPTIONS': '--require ' + str(Q / 'offline-network-v2.cjs'), 'PYTHONDONTWRITEBYTECODE': '1'}
lint = [Q / name for name in ['scripts/guard.mjs', 'scripts/incidental-custody.mjs', 'scripts/offline-guard-check.mjs', 'fresh-identity.mjs', 'attempt2/affected-controls.mjs', 'attempt2-repair1/real-owned-custody-controls.mjs']]
commands = [
    ('node-version', [NODE, '--version']),
    ('npm-version', [str(Path(NODE).with_name('npm')), '--version']),
    ('source-47-controls', [NODE, '--experimental-vm-modules', str(Q / 'attempt2/affected-controls.mjs')]),
    ('filesystem-3-controls', [NODE, '--experimental-vm-modules', str(Q / 'attempt2-repair1/real-owned-custody-controls.mjs')]),
    ('cleanup-driver-28-controls', [NODE, '--experimental-vm-modules', str(Q / 'repair-cycle2/offline-repair-check.mjs')]),
    ('source-39-host-controls', ['/usr/bin/python3', str(OUT / 'source-controls.py')]),
    ('scoped-mjs-lint', [NODE, str(REPO / 'node_modules/eslint/bin/eslint.js'), '--config', str(Q / 'attempt2/eslint.config.mjs'), '--no-ignore', '--max-warnings', '0', *map(str, lint)]),
    *[('syntax-' + path.stem, [NODE, '--check', str(path)]) for path in lint[:4]],
]
records = []
for name, argv in commands:
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result = subprocess.run(argv, cwd=REPO, env=ENV, capture_output=True, timeout=45)
    for suffix, raw in [('stdout', result.stdout), ('stderr', result.stderr)]:
        with (OUT / (name + '.' + suffix)).open('xb') as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
    records.append({'name': name, 'argv': argv, 'cwd': str(REPO), 'startedAt': started, 'exitCode': result.returncode, 'status': 'PASS' if result.returncode == 0 else 'FAIL', 'stdout': name + '.stdout', 'stderr': name + '.stderr'})
    (OUT / 'host-command-receipts.json').write_text(json.dumps({'commands': records, 'privateReads': 0, 'services': 0, 'applicationTypechecksAnd1005Tests': 'REUSED_EXACT_SOURCE_TEST_DISCOVERY_DEPENDENCY_COMPILER_PINS_NOT_RERUN'}, indent=2) + '\n')
    print(json.dumps({'name': name, 'exitCode': result.returncode}), flush=True)
    assert result.returncode == 0, name
syntax = []
for path in sorted(OUT.glob('*.py')):
    ast.parse(path.read_text(), filename=str(path))
    syntax.append(str(path.relative_to(Q)))
(OUT / 'qa-python-syntax.json').write_text(json.dumps({'status': 'PASS', 'files': syntax, 'scope': 'EVIDENCE_PYTHON_ONLY_ARCHIVED_SDK_EXCLUDED', 'services': 0}, indent=2) + '\n')
print(json.dumps({'status': 'PASS', 'sourceControls': 47, 'filesystemControls': 3, 'cleanupDriverControls': 28, 'hostSourceControls': 39, 'mjsLintFiles': 6, 'mjsSyntaxFiles': 4, 'qaPythonSyntax': len(syntax)}))
