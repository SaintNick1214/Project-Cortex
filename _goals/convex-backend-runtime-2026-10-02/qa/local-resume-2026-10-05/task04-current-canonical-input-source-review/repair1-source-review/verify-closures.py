"""Finite repair1 and parent guard closure check; no implementation imports."""
import ast
import hashlib
import json
import os
from pathlib import Path
import stat

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
B=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
Q=B/'task04-current-canonical-input-producers/repair1'
P=B/'task04-current-producer-repair1-parent-preparation'
D=Path(__file__).resolve().parent
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
ident=lambda s:{k:str(getattr(s,'st_'+k))for k in FIELDS}
rows=[];fds=[];errors=[];checks=[]
def read(path,maximum=16777216):
    pre=os.lstat(path);assert stat.S_ISREG(pre.st_mode)and pre.st_nlink==1 and path.resolve()==path and pre.st_size<=maximum
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);fds.append((path,fd,ident(pre)));opened=os.fstat(fd);raw=bytearray()
    while part:=os.read(fd,65536):raw.extend(part);assert len(raw)<=maximum
    post=os.fstat(fd);final=os.lstat(path);assert ident(pre)==ident(opened)==ident(post)==ident(final)and len(raw)==pre.st_size
    row={'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'PRE':ident(pre),'OPEN':ident(opened),'POST':ident(post),'pathPOST':ident(final),'EOF':True};rows.append(row)
    return bytes(raw),row
try:
    raw,proof=read(Q/'manifest.json',262144);assert proof['sha256']=='fc967b7ddb5550668a4f61282513bad7604547e8cb08077d9ebc72d7ecb03e33';mf=json.loads(raw)
    assert mf['fileCount']==57 and mf['bytes']==11075943 and len(mf['files'])==len(set(mf['membership']))==57 and [r['path']for r in mf['files']]==mf['membership'] and mf['sourceWritersClosed']is True and mf['nativeClaims']is False and mf['DockerExecuted']is False and mf['fullPipeline48']=='UNEXECUTED_HELD'
    for pin in mf['files']:
        raw,observed=read(R/pin['path']);before=pin['PRE'].get('fields',pin['PRE']);assert observed['bytes']==pin['bytes']and observed['sha256']==pin['sha256']and observed['PRE']==before,('repair1 closed pin',pin['path'])
        if pin['path'].endswith('.py'):ast.parse(raw.decode(),filename=pin['path'])
    checks.append({'name':'repair1-exact57-closed-pins-and-full-EOF-nine','status':'PASS','files':57,'bytes':11075943})
    raw,freeze=read(Q/'freeze.json');assert freeze['sha256']=='81c03fad785964ce78de515315961f8b396ca604a4a7106ea166f4e71de2cfcf'and json.loads(raw)['allWritersStoppedAfterThisRecord']is True
    raw,parent_proof=read(P/'closed-parent-metadata-handoff1.json');parent=json.loads(raw);assert parent['status']=='PASS'and parent['allWriters']=='STOPPED_AFTER_THIS_RECEIPT'and len(parent['rows'])==5 and parent['Docker']is False
    for pin in parent['rows']:
        raw,observed=read(Path(pin['path']));assert observed['bytes']==pin['bytes']and observed['sha256']==pin['sha256']and observed['PRE']==pin['PRE'],('parent closed pin',pin['path'])
        if pin['path'].endswith('.py'):ast.parse(raw.decode(),filename=pin['path'])
    checks.append({'name':'parent-exact5-closed-pins-and-full-EOF-nine','status':'PASS','moduleSHA256':'d757f1524ae22d7f4f40da8fef509e5b080413c769a12e68ad7baab7ee528661'})
    old=B/'task04-current-canonical-input-producers/closed-source-manifest.json';raw,pin=read(old);assert pin['sha256']=='afc703999f7779d0621f6a3aedd8ac0792abe633e0b0f0690929c6e069a327ae'
    original=json.loads(raw)
    for pin in original['files']:
        raw,observed=read(R/pin['path']);assert observed['bytes']==pin['bytes']and observed['sha256']==pin['sha256']and observed['PRE']==pin['PRE']['fields'],('original unchanged',pin['path'])
    old_d=D.parent
    for name,expected in [('source-eligibility-verdict.json','82d2fc3dd2b4d6075ca6e30a36cf6622e560aa91e085e6173a9c2b82d0407264'),('operational-supplement1/verdict.json','7ef4b5d9b640d5571a842a349fb47089e385cdd1565da735829c1a16f4f81c67'),('actual-outcome1/verdict.json','966ffac9bf0d5a004fc4064f5d5cfec143767edc11a418e7de7ad4748c247391')]:
        raw,pin=read(old_d/name);assert pin['sha256']==expected
    checks.append({'name':'all-original23-and-three-prior-verdicts-unchanged','status':'PASS'})
    for path,fd,pre in fds:assert pre==ident(os.fstat(fd))==ident(os.lstat(path)),('final held-FD/path drift',str(path))
except BaseException as error:errors.append(repr(error))
finally:
    for _,fd,_ in fds:os.close(fd)
result={'scope':'INDEPENDENT_REPAIR1_SOURCE_AND_PARENT_METADATA_CURRENT_CLOSURE_ONLY','status':'PASS'if not errors else'FAIL','checks':checks,'observations':rows,'errors':errors,'heldFDsClosed':True,'nativeClaims':False,'Docker':False,'subjects':False,'historicalCustody':'NOT_ADOPTED','original48':'UNEXECUTED_HELD','Task03':'OPEN','Task04':'OPEN','wholeGoal':'OPEN'}
with(D/'closure-results.json').open('x')as f:f.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'checks':len(checks),'finiteReads':len(rows),'errors':errors}))
raise SystemExit(bool(errors))
