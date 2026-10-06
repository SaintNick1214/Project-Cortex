"""Actual public host child/pipe outcomes only, with no Docker or service access."""
import importlib.util
import json
import os
from pathlib import Path
import sys

P = Path(__file__).resolve().parent
OUT = Path(os.environ['CORTEX_COORDINATOR_TEST_OUT'])
spec = importlib.util.spec_from_file_location('bounded_coordinator', P / 'task03-attempt5-coordinate-common.py')
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
ENV = {'PATH': '/usr/bin:/bin', 'CORTEX_COORDINATOR_CWD': str(P)}
results = []

def observe(label, source, timeout=3, input_bytes=None, progress=None):
    row, stdout, stderr = C.run(label, [sys.executable, '-B', '-c', source], OUT, timeout, ENV,
                              input_bytes=input_bytes, progress=progress, required=False)
    assert row['terminal'] and not row['closeErrors']
    results.append({'label': label, 'receipt': label + '.receipt.json', 'terminal': True})
    return row, stdout, stderr

if __name__ == '__main__':
    OUT.mkdir(mode=0o700)
    row, stdout, stderr = observe('exact-pipe-boundary', 'import os; os.write(1,b"A"*262144); os.write(2,b"B"*262144)')
    assert row['exitCode'] == 0 and row['failureClass'] is None and len(stdout) == len(stderr) == 262144
    row, stdout, stderr = observe('stdout-overflow', 'import os; os.write(1,b"A"*262145)')
    assert row['failureClass'] == 'ValueError' and len(stdout) == 262144
    row, stdout, stderr = observe('stderr-overflow', 'import os; os.write(2,b"B"*262145)')
    assert row['failureClass'] == 'ValueError' and len(stderr) == 262144
    row, stdout, stderr = observe('partial-output-deadline', 'import os,time; os.write(1,b"PUBLIC OUT"); os.write(2,b"PUBLIC ERR"); time.sleep(4)', timeout=0.4)
    assert row['failureClass'] == 'TimeoutError' and stdout == b'PUBLIC OUT' and stderr == b'PUBLIC ERR'
    row, stdout, stderr = observe('nonzero-terminal', 'import os; os.write(1,b"PUBLIC NONZERO"); raise SystemExit(3)')
    assert row['failureClass'] is None and row['exitCode'] == 3 and stdout == b'PUBLIC NONZERO'
    payload = b'PUBLIC FINITE INPUT\n' * 1000
    row, stdout, stderr = observe('framed-input-transfer', 'import sys; b=sys.stdin.buffer.read(); print(len(b))', input_bytes=payload)
    assert row['failureClass'] is None and row['exitCode'] == 0 and row['stdinBytes'] == len(payload) and int(stdout) == len(payload)
    row, stdout, stderr = observe('blocked-stdin-deadline', 'import time; time.sleep(20)', timeout=25, input_bytes=b'A' * C.INPUT_LIMIT)
    assert row['failureClass'] == 'TimeoutError' and 12 <= row['elapsedSeconds'] < 14 and row['stdinBytes'] < C.INPUT_LIMIT
    def reject_progress():
        raise ValueError('PUBLIC INJECTED HELD SOURCE FENCE')
    row, stdout, stderr = observe('held-source-progress-failure', 'import time; time.sleep(10)', timeout=5, progress=reject_progress)
    assert row['failureClass'] == 'ValueError'
    row, stdout, stderr = C.run('spawn-failure', ['/nonexistent-public-owned-test-command'], OUT, 1, ENV, required=False)
    assert row['failureClass'] == 'FileNotFoundError' and row['exitCode'] is None and row['terminal'] is False
    results.append({'label': 'spawn-failure', 'receipt': 'spawn-failure.receipt.json', 'expectedNoChild': True})
    invalid = 0
    for options in [{'timeout': 0}, {'timeout': 191}, {'timeout': 1, 'input_bytes': b''}, {'timeout': 1, 'input_bytes': b'A' * (C.INPUT_LIMIT + 1)}]:
        try:
            C.run('invalid-bound', [sys.executable], OUT, env=ENV, **options)
        except ValueError:
            invalid += 1
    assert invalid == 4
    result = {'scope': 'ACTUAL_PUBLIC_HOST_COORDINATOR_PIPE_AND_CHILD_CONTROLS_ONLY', 'status': 'PASS',
              'actualChildOutcomeControls': len(results), 'invalidBoundsRejectedBeforeSpawn': invalid,
              'results': results, 'sourceSha256': C.digest(P / 'task03-attempt5-coordinate-common.py'),
              'DockerCalls': 0, 'serviceCalls': 0, 'credentialReads': 0, 'nativeFoundationAccepted': False}
    C.durable_json(OUT / 'controls.json', result)
    print(json.dumps(result))
