"""Rehash sealed public reviews and exact parent public transfer receipts."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

REPO=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt3-2026-10-05'
P=Q.parent/'local-resume-2026-10-05'
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
held={}
def ident(s): return {k:str(getattr(s,k)) for k in FIELDS}
def read(path):
    assert path==REPO or REPO in path.parents
    assert path.resolve()==path and not path.is_symlink()
    assert path.name not in ['target.json','deploy.env'] and not path.name.startswith('.env') and path.suffix!='.pem'
    for parent in path.parents: assert parent.is_dir() and not parent.is_symlink()
    s=path.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
    if path in held:
        fd,before,data=held[path];assert ident(s)==ident(os.fstat(fd))==before;return data
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        assert ident(s)==ident(os.fstat(fd));parts=[]
        while True:
            part=os.read(fd,1048576)
            if not part:break
            parts.append(part)
        data=b''.join(parts);assert len(data)==s.st_size
        assert ident(s)==ident(path.lstat())==ident(os.fstat(fd))
        held[path]=(fd,ident(s),data);return data
    except BaseException:os.close(fd);raise
def load(path):return json.loads(read(path))
def pin(path,sha,size=None):
    data=read(path);assert hashlib.sha256(data).hexdigest()==sha,str(path)
    if size is not None:assert len(data)==size,str(path)
try:
    manifests=[];historical=[]
    for name,sha,count,bindings in [('task03-attempt3-preparation-review','9b637e69a8908a14bd78b45e4535799b888777c5cd4c2a3c7e868a04f0e81b73',127,2669),('task03-attempt3-management-review','09984b8a1aecc89b5aa2cf487960e3ded7184dce760ecec2ddcd6536049343dd',29,4)]:
        path=P/name/'evidence-manifest.json';pin(path,sha);j=load(path)
        assert len(j['files'])==count and len(j['currentExternalSourceBindings'])==bindings
        for row in j['files']:pin(path.parent/row['path'],row['sha256'],row['bytes'])
        for row in j['currentExternalSourceBindings']:
            f=Path(row['path']);pin(f,row['sha256'],row['bytes'])
            old=row.get('currentHeldPathIdentityDecimal',row.get('identityDecimal'))
            assert old is not None
            if old!=held[f][1]:historical.append({'path':str(f),'changedFields':[k for k in FIELDS if old[k]!=held[f][1][k]],'cause':'UNKNOWN'})
        manifests.append({'path':str(path.relative_to(REPO)),'sha256':sha,'evidenceFiles':count,'currentExternalBindings':bindings,'contentPins':'PASS'})
    pin(Q/'independent-preparation-review.json','b452d7a77591651bb71c9e768db3ff3e3367654a79ecbbf3f07ad850cf6bdef6')
    pin(P/'task03-attempt3-management-review.json','e20c0367848052d3ae0e9f4d30844374d030c1a039ff8f0a5d97d64addfee10b')
    pin(P/'task03-attempt3-linux-public-transfer.py','c683d5d3bea7f26178c0e996aebe1aeedd989e4dd4cbd323d7b4cb0a52f7b168')
    pin(P/'task03-attempt3-public-coordinate.py','a3e417965861649806dc4cef392a612afc6acb9f27ae36d96f2e7fe0b798a43e')
    pin(P/'task03-attempt3-target-management.mjs','a1b39e13afeccd3f81fb91fed9eef1228dc8e0d8886cb0bb4ba6f42ea871cd77')
    request=load(Q/'project-request.json')
    parsed=hashlib.sha256(json.dumps(request,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    assert parsed=='172bbc4c5fb38f1b5affd81d4a7a0d90d39b163e221b37f5ca0695ecc7d0128c'
    assert request['operation']=='d98bad88-5157-4816-b458-4160e7945361'
    assert request['projectName']==request['projectSlug']=='cortex-foundation-delta-e61459999333'
    assert request['teamId']==325340 and request['maximumPaidCalls']==0
    for path,scope in [(Q/'independent-preparation-review.json','BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'),(P/'task03-attempt3-management-review.json','TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY')]:
        j=load(path);assert j['independent'] is True and j['verdict']=='PASS' and j['scope']==scope
        assert j['candidateSha256']=='2fb8d11a7e6c0bcaf92b2fe8d7ff228a6e554f9241c07c22079e6be8bcc870ef'
    commands=load(P/'task03-attempt3-public-command-receipts.json')
    assert commands['operation']==request['operation'] and len(commands['commands'])==4
    labels=['volume-absence','volume-create','root-init','receiver']
    assert [r['label'] for r in commands['commands']]==labels
    for row in commands['commands']:
        for stream in ['stdout','stderr']:pin(P/('task03-attempt3-public-'+row['label']+'.'+stream),row[stream+'Sha256'])
        assert row['exitCode']==(1 if row['label']=='volume-absence' else 0)
        if row['label'] in ['root-init','receiver']:
            args=row['argv']
            for flag,value in [('--platform','linux/amd64'),('--network','none'),('--memory','512m'),('--memory-swap','512m')]:assert args[args.index(flag)+1]==value
            mounts=[args[i+1] for i,x in enumerate(args) if x=='--mount']
            if row['label']=='root-init':assert args[args.index('--user')+1]=='0:0' and len(mounts)==1 and 'type=volume' in mounts[0]
            else:assert args[args.index('--user')+1]=='501:20' and len(mounts)==3 and all('readonly' in m for m in mounts if 'type=bind' in m)
    rows=[]
    for path,(fd,before,data) in held.items():
        assert ident(os.fstat(fd))==ident(path.lstat())==before
        rows.append({'path':str(path.relative_to(REPO)),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'currentIdentityDecimal':before})
    print(json.dumps({'status':'PASS','scope':'SEALED_PREPARATION_MANAGEMENT_AND_TRANSFER_CURRENT_PUBLIC_BINDINGS','manifests':manifests,'files':sorted(rows,key=lambda r:r['path']),'distinctHeldFiles':len(rows),'historicalReviewTupleObservation':{'status':'FAIL' if historical else 'PASS','drifts':historical,'cause':'UNKNOWN' if historical else None},'currentAll9HeldPathContinuity':'PASS','requestParsedSha256':parsed,'parentTransferRawReceipts':4,'rootInitBindSources':0,'privateByteReads':0,'serviceRequests':0,'qualificationAccepted':False,'fullTask03':'OPEN'}));sys.stdout.flush()
    for path,(fd,before,data) in held.items():assert ident(os.fstat(fd))==ident(path.lstat())==before
finally:
    for fd,_,_ in held.values():os.close(fd)
