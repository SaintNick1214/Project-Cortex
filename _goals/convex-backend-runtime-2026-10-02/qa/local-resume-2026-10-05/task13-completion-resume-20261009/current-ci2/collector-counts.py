from pathlib import Path
import datetime, json, re

Q = Path(__file__).resolve().parent

def clean(raw):
    raw = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', raw)
    return re.sub(r'^\d{4}-\d\d-\d\dT[^ ]+ ', '', raw, flags=re.M)

def numbers(summary):
    found = {kind: int(n) for n, kind in re.findall(r'(\d+) (passed|failed|skipped|pending|total)', summary)}
    total = found.get('total')
    passed, failed, skipped = found.get('passed', 0), found.get('failed', 0), found.get('skipped', found.get('pending', 0))
    if total is None:
        raise ValueError('No total in summary')
    if passed + failed + skipped != total:
        raise ValueError('Incomplete count summary: ' + summary)
    return {'tests': total, 'passed': passed, 'failed': failed, 'skipped': skipped}

def parse(path):
    raw = clean(path.read_text())
    segments = re.split(r'(?=^##\[group\]Run )', raw, flags=re.M)
    blocks, closure = [], []
    for segment in segments:
        first = segment.splitlines()[0] if segment else ''
        command = first.removeprefix('##[group]Run ')
        forced = bool(re.search(r'Force exiting Jest|A worker process has failed to exit|Process completed with exit code (?:124|137|143)', segment))
        if forced:
            closure.append({'command': command, 'kind': 'discovery' if '--listTests' in command else 'test-or-other', 'forcedExitObserved': True})
        for m in re.finditer(r'^Test Suites: ([^\n]+)\nTests:\s+([^\n]+)', segment, re.M):
            blocks.append({'runner': 'jest', 'command': command, **numbers(m[2]), 'suites': numbers(m[1]), 'forcedExitObserved': forced, 'explicitForceExitFalse': '--forceExit=false' in segment.split('##[endgroup]')[0], 'rawSummary': m[0]})
        for m in re.finditer(r'^ℹ tests (\d+)\nℹ suites (\d+)\nℹ pass (\d+)\nℹ fail (\d+)\nℹ cancelled (\d+)\nℹ skipped (\d+)', segment, re.M):
            blocks.append({'runner': 'node:test', 'command': command, 'tests': int(m[1]), 'passed': int(m[3]), 'failed': int(m[4]), 'cancelled': int(m[5]), 'skipped': int(m[6]), 'forcedExitObserved': forced, 'rawSummary': m[0]})
        for m in re.finditer(r'^\s*Test Files\s+([^\n]+)\n\s*Tests\s+([^\n]+)', segment, re.M):
            summary = re.sub(r'\((\d+)\)', r'\1 total', m[2])
            blocks.append({'runner': 'vitest', 'command': command, **numbers(summary), 'forcedExitObserved': forced, 'rawSummary': m[0].strip()})
    return {'blocks': blocks, 'totals': {k: sum(b[k] for b in blocks) for k in ['tests', 'passed', 'failed', 'skipped']}, 'closureObservations': closure, 'testForcedExitObserved': any(b['forcedExitObserved'] for b in blocks), 'discoveryForcedExitObserved': any(c['kind'] == 'discovery' for c in closure)}

if __name__ == '__main__':
    result = {p.name: parse(p) for p in sorted((Q / 'logs').glob('collector-pr-job-*.log'))}
    (Q / 'collector-counts1.json').write_text(json.dumps({'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'jobs': result}, indent=2) + '\n')
    print(json.dumps({k: {'totals': v['totals'], 'testForcedExitObserved': v['testForcedExitObserved'], 'discoveryForcedExitObserved': v['discoveryForcedExitObserved']} for k, v in result.items()}))
