import argparse, gzip, hashlib, json, os, stat
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument('--materialize',action='store_true'); args=p.parse_args()
base=Path(__file__).resolve().parent; root=base.parents[3]
raw=(base/'transport-map.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()=='5edea93d7327c127fb33d4a3f7d62b09fc16113f3536686661509972b069bd3e', 'TRANSPORT_MAP_CHANGED'
entries=json.loads(raw)['files']
allowed={'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-'+k+'-preparation-c3/evidence/c3-command-custody-index.json' for k in ['extension','regression','extra']}
assert len(entries)==3 and {e['originalPath'] for e in entries}==allowed
for e in entries:
    source=root/e['archivePath']; target=root/e['originalPath']
    for f in [source,target]:
        assert root in f.parents
        for parent in [f,*f.parents]:
            if parent==root: break
            assert not parent.is_symlink(), 'TRANSPORT_SYMLINK_DENIED'
    assert source.is_file() and source.stat().st_size==e['archiveBytes']
    packed=source.read_bytes(); assert hashlib.sha256(packed).hexdigest()==e['archiveSha256']
    if target.exists():
        assert target.is_file() and target.stat().st_size==e['originalBytes']
        assert hashlib.sha256(target.read_bytes()).hexdigest()==e['originalSha256'], 'EXISTING_ORIGINAL_MISMATCH'
for e in entries:
    target=root/e['originalPath']; data=gzip.decompress((root/e['archivePath']).read_bytes())
    assert len(data)==e['originalBytes'] and hashlib.sha256(data).hexdigest()==e['originalSha256']
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==e['originalGitBlob']
    if args.materialize and not target.exists():
        assert target.parent.is_dir(), 'TRACKED_PARENT_REQUIRED'
        fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
        try:
            view=memoryview(data); offset=0
            while offset<len(view):
                n=os.write(fd,view[offset:]); assert n>0, 'SHORT_WRITE_WITHOUT_PROGRESS'; offset+=n
        except BaseException:
            os.close(fd); target.unlink(); raise
        else: os.close(fd)
        assert hashlib.sha256(target.read_bytes()).hexdigest()==e['originalSha256']
print(json.dumps({'archivesVerified':3,'originalBytesRestoredExactly':True,'mode':'materialize-missing-only' if args.materialize else 'read-only-check','qualificationAcceptance':False}))
