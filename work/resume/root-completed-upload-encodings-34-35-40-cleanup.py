from pathlib import Path
import json, base64, hashlib, stat, os, datetime

R = Path('/workspace/Project-Cortex')
W = R / 'work/resume'
Q = R / '_goals/convex-backend-runtime-2026-10-02/qa'
records = []
ident = lambda s: [s.st_dev, s.st_ino, s.st_mode, s.st_uid, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns]
for n in [34, 35, 40]:
    meta = json.loads((W / f'transfer{n}-binary-upload-meta.json').read_bytes())
    plan = json.loads((W / f'connector-transfer-plan-{n}.json').read_bytes())
    byblob = {}
    for row in plan['rows']:
        byblob.setdefault(row['blob'], []).append(row)
    directory = Path(f'/tmp/cortex-root-storage-rescue/transfer{n}-encodings')
    ds = directory.lstat()
    assert stat.S_ISDIR(ds.st_mode) and ds.st_uid == os.getuid() and directory.resolve() == directory
    assert {p.name for p in directory.iterdir()} == {x['blob'] + '.b64' for x in meta}
    rows = []
    for x in meta:
        p = directory / (x['blob'] + '.b64')
        assert str(p) == x.get('file', x.get('path'))
        s = p.lstat()
        assert stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_uid == os.getuid() and p.resolve() == p
        raw = p.read_bytes()
        assert ident(s) == ident(p.lstat()) and len(raw) == x['characters']
        b = base64.b64decode(raw, validate=True)
        assert base64.b64encode(b) == raw
        source_rows = byblob[x['blob']]
        h = hashlib.sha256(b).hexdigest()
        assert hashlib.sha1(b'blob ' + str(len(b)).encode() + bytes([0]) + b).hexdigest() == x['blob']
        for r in source_rows:
            assert len(b) == r['bytes'] and h == r['sha256']
            canonical = Path(r.get('sourcePath', str(R / r['path'])))
            cs = canonical.lstat()
            assert stat.S_ISREG(cs.st_mode) and canonical.resolve() == canonical
            assert canonical.read_bytes() == b and ident(cs) == ident(canonical.lstat())
        rows.append(dict(path=str(p), bytes=len(raw), encodedSHA256=hashlib.sha256(raw).hexdigest(), decodedSHA256=h, gitBlobSHA1=x['blob'], identity=ident(s), canonicalSources=[r.get('sourcePath', str(R / r['path'])) for r in source_rows]))
    records.append(dict(checkpoint=n, directory=str(directory), files=rows))

# Complete canonical equality verification for every encoding precedes all deletion.
for record in records:
    for row in record['files']:
        p = Path(row['path'])
        assert ident(p.lstat()) == row['identity']
        assert hashlib.sha256(p.read_bytes()).hexdigest() == row['encodedSHA256']
        p.unlink()
    Path(record['directory']).rmdir()
receipt = dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(), status='VERIFIED_COMPLETED_DERIVED_ENCODINGS_REMOVED', checkpoints=records, totalFiles=sum(len(r['files']) for r in records), reclaimedBytes=sum(x['bytes'] for r in records for x in r['files']), allCanonicalSourcesPartsIndicesAndFrozenFailuresRetained=True, remotePublicationReceiptsRetained=True, original122='HELD')
(Q / 'root-completed-upload-encodings-34-35-40-cleanup.json').open('x').write(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({k:v for k,v in receipt.items() if k != 'checkpoints'}))
