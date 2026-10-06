"""Execute the real receiver only against owned public dummy bytes."""
import importlib.util
import json
import os
from pathlib import Path
import sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('transport', '/prep/private-transport.py')
t = importlib.util.module_from_spec(spec); spec.loader.exec_module(t)
binding = json.loads(Path('/prep/transport-binding.json').read_bytes())
source = Path('/export/selected')
root_stat = Path('/export').lstat(); child_stat = source.lstat()
results = []
def fds():
    return len(list(Path('/proc/self/fd').iterdir()))

def case(name, source, destination, healthy=False):
    before = fds()
    observed = {'source': t.identity(source.lstat()), 'destination': t.identity(destination.lstat())}
    print(json.dumps({'phase': 'case-pre', 'name': name, 'observed': observed}), flush=True)
    try:
        receipt = t.copy_private(source, destination, binding)
    except ValueError:
        if healthy:
            print(json.dumps({'phase': 'case-fail', 'name': name, 'observed': observed, 'status': 'FAIL', 'actualCredentialReads': 0}), flush=True)
            raise
        if name != 'foreign-destination-directory-owner':
            assert sorted(p.name for p in destination.iterdir()) == (['owned-existing'] if name == 'destination-nonempty' else []), name
        assert fds() == before, name
        results.append({'name': name, 'status': 'PASS', 'rejected': True, 'newOutputFiles': 0, 'baselinePreserved': True, 'foreignDestinationContents': 'ROOT_POSTCHECK_REQUIRED' if name == 'foreign-destination-directory-owner' else 'DIRECT_CHECKED', 'heldDescriptorsClosed': True})
        return
    assert healthy and len(receipt['files']) == 3, name
    assert sorted(p.name for p in destination.iterdir()) == ['deploy.env', 'jwt-private.pem', 'private-receive-custody.json', 'target.json']
    assert all(t.identity((destination / r['path']).lstat()) == r['destinationIdentityDecimal'] for r in receipt['files'])
    assert fds() == before, name
    results.append({'name': name, 'status': 'PASS', 'rejected': False, 'outputFiles': 4, 'privateFiles': 3, 'heldDescriptorsClosed': True})

case('actual-docker-parent-selected-owned-child', source, Path('/owned/healthy/private'), True)
for name in ['foreign-source-directory-owner', 'foreign-source-file-owner', 'source-directory-mode', 'source-file-mode', 'source-file-hardlink', 'source-file-symlink', 'source-file-directory', 'source-zero-length', 'source-unselected-extra', 'source-manifest-digest-drift', 'foreign-destination-directory-owner', 'destination-directory-mode', 'destination-nonempty']:
    destination = Path('/owned/cases') / name / 'private'
    case(name, Path('/owned/cases') / name / 'selected', destination)
print(json.dumps({'scope': 'ACTUAL_DUMMY_LINUX_PRIVATE_RECEIVER_ONLY', 'status': 'PASS', 'cases': len(results), 'bindRootObserved': {'uid': root_stat.st_uid, 'gid': root_stat.st_gid, 'mode': oct(root_stat.st_mode & 0o777)}, 'selectedChildRequiredAndObserved': {'uid': child_stat.st_uid, 'gid': child_stat.st_gid, 'mode': oct(child_stat.st_mode & 0o777)}, 'uid': os.getuid(), 'gid': os.getgid(), 'memoryMaxBytes': Path('/sys/fs/cgroup/memory.max').read_text().strip(), 'network': 'none', 'compilerInvocations': 0, 'actualCredentialReads': 0, 'actualServiceCalls': 0, 'results': results}))
