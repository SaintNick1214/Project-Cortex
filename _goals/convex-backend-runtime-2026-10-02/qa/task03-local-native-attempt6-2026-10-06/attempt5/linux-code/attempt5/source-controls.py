"""Public dummy outcomes, actual filesystem seams and labeled injected identity seams."""
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import time

S = importlib.util.spec_from_file_location('acquisition', Path(__file__).with_name('source-acquisition.py'))
A = importlib.util.module_from_spec(S)
S.loader.exec_module(A)
T = A.T
Q = Path(__file__).resolve().parents[1]
B = json.loads((Q / 'transport-prep/transport-binding.json').read_bytes())
TEST_TMP = Path(os.environ.get('CORTEX_PUBLIC_DUMMY_TMP', str(Q / 'tmp')))
RESULTS = []

def fixture(base):
    source = base / 'original'
    stage = base / 'stage'
    root = base / 'native'
    receipts = base / 'receipts'
    dest = base / 'destination'
    for path in [source, stage, root, receipts, dest]:
        path.mkdir(mode=0o700)
    target = {**B, 'deploymentName': 'public-dummy-123', 'kind': 'cloud', 'deploymentType': 'dev', 'active': True, 'isolationVerified': True, 'freshManagedProject': True, 'retired': False, 'deleted': False, 'productionDeployment': False, 'sharedCiTarget': False}
    values = {'jwt-private.pem': b'PUBLIC DUMMY KEY NOT A CREDENTIAL\n', 'deploy.env': b'PUBLIC_DUMMY_ONLY=true\n', 'target.json': (json.dumps(target) + '\n').encode()}
    for name, value in values.items():
        (source / name).write_bytes(value)
        (source / name).chmod(0o600)
    T.copy_private(source, stage, B, stage=True)
    return source, stage, root, receipts, dest

def run_case(name, mutate=None, host_mutate=None, native_mutate=None, seam=None, expected=False, instrumented=False):
    with tempfile.TemporaryDirectory(prefix='source-control-', dir=TEST_TMP) as raw:
        base = Path(raw)
        original, stage, root, receipts, dest = fixture(base)
        producer = None
        old_write = T.write_exact
        old_identity = T.identity
        try:
            if host_mutate:
                host_mutate(stage)
            if native_mutate:
                native_mutate(root, receipts, dest)
            producer = A.HeldProducer(stage, B)
            payload = b''.join(producer.frames())
            if mutate:
                payload = mutate(payload)
            stream = base / 'public-frame.bin'
            stream.write_bytes(payload)
            stream.chmod(0o600)
            if seam:
                def write(root_path, root_fd, member, data):
                    result = old_write(root_path, root_fd, member, data)
                    seam(root_path, member)
                    return result
                T.write_exact = write
            with stream.open('rb') as stream_file:
                outcome = A.receive_and_copy(root, 'source-00000000-0000-0000-0000-000000000001', dest, B, receipts, stream_file.fileno())
                assert outcome['nativeAllNineAndFullContents'] and outcome['copiedFiles'] == 3
            producer.verify()
            passed = True
        except (ValueError, OSError, KeyError, TypeError, AssertionError, json.JSONDecodeError):
            passed = False
        finally:
            T.write_exact = old_write
            T.identity = old_identity
            if producer:
                fds = [producer.root_fd, *[r['fd'] for r in producer.rows]]
                producer.close()
                for fd in fds:
                    try:
                        os.fstat(fd)
                        raise AssertionError('source descriptor leaked')
                    except OSError:
                        pass
        assert passed == expected, name
        copied = sorted(p.name for p in dest.iterdir())
        if expected:
            assert copied == sorted([*T.NAMES, 'private-receive-custody.json'])
            assert len(list(receipts.iterdir())) == 1
            assert all((dest / n).read_bytes() == (stage / n).read_bytes() for n in T.NAMES)
        elif seam is None:
            assert copied == [], name
        RESULTS.append({'name': name, 'status': 'PASS', 'expectedReceiveSuccess': expected, 'observedReceiveSuccess': passed, 'destinationEntries': len(copied), 'instrumented': instrumented, 'privateReads': 0, 'serviceCalls': 0})

