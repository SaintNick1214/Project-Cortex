"""Actual emulated Linux GNU tar/Python3.12 primitive; no native qualification."""
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tarfile

sys.path.insert(0, '/source')
from bounded_process import BoundedFileStream, bounded_command
from tar_export import TrackedTarReader, finish_tar_record

assert (os.getuid(), os.getgid()) == (501, 20)
assert sys.version_info[:3] == (3, 12, 15)
root = Path('/owned'); root.mkdir(mode=0o700, exist_ok=True)
version = bounded_command(['tar', '--version'], timeout=3)
assert b'GNU tar' in version['stdout'] and version['exit'] == 0
rows = []
for size in (2049, 9216, 1048577):
    directory = root / ('case-' + str(size)); directory.mkdir(mode=0o700)
    path = directory / 'native-capability.json'
    payload = b'A' * size
    with path.open('xb') as file:
        os.chmod(path, 0o600); file.write(payload); file.flush(); os.fsync(file.fileno())
    process = subprocess.Popen(['tar', '--blocking-factor=20', '-C', str(directory), '-cf', '-', '.'],
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stream = BoundedFileStream(process, stdout_limit=8388608, stderr_limit=4096, timeout=5)
    try:
        with tarfile.open(fileobj=stream, mode='r|') as archive:
            tracked = TrackedTarReader(archive.fileobj); archive.fileobj = tracked
            seen = []
            for member in archive:
                if member.isdir(): continue
                assert member.name == './native-capability.json' and member.isfile()
                digest = hashlib.sha256(); total = 0
                with archive.extractfile(member) as source:
                    while block := source.read(65536): digest.update(block); total += len(block)
                assert total == size and digest.hexdigest() == hashlib.sha256(payload).hexdigest()
                seen.append(member.name)
            assert seen == ['./native-capability.json']
            termination = finish_tar_record(archive, tracked)
        result = stream.finish()
        assert result['exit'] == 0 and result['stderr'] == b'' and result['terminal']
    finally:
        if process.poll() is None:
            process.kill(); process.wait(timeout=3)
        assert stream.close() == []
    rows.append(dict(payloadBytes=size, termination=termination, exit=process.returncode, terminal=True))
print(json.dumps(dict(scope='ACTUAL_GNU_TAR_AND_PYTHON3_12_PRIMITIVE_ONLY', status='PASS',
    Python=sys.version, architecture=platform.machine(), GNUtar=version['stdout'].decode(), rows=rows,
    UID=os.getuid(), GID=os.getgid(), pidfdQualification=False, subjects=False, nativeTask04Acceptance=False)))
