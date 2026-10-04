import datetime, hashlib, json, os, pathlib, stat

R = pathlib.Path('/workspace/Project-Cortex')
B = pathlib.Path('/tmp/cortex-root-storage-rescue')
Q = R / '_goals/convex-backend-runtime-2026-10-02/qa'
names = ['c3-and-review-byte-backing', 'c4-delta-byte-backing', 'c4-fresh-review-delta-byte-backing']
rows = []
identity = lambda s: (s.st_dev, s.st_ino, s.st_mode, s.st_uid, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)

def digest(p):
    s = p.lstat()
    assert stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_uid == os.getuid() and p.resolve() == p
    h = hashlib.sha256()
    with p.open('rb') as f:
        assert identity(os.fstat(f.fileno())) == identity(s)
        while b := f.read(1048576):
            h.update(b)
        assert identity(os.fstat(f.fileno())) == identity(s)
    assert identity(p.lstat()) == identity(s)
    return s, h.hexdigest()

for name in names:
    d = B / name
    receipt = json.loads((Q / ('task04-' + name) / 'root-pack-receipt.json').read_text())
    archive = d / 'objects.tar.gz'
    parts = sorted(d.glob('objects.part-*'))
    assert len(parts) == receipt['parts']
    assert [p.name for p in parts] == ['objects.part-%04d' % i for i in range(len(parts))]
    a, sha = digest(archive)
    assert a.st_size == receipt['archiveBytes'] and sha == receipt['archiveSHA256']
    h = hashlib.sha256()
    size = 0
    members = []
    for p in parts:
        s, partsha = digest(p)
        with p.open('rb') as f:
            assert identity(os.fstat(f.fileno())) == identity(s)
            while b := f.read(1048576):
                h.update(b)
                size += len(b)
            assert identity(os.fstat(f.fileno())) == identity(s)
        assert identity(p.lstat()) == identity(s)
        members.append(dict(path=str(p), bytes=s.st_size, sha256=partsha, identity=identity(s)))
    assert size == a.st_size and h.hexdigest() == sha
    rows.append(dict(archive=str(archive), bytes=a.st_size, sha256=sha, identity=identity(a), parts=members))

# All three complete reconstructions are verified before deleting any duplicate.
for r in rows:
    p = pathlib.Path(r['archive'])
    s, sha = digest(p)
    assert identity(s) == tuple(r['identity']) and sha == r['sha256']
    for m in r['parts']:
        assert identity(pathlib.Path(m['path']).lstat()) == tuple(m['identity'])
    p.unlink()

out = dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(), status='VERIFIED_DUPLICATE_ARCHIVES_REMOVED', reclaimedBytes=sum(r['bytes'] for r in rows), archives=rows, canonicalPublishedPartsRetained=True, allSourcePacketsAndFailuresRetained=True, reconstruct='Concatenate recorded ordered parts and verify archive bytes/SHA256 before use. Older pack helpers require reconstruction at the recorded archive path before rerunning.', original122='HELD')
(Q / 'root-duplicate-concatenated-archives-cleanup.json').open('x').write(json.dumps(out, indent=2) + '\n')
print(json.dumps({k:v for k,v in out.items() if k != 'archives'}))