def header_change(payload, change):
    size = struct.unpack('!I', payload[8:12])[0]
    header = json.loads(payload[12:12 + size])
    change(header)
    raw = json.dumps(header, separators=(',', ':')).encode()
    return payload[:8] + struct.pack('!I', len(raw)) + raw + payload[12 + size:]

def replace_after_receipt(path, member):
    if member.endswith('.json') and member.startswith('source-'):
        source = path.parent / 'native/source-00000000-0000-0000-0000-000000000001'
        file = source / T.NAMES[0]
        replacement = source / 'replacement'
        replacement.write_bytes(file.read_bytes())
        replacement.chmod(0o600)
        os.replace(replacement, file)

if __name__ == '__main__':
    run_case('healthy-exact-four-files-native-baseline-unchanged-helper', expected=True)
    for name, mutate in [
        ('partial-header', lambda p: p[:10]),
        ('partial-file', lambda p: p[:-1]),
        ('header-oversize', lambda p: p[:8] + struct.pack('!I', 65537)),
        ('wrong-magic', lambda p: b'BADMAGIC' + p[8:]),
        ('unexpected-trailing-byte', lambda p: p + b'x'),
        ('operation-drift', lambda p: header_change(p, lambda h: h.update(operation='foreign'))),
        ('request-drift', lambda p: header_change(p, lambda h: h.update(requestSha256='foreign'))),
        ('extra-header-member', lambda p: header_change(p, lambda h: h.update(extra=True))),
        ('duplicate-file-name', lambda p: header_change(p, lambda h: h['files'][1].update(name=h['files'][0]['name']))),
        ('path-traversal-name', lambda p: header_change(p, lambda h: h['files'][0].update(name='../foreign'))),
        ('file-oversize', lambda p: header_change(p, lambda h: h['files'][0].update(bytes=65537))),
        ('zero-file', lambda p: header_change(p, lambda h: h['files'][0].update(bytes=0))),
        ('boolean-size', lambda p: header_change(p, lambda h: h['files'][0].update(bytes=True))),
        ('digest-mismatch', lambda p: header_change(p, lambda h: h['files'][0].update(sha256='0' * 64))),
        ('host-identity-incomplete', lambda p: header_change(p, lambda h: h['files'][0].update(hostIdentityDecimal={}))),
        ('host-tuple-cannot-be-native-authority', lambda p: header_change(p, lambda h: h.update(identityAuthority='HOST_IS_NATIVE'))),
    ]:
        run_case(name, mutate=mutate)
    run_case('host-directory-mode', host_mutate=lambda s: s.chmod(0o755))
    run_case('host-file-mode', host_mutate=lambda s: (s / T.NAMES[0]).chmod(0o644))
    run_case('host-file-hardlink', host_mutate=lambda s: os.link(s / T.NAMES[0], s / 'extra'))
    def alias(s):
        (s / T.NAMES[0]).rename(s / 'original-key')
        (s / T.NAMES[0]).symlink_to('original-key')
    run_case('host-file-symlink', host_mutate=alias)
    run_case('native-source-replacement-after-durable-acquisition-receipt', seam=replace_after_receipt)
    run_case('native-parent-mode', native_mutate=lambda r, a, d: r.chmod(0o755))
    run_case('destination-mode', native_mutate=lambda r, a, d: d.chmod(0o755))
    def occupied(r, a, d):
        (d / 'known-public-baseline').write_text('PUBLIC BASELINE\n')
        (d / 'known-public-baseline').chmod(0o600)
    # This destination remains unchanged and is never overwritten by the receiver.
    with tempfile.TemporaryDirectory(prefix='occupied-control-', dir=TEST_TMP) as raw:
        base = Path(raw)
        _, stage, root, receipts, dest = fixture(base)
        occupied(root, receipts, dest)
        before = T.identity((dest / 'known-public-baseline').lstat())
        producer = A.HeldProducer(stage, B)
        stream = base / 'frame'
        stream.write_bytes(b''.join(producer.frames()))
        try:
            with stream.open('rb') as f:
                try:
                    A.receive_and_copy(root, 'source-00000000-0000-0000-0000-000000000002', dest, B, receipts, f.fileno())
                    raise AssertionError('occupied destination accepted')
                except ValueError:
                    pass
            assert T.identity((dest / 'known-public-baseline').lstat()) == before
            assert (dest / 'known-public-baseline').read_bytes() == b'PUBLIC BASELINE\n'
            assert sorted(p.name for p in dest.iterdir()) == ['known-public-baseline']
        finally:
            producer.close()
    RESULTS.append({'name': 'occupied-destination-baseline-preserved', 'status': 'PASS', 'destinationEntries': 1})
    run_case('host-extra-member', host_mutate=lambda s: (s / 'extra').write_text('PUBLIC EXTRA'))
    for field in T.FIELDS:
        def seam(path, member, selected=field):
            if member == 'private-receive-custody.json':
                original = T.identity
                def identity(value):
                    result = original(value)
                    result[selected] = str(int(result[selected]) + 1)
                    return result
                T.identity = identity
        run_case('injected-native-post-helper-receipt-' + field, seam=seam, instrumented=True)
    def source_content(path, member):
        if member == 'private-receive-custody.json':
            file = path.parent / 'native/source-00000000-0000-0000-0000-000000000001' / T.NAMES[0]
            with file.open('r+b') as f:
                f.write(b'x')
                f.flush()
                os.fsync(f.fileno())
    run_case('actual-native-source-content-after-helper-durable-receipt', seam=source_content)
    def destination_replace(path, member):
        if member == 'private-receive-custody.json':
            file = path / T.NAMES[0]
            replacement = path / 'known-public-replacement'
            replacement.write_bytes(file.read_bytes())
            replacement.chmod(0o600)
            os.replace(replacement, file)
    run_case('actual-destination-replacement-after-helper-durable-receipt', seam=destination_replace)
    # Finite-reader deadline and output-limit checks use no credential or container.
    read_fd, write_fd = os.pipe()
    started = time.monotonic()
    try:
        try:
            A.FiniteReader(read_fd, 0.05).read(1)
            raise AssertionError('timeout was accepted')
        except ValueError:
            assert time.monotonic() - started < 1
    finally:
        os.close(read_fd)
        os.close(write_fd)
    RESULTS.append({'name': 'stream-deadline-no-input', 'status': 'PASS', 'elapsedSeconds': time.monotonic() - started})
    with tempfile.TemporaryFile(dir=TEST_TMP) as f:
        f.write(b'a')
        f.seek(0)
        reader = A.FiniteReader(f.fileno())
        reader.total = A.MAX_TOTAL
        try:
            reader.read(1)
            raise AssertionError('total overflow was accepted')
        except ValueError:
            pass
    RESULTS.append({'name': 'total-stream-overflow', 'status': 'PASS', 'instrumented': True})
    # Exact protocol integer version: malformed types fail before native or destination creation.
    for name, invalid_version in [('boolean-true-version', True), ('boolean-false-version', False),
                                  ('string-version', '1'), ('null-version', None),
                                  ('integral-float-version', 1.0), ('noninteger-version', 1.5),
                                  ('wrong-integer-version', 2)]:
        run_case(name, mutate=lambda p, v=invalid_version: header_change(p, lambda h: h.update(version=v)))
        assert RESULTS[-1]['observedReceiveSuccess'] is False and RESULTS[-1]['destinationEntries'] == 0
    assert len(RESULTS) == 46
    assert [r['name'] for r in RESULTS[:39]] == [r['name'] for r in json.loads((Q / 'attempt4/check2/source-39-host-controls.stdout').read_bytes())['controls']]
    if sys.platform == 'linux':
        assert os.getuid() == 501 and os.getgid() == 20
        assert Path('/sys/fs/cgroup/memory.max').read_text().strip() == '536870912'
        assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip() == '0'
    print(json.dumps({'scope': 'ACTUAL_PUBLIC_DUMMY_LINUX_CONTROLS' if sys.platform == 'linux' else 'PUBLIC_DUMMY_HOST_CONTROLS_ONLY_NO_LINUX_CERTIFICATION', 'status': 'PASS', 'controls': RESULTS, 'count': len(RESULTS), 'privateCredentialReads': 0, 'serviceCalls': 0}))
