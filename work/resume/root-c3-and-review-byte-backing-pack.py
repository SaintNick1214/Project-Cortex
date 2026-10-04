import datetime, gzip, hashlib, json, os, pathlib, stat, tarfile

ROOT = pathlib.Path('/workspace/Project-Cortex')
QA = ROOT / '_goals/convex-backend-runtime-2026-10-02/qa/task04-c3-and-review-byte-backing'
OUT = pathlib.Path('/tmp/cortex-root-storage-rescue/c3-and-review-byte-backing')
SOURCES = [
    ('candidate', pathlib.Path('/tmp/cortex-native-c5-closed-launcher-c3'), '88d0273651681cd10f2f3dbbe6fe3c29604bd5778be04297b0393322c01616a8'),
    ('fresh-review', pathlib.Path('/tmp/cortex-native-c5-independent-review-c3-fresh-20261004a'), '3dcb7c459b4f0bce8a2d13494b0b1243715e55fb577ece9f9cac6d9645421567'),
]

def sha_file(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for data in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(data)
    return h.hexdigest()

QA.mkdir(mode=0o700)
OUT.mkdir(mode=0o700)
refs, objects, source_seals = [], {}, []
for scope, root, expected in SOURCES:
    seal = root / 'literal-self-seal.json'
    assert sha_file(seal) == expected
    packet = json.loads(seal.read_text())
    rows = list(packet['rows'])
    s = seal.lstat()
    rows.append(dict(path=seal.name, type='file', bytes=s.st_size, sha256=expected, mode=s.st_mode, uid=s.st_uid, dev=s.st_dev, ino=s.st_ino, nlink=s.st_nlink))
    source_seals.append(dict(scope=scope, path=str(seal), sha256=expected, sealRows=len(packet['rows'])))
    for row in rows:
        refs.append(dict(scope=scope, provenancePath=str(root / row['path']), **row))
        if row['type'] != 'file':
            continue
        p = root / row['path']
        actual = p.lstat()
        assert stat.S_ISREG(actual.st_mode) and actual.st_nlink == 1
        assert actual.st_size == row['bytes'] and sha_file(p) == row['sha256']
        objects.setdefault(row['sha256'], dict(path=str(p), bytes=row['bytes']))

archive = OUT / 'objects.tar.gz'
with archive.open('xb') as destination:
    with gzip.GzipFile(fileobj=destination, mode='wb', filename='', mtime=0, compresslevel=3) as compressed:
        with tarfile.open(fileobj=compressed, mode='w|', format=tarfile.USTAR_FORMAT) as tar:
            for digest, item in sorted(objects.items()):
                p = pathlib.Path(item['path'])
                fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW)
                with os.fdopen(fd, 'rb') as source:
                    s = os.fstat(source.fileno())
                    assert stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_size == item['bytes']
                    header = tarfile.TarInfo('objects/' + digest)
                    header.size, header.mode, header.uid, header.gid, header.mtime = item['bytes'], 0o600, 0, 0, 0
                    tar.addfile(header, source)
                    assert os.fstat(source.fileno()) == s

seen = set()
with tarfile.open(archive, 'r|gz') as tar:
    for member in tar:
        assert member.isfile() and member.name.startswith('objects/')
        digest = member.name.removeprefix('objects/')
        assert digest in objects and digest not in seen and member.size == objects[digest]['bytes']
        h = hashlib.sha256()
        with tar.extractfile(member) as source:
            for data in iter(lambda: source.read(4 * 1024 * 1024), b''):
                h.update(data)
        assert h.hexdigest() == digest
        seen.add(digest)
assert seen == set(objects)

parts, mapping = [], {}
with archive.open('rb') as source:
    for number in range(1000):
        data = source.read(5 * 1024 * 1024)
        if not data:
            break
        p = OUT / f'objects.part-{number:04d}'
        p.write_bytes(data)
        relative = str((QA / p.name).relative_to(ROOT))
        mapping[relative] = str(p)
        parts.append(dict(name=p.name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
assert sum(x['bytes'] for x in parts) == archive.stat().st_size
for scope, root, expected in SOURCES:
    assert sha_file(root / 'literal-self-seal.json') == expected
index = dict(format='C3_AND_FRESH_REVIEW_CONTENT_OBJECTS_ONLY_V1', observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), sourceSeals=source_seals,
             references=refs, objects=[dict(sha256=h, bytes=v['bytes']) for h, v in sorted(objects.items())],
             archive=dict(bytes=archive.stat().st_size, sha256=sha_file(archive), parts=parts),
             scope='AUTHENTIC_CONTENT_BACKING_ONLY_NOT_RESTORED_PHYSICAL_PATHS_INODES_OR_RUNTIME_ACCEPTANCE', original122='HELD', freshReviewVerdict='REJECT_2.2')
(QA / 'index.json').write_text(json.dumps(index, indent=2) + '\n')
(ROOT / 'work/resume/transfer38-virtual-source-mapping.json').write_text(json.dumps(mapping, indent=2) + '\n')
receipt = dict(utc=index['observedAt'], references=len(refs), regularReferences=sum(x['type']=='file' for x in refs), uniqueObjects=len(objects),
               rawUniqueObjectBytes=sum(x['bytes'] for x in objects.values()), archiveBytes=index['archive']['bytes'], archiveSHA256=index['archive']['sha256'],
               parts=len(parts), indexSHA256=sha_file(QA / 'index.json'), everyArchiveObjectStreamVerified=True, sourceSealsUnchanged=True,
               scope=index['scope'], original122='HELD')
(QA / 'root-pack-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
