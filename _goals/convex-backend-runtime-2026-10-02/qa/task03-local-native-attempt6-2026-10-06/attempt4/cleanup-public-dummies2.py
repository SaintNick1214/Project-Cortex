"""Metadata/bytes verification then exact labeled PUBLIC dummy cleanup; never old targets."""
import importlib.util
import json
from pathlib import Path

S = importlib.util.spec_from_file_location('dummy4', Path(__file__).with_name('run-linux-dummy4.py'))
R = importlib.util.module_from_spec(S)
S.loader.exec_module(R)
R.OUT = R.BASE / 'dummy-cleanup2'
R.OUT.mkdir(mode=0o700)
R.CODE = R.BASE / 'dummy4/linux-code'
results = []
status = 'FAIL'
try:
    _, raw, _ = R.run('remaining-own-container-names', [R.DOCKER, 'ps', '-a', '--filter', 'label=cortex.operation=' + R.OP, '--format', '{{.Names}}'])
    names = raw.decode().splitlines()
    expected = 'cortex-task03-attempt4-controls-' + R.OP
    assert names == [expected]
    R.VOLUME = 'cortex-task03-attempt4-public-dummy2-' + R.OP
    R.CODE = R.BASE / 'dummy2/linux-code'
    obj = R.inspect(expected, 'failed-controls-terminal-inspect')
    # It is the exact failed dummy2 public control container, with saved terminal receipt.
    assert obj['State']['Running'] is False and obj['State']['ExitCode'] == 1 and obj['State']['OOMKilled'] is False
    assert any(m.get('Name') == 'cortex-task03-attempt4-public-dummy2-' + R.OP for m in obj['Mounts'])
    R.run('failed-controls-owned-remove', [R.DOCKER, 'rm', expected])
    R.CODE = R.BASE / 'dummy4/linux-code'
    for index, prefix in [(1, 'public-dummy-'), (2, 'public-dummy2-'), (3, 'public-dummy3-')]:
        R.VOLUME = 'cortex-task03-attempt4-' + prefix + R.OP
        _, raw, _ = R.run('dummy' + str(index) + '-volume-inspect', [R.DOCKER, 'volume', 'inspect', R.VOLUME])
        obj = json.loads(raw)[0]
        assert obj['Labels'] == {'cortex.operation': R.OP, 'cortex.scope': 'public-dummy-source-only'}
        observed = json.loads(R.container('cleanup-postcheck-' + str(index), '/prep/attempt4/linux-postcheck.py'))
        assert observed['status'] == 'PASS' and observed['sourceAllNineAndFullContents'] and observed['destinationAllNineAndFullContents']
        R.run('dummy' + str(index) + '-volume-owned-remove', [R.DOCKER, 'volume', 'rm', R.VOLUME])
        row, _, err = R.run('dummy' + str(index) + '-volume-after-absence', [R.DOCKER, 'volume', 'inspect', R.VOLUME], required=False)
        assert row['exitCode'] == 1 and b'no such volume' in err.lower()
        results.append({'dummy': index, 'originalOverallVerdict': 'FAIL', 'currentPublicNativeBytesAndAllNine': 'PASS', 'ownedVolumeCleanup': 'PASS', 'originalFailureNotReconstructed': True})
    _, raw, _ = R.run('remaining-own-container-names-final', [R.DOCKER, 'ps', '-a', '--filter', 'label=cortex.operation=' + R.OP, '--format', '{{.Names}}'])
    assert raw == b''
    _, raw, _ = R.run('remaining-own-volume-names-final', [R.DOCKER, 'volume', 'ls', '--filter', 'label=cortex.operation=' + R.OP, '--format', '{{.Name}}'])
    assert raw == b''
    status = 'PASS'
finally:
    R.durable(R.OUT / 'command-receipts.json', (json.dumps({'commands': R.RECORDS, 'privateReads': 0, 'services': 0}, indent=2) + '\n').encode())
    R.durable(R.OUT / 'result.json', (json.dumps({'status': status, 'scope': 'ALL_FOUR_NEW_OWNED_PUBLIC_DUMMY_RESOURCES_ONLY', 'results': results, 'dummy4OriginalVerdict': 'PASS', 'allOriginalFailuresRemainFAIL': True, 'oldQ3VolumeAccess': False, 'privateReads': 0, 'services': 0}, indent=2) + '\n').encode())
print(json.dumps({'status': status, 'cleanedFailedDummies': len(results), 'remainingOwnedContainersAndVolumes': 0, 'privateReads': 0, 'services': 0}))
assert status == 'PASS'
