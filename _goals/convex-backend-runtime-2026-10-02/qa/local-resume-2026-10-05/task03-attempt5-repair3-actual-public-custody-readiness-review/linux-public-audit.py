"""Independent read-only public custody audit. No private traversal or execution."""
import base64
import gzip
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q = R / '_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06'
FREEZE = '053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570'
FIELDS = ('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
MAX_BODY = 4 * 1024 * 1024

def identity(value):
    return {k:str(getattr(value,k)) for k in FIELDS}

def canonical(path, base, private_mode=False):
    assert path == base or base in path.parents
    current = base
    for component in ('.', *path.relative_to(base).parts):
        if component != '.':
            current /= component
        value = current.lstat()
        assert not stat.S_ISLNK(value.st_mode) and current.resolve() == current
        if current != path:
            assert stat.S_ISDIR(value.st_mode)
        if private_mode:
            assert value.st_uid == 501 and value.st_gid == 20
            assert stat.S_IMODE(value.st_mode) == (0o700 if stat.S_ISDIR(value.st_mode) else 0o600)

def read(path, base, private_mode=False, collect=False):
    canonical(path,base,private_mode)
    before = path.lstat()
    assert stat.S_ISREG(before.st_mode) and before.st_nlink == 1
    assert before.st_uid == 501 and before.st_gid == 20
    fd = os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        pin=identity(before)
        assert identity(os.fstat(fd)) == pin
        digest=hashlib.sha256(); length=0; chunks=[]
        while True:
            data=os.read(fd,65536)
            if not data:
                break
            length += len(data); digest.update(data)
            if collect:
                assert length <= MAX_BODY
                chunks.append(data)
        assert length == before.st_size
        assert identity(os.fstat(fd)) == identity(path.lstat()) == pin
        return {'path':str(path),'sha256':digest.hexdigest(),'bytes':length,'identityDecimal':pin,
                'fullEOF':True,'allNinePreOpenPostFinal':True}, b''.join(chunks)
    finally:
        os.close(fd)

def emit(value):
    raw=json.dumps(value,separators=(',',':')).encode()
    assert len(raw) <= MAX_BODY
    encoded=base64.b64encode(gzip.compress(raw,compresslevel=9,mtime=0))
    envelope={'encoding':'gzip+base64','decodedBytes':len(raw),'decodedSha256':hashlib.sha256(raw).hexdigest(),'body':encoded.decode()}
    out=json.dumps(envelope,separators=(',',':')).encode()+b'\n'
    assert len(out) <= 262144
    os.write(1,out)

assert os.getuid()==501 and os.getgid()==20 and sys.platform=='linux'
receipt_path=Path('/owned/public-transfer-receipt.json')
receipt_meta,receipt_raw=read(receipt_path,Path('/owned'),True,True)
if sys.argv[1]=='collect':
    emit({'scope':'FULL_PUBLIC_TRANSFER_RECEIPT_COLLECTION','receiptMetadata':receipt_meta,'receiptBody':receipt_raw.decode()})
    raise SystemExit(0)
assert sys.argv[1]=='audit' and len(sys.argv)==3
assert receipt_meta['sha256']==sys.argv[2]
receipt=json.loads(receipt_raw)
assert receipt['scope']=='NEW_PROSPECTIVE_LINUX_PUBLIC_CANDIDATE_CUSTODY_ONLY'
assert receipt['sourceFreezeSha256']==FREEZE and receipt['actualServiceRequests']==0
assert receipt['qualificationAccepted'] is False and receipt['privateBytesCopied'] is False
assert receipt['baselineGeneratedCompared'] is True
rows=receipt['files']; names=[row['path'] for row in rows]
assert len(rows)==len(set(names))==1912
for row in rows:
    assert set(row['sourceIdentityDecimal'])==set(row['destinationIdentityDecimal'])==set(FIELDS)
    assert all(isinstance(v,str) and v.isdecimal() for v in [*row['sourceIdentityDecimal'].values(),*row['destinationIdentityDecimal'].values()])
    path=Path(row['path']); assert not path.is_absolute() and '..' not in path.parts
candidate=Path('/owned/candidate')
actual=[]; directory_count=0
for root,dirs,files in os.walk(candidate,followlinks=False):
    root=Path(root); canonical(root,candidate,True); assert root.is_dir()
    directory_count+=1
    for name in dirs:
        path=root/name; canonical(path,candidate,True); assert stat.S_ISDIR(path.lstat().st_mode)
    for name in files:
        path=root/name; canonical(path,candidate,True); assert stat.S_ISREG(path.lstat().st_mode)
        actual.append(str(path.relative_to(candidate)))
assert sorted(actual)==sorted(names)
freeze_meta,freeze_bytes=read(candidate/'candidate-freeze-attempt5.json',candidate,True,True)
assert freeze_meta['sha256']==FREEZE
freeze=json.loads(freeze_bytes)
assert len(freeze['files'])==1905 and freeze['actualExternalRequests']==freeze['actualDeployments']==0
frozen={row['path']:row for row in freeze['files']}; assert len(frozen)==1905
generated=['managed-fixture/fixture/convex/_generated/'+n for n in ['api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js']]
expected_names=set(frozen)|{'candidate-freeze-attempt5.json','independent-preparation-review.json'}|set(generated)
assert len(expected_names)==1912 and set(names)==expected_names
_,manifest_bytes=read(candidate/'managed-fixture-copy-manifest.json',candidate,True,True)
baseline=json.loads(manifest_bytes)
mutable={row['copy']:row for row in baseline['files'] if row.get('officialCodegenMutable') is True}
assert set(mutable)==set(generated) and len(mutable)==5
assert set(generated).isdisjoint(frozen)
_,review_bytes=read(candidate/'independent-preparation-review.json',candidate,True,True)
review=json.loads(review_bytes)
assert review['verdict']=='PASS' and review['independent'] is True and review['candidateSha256']==FREEZE
assert review['scope']=='BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'
observed=[]; historical_differences=[]
for row in rows:
    name=row['path']
    dest,_=read(candidate/name,candidate,True)
    source,_=read(Q/name,Q)
    assert dest['identityDecimal']==row['destinationIdentityDecimal'], 'destination_all9_changed:'+name
    assert source['sha256']==dest['sha256']==row['sha256']
    assert source['bytes']==dest['bytes']==row['bytes']
    pin=frozen.get(name,mutable.get(name))
    if pin is not None:
        assert row['sha256']==pin['sha256'] and row['bytes']==pin['bytes']
    changes=[field for field in FIELDS if source['identityDecimal'][field]!=row['sourceIdentityDecimal'][field]]
    if changes:
        historical_differences.append({'path':name,'fields':changes})
    observed.append({'path':name,'sha256':source['sha256'],'bytes':source['bytes'],
                     'currentSourceIdentityDecimal':source['identityDecimal'],'currentDestinationIdentityDecimal':dest['identityDecimal'],
                     'fullEOF':True,'allNinePreOpenPostFinal':True})
assert read(receipt_path,Path('/owned'),True)[0]==receipt_meta
for row in observed:
    assert identity((Q/row['path']).lstat())==row['currentSourceIdentityDecimal']
    assert identity((candidate/row['path']).lstat())==row['currentDestinationIdentityDecimal']
emit({'scope':'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY','status':'PASS','files':1912,'frozenMembers':1905,'generatedBaselineMembers':5,
      'candidateDirectories':directory_count,'receiptMetadata':receipt_meta,'observed':observed,
      'allCurrentDestinationIdentities':'PASS_ALL9','currentSourceDestinationFullContent':'PASS_FULL_EOF_HASH_SIZE_ALL1912',
      'currentSourceAll9ThroughAudit':'PASS_ALL9_PRE_OPEN_POST_FINAL_ALL1912',
      'historicalSourceIdentity':'UNKNOWN_BIND_SESSION_IDENTITY_NOT_RESTORED' if historical_differences else 'PASS_ALL9',
      'historicalSourceIdentityDifferences':historical_differences,'privateReads':0,'volumeWrites':0,'externalRequests':0,'nativeAccepted':False})
