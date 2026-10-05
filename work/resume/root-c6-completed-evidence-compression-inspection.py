import os, stat, json, hashlib, gzip, datetime
from pathlib import Path

ROOT = Path('/workspace/Project-Cortex')
T = Path('/dev/shm/cortex-native-c6-closed-launcher-c6')
Q = ROOT / '_goals/convex-backend-runtime-2026-10-02/qa'
def sha(b): return hashlib.sha256(b).hexdigest()
def identity(s):
    return dict(dev=s.st_dev, ino=s.st_ino, uid=s.st_uid, gid=s.st_gid,
                mode=s.st_mode, nlink=s.st_nlink, size=s.st_size,
                mtime_ns=s.st_mtime_ns, ctime_ns=s.st_ctime_ns)
def held_json(p):
    fd=os.open(p, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        a=os.fstat(fd); assert stat.S_ISREG(a.st_mode) and a.st_uid == os.getuid() and a.st_nlink == 1
        with os.fdopen(os.dup(fd),'rb') as f: b=f.read()
        assert identity(a)==identity(os.fstat(fd))==identity(os.lstat(p))
        return b, identity(a)
    finally: os.close(fd)
summary_bytes, summary_id = held_json(T/'completed-evidence-compression.json')
summary=json.loads(summary_bytes)
inventory_bytes, inventory_id=held_json(T/'compression-inventory.json')
inventory=json.loads(inventory_bytes)['rows']
mapping_bytes, mapping_id=held_json(Path(summary['index']))
assert sha(mapping_bytes)==summary['indexSHA256']
mapping=[json.loads(line) for line in mapping_bytes.splitlines()]
assert len(mapping)==len(inventory)==summary['count']==54
assert len({r['path'] for r in mapping})==54
expected={r['path']:r for r in inventory}
rows=[]
for r in mapping:
    original=Path(r['path']); backing=Path(r['backing'])
    assert original.is_relative_to(T) and backing.is_relative_to(Path(summary['index']).parent)
    i=expected[r['path']]
    assert r['identity']==i['identity'] and r['bytes']==i['bytes']==r['decodedBytes']
    assert r['custody']=='CONTENT_ONLY_OLD_INODE_ENDS_ON_UNLINK'
    assert not os.path.lexists(original)
    fd=os.open(backing,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        a=os.fstat(fd); assert stat.S_ISREG(a.st_mode) and a.st_uid==os.getuid() and a.st_nlink==1
        encoded=hashlib.sha256(); en=0
        with os.fdopen(os.dup(fd),'rb') as f:
            while b:=f.read(1024*1024): encoded.update(b); en+=len(b)
        assert en==r['encodedBytes']==a.st_size and encoded.hexdigest()==r['encodedSHA256']
        os.lseek(fd,0,os.SEEK_SET)
        decoded=hashlib.sha256(); dn=0
        with os.fdopen(os.dup(fd),'rb') as f, gzip.GzipFile(fileobj=f) as g:
            while b:=g.read(1024*1024): decoded.update(b); dn+=len(b)
        assert dn==r['decodedBytes'] and decoded.hexdigest()==r['decodedSHA256']
        assert identity(a)==identity(os.fstat(fd))==identity(os.lstat(backing))
        rows.append(dict(original=r['path'],originalAbsent=True,oldIdentityClaim='ENDS_AT_RECORDED_UNLINK_NOT_REVERIFIED',backing=r['backing'],backingFreshIdentity=identity(a),encodedBytes=en,encodedSHA256=encoded.hexdigest(),decodedBytes=dn,decodedSHA256=decoded.hexdigest(),fullGzipEOFVerified=True,authenticStatus=r.get('authenticStatus')))
    finally: os.close(fd)
assert sum(r['decodedBytes']-r['encodedBytes'] for r in rows)==summary['reclaimedBytes']
result=dict(utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='FULL_CONTENT_VERIFIED_NO_OLD_INODE_CONTINUITY_CLAIM',count=len(rows),summarySHA256=sha(summary_bytes),summaryFreshIdentity=summary_id,inventorySHA256=sha(inventory_bytes),inventoryFreshIdentity=inventory_id,mappingSHA256=sha(mapping_bytes),mappingFreshIdentity=mapping_id,reclaimedBytes=summary['reclaimedBytes'],rows=rows,qualification='NONE_CONTENT_ONLY_NO_RUNTIME_OR_SOURCE_GATE_SUBSTITUTION',helperSHA256=sha(Path(__file__).read_bytes()))
out=Q/'task04-native-c6-root-completed-evidence-compression-inspection.json'
with out.open('x') as f: json.dump(result,f,indent=2); f.write('\n')
print(json.dumps(dict(output=str(out),status=result['status'],count=len(rows),reclaimedBytes=result['reclaimedBytes'])))
