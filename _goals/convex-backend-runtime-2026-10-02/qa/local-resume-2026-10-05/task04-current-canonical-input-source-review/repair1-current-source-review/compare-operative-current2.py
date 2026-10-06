"""Independent exact prospective operative pin/EOF/final-fence qualification."""
import ast
import hashlib
import json
import os
from pathlib import Path
import stat

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
B=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
BASE=B/'task04-current-producer-repair1-current-source-baseline1'
W=R/'work/resume/task04-c8-current-canonical-input-producers/repair1'
D=Path(__file__).resolve().parent
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
ident=lambda s:{k:str(getattr(s,'st_'+k))for k in FIELDS}
rows=[];fds=[];checks=[];errors=[]
def read(path,maximum=16777216):
    pre=os.lstat(path);assert stat.S_ISREG(pre.st_mode)and pre.st_nlink==1 and pre.st_size<=maximum and path.resolve()==path,str(path)
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);fds.append((path,fd,ident(pre)));opened=os.fstat(fd);raw=bytearray()
    while block:=os.read(fd,65536):raw.extend(block);assert len(raw)<=maximum
    post=os.fstat(fd);final=os.lstat(path);assert ident(pre)==ident(opened)==ident(post)==ident(final)and len(raw)==pre.st_size
    rows.append({'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'PRE':ident(pre),'OPEN':ident(opened),'POST':ident(post),'pathPOST':ident(final),'EOF':True})
    return bytes(raw),rows[-1]
try:
    raw,mfp=read(BASE/'operative-source-manifest.json',262144);assert mfp['sha256']=='cd9f9ec772b505b9436b307e21ca5b6799f820ea9e62169ea08610ccc335a125';mf=json.loads(raw)
    assert mf['scope']=='FRESH_PROSPECTIVE_CURRENT_OPERATIVE_SOURCE_ONLY'and mf['operationUUID']=='f83336fb-794a-4878-87ec-f85612ade6a6'and mf['fileCount']==len(mf['files'])==22 and mf['bytes']==10909629 and mf['DockerExecuted']is False and mf['native']is False and mf['full48']=='UNEXECUTED'and mf['physicalAdmission']=='UNRELEASED'and mf['errors']==[]
    found={};raws={}
    for pin in mf['files']:
        assert pin['path']not in found and pin['PRE']['schema']=='FS_IDENTITY_DECIMAL_V1'and set(pin['PRE']['fields'])==set(FIELDS)
        raw,row=read(R/pin['path']);assert row['bytes']==pin['bytes']and row['sha256']==pin['sha256'],('operative-bytes',pin['path']);differences={k:{'closed':pin['PRE']['fields'][k],'current':row['PRE'][k]}for k in FIELDS if pin['PRE']['fields'][k]!=row['PRE'][k]};
        if differences:errors.append({'scope':'FAILED_PROSPECTIVE_BASELINE1_PIN_NOT_REFRESHED','path':pin['path'],'differences':differences})
        assert pin['EOF']is True;found[pin['path']]=pin;raws[pin['path']]=raw
        if pin['path'].endswith('.py'):ast.parse(raw.decode(),filename=pin['path'])
    assert sum(pin['bytes']for pin in mf['files'])==10909629
    input_mf=json.loads(raws[str((W/'proposal/input-manifest.json').relative_to(R))]);assert type(input_mf['fileCount'])is int and input_mf['fileCount']==len(input_mf['files'])==14 and type(input_mf['inputBytes'])is int and input_mf['inputBytes']==10823732
    expected={str(Path(row['hostSource']).relative_to(R))for row in input_mf['files']}
    expected.update(str((W/'proposal'/name).relative_to(R))for name in('bootstrap.py','input-manifest.json','recipe.json','public-control-demand.json'))
    expected.update(str(path.relative_to(R))for path in(BASE/'parent-run.py',BASE/'public-cli.py',B/'task04-current-producer-repair1-parent-preparation/metadata-module.py',R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06/coordinate-source/repair3/task03-attempt5-coordinate-common.py'))
    assert len(expected)==22 and expected==set(found)
    for record in input_mf['files']:
        pin=found[str(Path(record['hostSource']).relative_to(R))];assert pin['bytes']==record['bytes']and pin['sha256']==record['sha256']
    checks.append({'name':'exact22-operative-membership-not-QA-artifact-authority','status':'PASS','files':22,'bytes':10909629,'inputFiles':14,'inputBytes':10823732})
    raw,handoff=read(BASE/'baseline-handoff.json');x=json.loads(raw);assert x['manifestSHA256']==mfp['sha256']and x['sourceWriters']=='STOPPED'and x['sourceCount']==22 and x['errors']==[]and x['Docker']is False
    old=B/'task04-current-canonical-input-source-review/repair1-source-review'
    for name,status,count in [('helper-controls-results.json','PASS',59),('monitor-controls-initial.json','PASS',16),('parser-controls-results2.json','PASS',11),('parser-controls-results.json','FAIL',0)]:
        raw,row=read(old/name);x=json.loads(raw);assert x['status']==status and x['count']==count
    for name,expected_sha in [('verdict.json','d7a507bac560f529ddd18e7ace573e850df7d30cf0201241281f790ebb95f5c0'),('report.md','c43a439f41620ce726540e23db9189c524e8af056ef22f9d6f941578f4f3cf98'),('finite-evidence-manifest.json','dc5656fa783328c7b2862bff6a08d602dab9be89e46c70107021a295775fcc40')]:
        raw,row=read(old/name,524288);assert row['sha256']==expected_sha
    raw,row=read(B/'task04-current-canonical-input-producers/repair1/manifest.json',262144);assert row['sha256']=='fc967b7ddb5550668a4f61282513bad7604547e8cb08077d9ebc72d7ecb03e33'
    checks.append({'name':'86-previous-source-checks-and-failed-history-verdict-conserved','status':'PASS','historical57':'FAILED_NOT_REFRESHED','firstParserAttempt':'FAIL_UNKNOWN_CTIME_CONSERVED'})
    for path,fd,pin in fds:assert pin==ident(os.fstat(fd))==ident(os.lstat(path)),('final-held-fd-path-nine',str(path))
    checks.append({'name':'all-read-fullEOF-nine-and-final-held-FD-path-fences','status':'PASS','finiteReads':len(rows)})
except BaseException as error:errors.append(repr(error))
finally:
    for path,fd,pin in fds:os.close(fd)
result={'scope':'INDEPENDENT_NEW_PROSPECTIVE_OPERATIVE_CURRENT_SOURCE_QUALIFICATION_ONLY','status':'PASS'if not errors else'FAIL','manifestSHA256':'cd9f9ec772b505b9436b307e21ca5b6799f820ea9e62169ea08610ccc335a125','checks':checks,'observations':rows,'errors':errors,'historicalPins':'NOT_ADOPTED_OR_REFRESHED','Docker':False,'full48':'UNEXECUTED','native':False,'physicalAdmission':'UNRELEASED','Task03':'HELD','Task04':'OPEN','wholeGoal':'OPEN'}
with(D/'operative-current-comparison2.json').open('x')as f:f.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'checks':len(checks),'finiteReads':len(rows),'errors':errors}));raise SystemExit(bool(errors))
