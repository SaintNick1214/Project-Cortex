import os, json, hashlib, pathlib
root = pathlib.Path('/owned')
assert not list(root.iterdir())
os.chown(root, 501, 20)
os.chmod(root, 0o700)
q = root / 'candidate'
q.mkdir(mode=0o700)
os.chown(q, 501, 20)
f = pathlib.Path('/input/candidate-freeze-cycle2.json').read_bytes()
assert hashlib.sha256(f).hexdigest() == '2fa7ddfd9898216a84ac5079edd0661604b709d09384d847ced94e6c725e4c55'
rows = json.loads(f)['files']
names = [r['path'] for r in rows] + ['candidate-freeze-cycle2.json'] + ['managed-fixture/fixture/convex/_generated/' + n for n in ['api.d.ts', 'api.js', 'dataModel.d.ts', 'server.d.ts', 'server.js']]
expected = {r['path']: r for r in rows}
out = []
fields = ['st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_uid', 'st_gid', 'st_size', 'st_mtime_ns', 'st_ctime_ns']
for name in names:
    p = pathlib.Path(name)
    assert not p.is_absolute() and '..' not in p.parts
    source = pathlib.Path('/input') / p
    before = source.stat()
    assert source.is_file() and not source.is_symlink() and before.st_nlink == 1
    data = source.read_bytes()
    after = source.stat()
    assert tuple(getattr(before, k) for k in fields) == tuple(getattr(after, k) for k in fields)
    h = hashlib.sha256(data).hexdigest()
    if name in expected:
        assert h == expected[name]['sha256'] and len(data) == expected[name]['bytes']
    dest = q / p
    dest.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with dest.open('xb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    os.chown(dest, 501, 20)
    os.chmod(dest, 0o600)
    s = dest.stat()
    assert s.st_uid == 501 and s.st_gid == 20 and s.st_nlink == 1
    out.append({'path': name, 'sha256': h, 'bytes': len(data), 'identity': {k: str(getattr(s, k)) for k in fields}})
for d, sub, files in os.walk(q):
    os.chown(d, 501, 20)
    os.chmod(d, 0o700)
for row in out:
    s = (q / row['path']).stat()
    assert row['identity'] == {k: str(getattr(s, k)) for k in fields}
receipt = {'scope': 'PROSPECTIVE_LINUX_SOURCE_COPY_ONLY', 'imageId': 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3', 'volume': 'cortex-task03-current-fixture-20261005-98d651af', 'sourceFreezeSha256': hashlib.sha256(f).hexdigest(), 'files': out, 'actualServiceRequests': 0, 'actualDeployments': 0, 'qualificationAccepted': False}
with (root / 'transfer-receipt.json').open('x') as stream:
    json.dump(receipt, stream, indent=2)
    stream.write('\n')
    stream.flush()
    os.fsync(stream.fileno())
os.chown(root / 'transfer-receipt.json', 501, 20)
os.chmod(root / 'transfer-receipt.json', 0o600)
print(json.dumps({'scope': receipt['scope'], 'files': len(out), 'bytes': sum(r['bytes'] for r in out), 'uid': 501, 'gid': 20, 'sourceFreezeSha256': receipt['sourceFreezeSha256'], 'actualServiceRequests': 0}))
