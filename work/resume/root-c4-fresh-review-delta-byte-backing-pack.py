import datetime, gzip, hashlib, json, os, pathlib, stat, tarfile

ROOT = pathlib.Path('/workspace/Project-Cortex')
QA = ROOT / '_goals/convex-backend-runtime-2026-10-02/qa/task04-c4-fresh-review-delta-byte-backing'
OUT = pathlib.Path('/tmp/cortex-root-storage-rescue/c4-fresh-review-delta-byte-backing')
SOURCES = [('fresh-review', pathlib.Path('/tmp/cortex-native-c5-independent-review-c4-fresh-20261004b'), 'ae486f5d737c9af4872393517c03030b648ceb0a0a5476f44602a7ee9c3916fc')]

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

PRIOR_INDEX = ROOT / '_goals/convex-backend-runtime-2026-10-02/qa/task04-c3-and-review-byte-backing/index.json'
assert sha_file(PRIOR_INDEX) == '4a3c61ac138bf864fc93fb2e26636a8ab90582b73ca636dd2e80c087b6c6277f'
prior = json.loads(PRIOR_INDEX.read_bytes())
prior_objects = {r['sha256']:r['bytes'] for r in prior['objects']}
prior_archive = pathlib.Path('/tmp/cortex-root-storage-rescue/c3-and-review-byte-backing/objects.tar.gz')
assert prior_archive.stat().st_size == prior['archive']['bytes'] and sha_file(prior_archive) == prior['archive']['sha256']
seen_prior = set()
with tarfile.open(prior_archive, 'r|gz') as tar:
    for member in tar:
        assert member.isfile() and member.name.startswith('objects/')
        h = member.name.removeprefix('objects/')
        assert h in prior_objects and h not in seen_prior and member.size == prior_objects[h]
        digest = hashlib.sha256()
        with tar.extractfile(member) as source:
            for data in iter(lambda:source.read(4*1024*1024), b''):digest.update(data)
        assert digest.hexdigest() == h
        seen_prior.add(h)
assert seen_prior == set(prior_objects)
all_objects = objects
reused = {h:v for h,v in all_objects.items() if h in prior_objects}
for h,v in reused.items():assert v['bytes'] == prior_objects[h]
objects = {h:v for h,v in all_objects.items() if h not in prior_objects}
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
index = dict(format='C4_FRESH_REVIEW_DELTA_CONTENT_OBJECTS_ONLY_V1', observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), sourceSeals=source_seals,
             references=refs, objects=[dict(sha256=h, bytes=v['bytes'], backing='prior' if h in reused else 'delta') for h, v in sorted(all_objects.items())], priorBacking=dict(indexPath=str(PRIOR_INDEX.relative_to(ROOT)), indexSHA256=sha_file(PRIOR_INDEX), archiveSHA256=prior['archive']['sha256'], verifiedOriginalObjectCount=len(prior_objects)),
             archive=dict(bytes=archive.stat().st_size, sha256=sha_file(archive), parts=parts),
             scope='AUTHENTIC_CONTENT_BACKING_ONLY_NOT_RESTORED_PHYSICAL_PATHS_INODES_OR_RUNTIME_ACCEPTANCE', original122='HELD', freshReviewVerdict='REJECT_3.0')
(OUT / 'index.json').write_text(json.dumps(index, separators=(',',':')) + '\n')
mapping[str((QA/'index.json').relative_to(ROOT))] = str(OUT/'index.json')
(ROOT / 'work/resume/transfer40-virtual-source-mapping.json').write_text(json.dumps(mapping, indent=2) + '\n')
receipt = dict(utc=index['observedAt'], references=len(refs), regularReferences=sum(x['type']=='file' for x in refs), uniqueObjects=len(all_objects), deltaObjects=len(objects), reusedPriorObjects=len(reused),
               rawUniqueObjectBytes=sum(x['bytes'] for x in objects.values()), archiveBytes=index['archive']['bytes'], archiveSHA256=index['archive']['sha256'],
               parts=len(parts), indexSHA256=sha_file(OUT / 'index.json'), everyArchiveObjectStreamVerified=True, sourceSealsUnchanged=True,
               scope=index['scope'], original122='HELD')
(QA / 'root-pack-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
