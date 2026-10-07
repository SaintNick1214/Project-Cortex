"""Finite mature held SOURCE/MOCK loader for the separately owned R1 repair."""
import ast,hashlib,json,os,stat,time
from pathlib import Path
N=Path(__file__).resolve().parents[1];P=N.parent;NEW=P/'task04-current-producer-native-public-repair3'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
OUTPUTS=[]
def put(path,value):
    raw=value if isinstance(value,bytes)else(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode();assert len(raw)<=16777216
    path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path,os.O_RDWR|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        view=memoryview(raw)
        while view:n=os.write(fd,view);assert n>0;view=view[n:]
        os.fsync(fd);before=ident(os.fstat(fd));os.lseek(fd,0,0);data=[]
        while b:=os.read(fd,65536):data.append(b)
        assert b''.join(data)==raw and ident(os.fstat(fd))==before and ident(path.lstat())==before
    finally:os.close(fd)
    pin={'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'selfExcludedUpstream':True};OUTPUTS.append(pin);return pin
paths=sorted(p for p in NEW.rglob('*')if p.is_file())
held=[];data={};rows=[];total=0;closes=[]
try:
    for p in paths:
        before=ident(p.lstat());age=time.time_ns()-max(int(before['mtime_ns']),int(before['ctime_ns']))
        assert age>=60000000000 and before['nlink']=='1'and stat.S_ISREG(int(before['mode']))
        total+=int(before['size']);assert total<=67108864 and int(before['size'])<=16777216 and len(held)<4096
        fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);held.append((p,fd,before,age));assert ident(os.fstat(fd))==before
    for p,fd,before,age in held:
        parts=[]
        while b:=os.read(fd,65536):parts.append(b)
        raw=b''.join(parts);assert len(raw)==int(before['size'])and ident(os.fstat(fd))==before and ident(p.lstat())==before
        data[str(p)]=raw;rows.append({'path':str(p),'PRE':before,'OPEN':before,'POST':before,'heldFD':fd,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'EOF':True,'ageNsAtFirstOpen':age})
    mf=json.loads(data[str(NEW/'source/source-manifest.json')]);assert len(mf['files'])==112
    for row in mf['files']:
        raw=data[str(NEW/'source'/row['path'])];assert (len(raw),hashlib.sha256(raw).hexdigest())==(row['bytes'],row['sha256'])
    syntax=[]
    for p,fd,before,age in held:
        if p.suffix=='.py':ast.parse(data[str(p)]);syntax.append(str(p))
    sources={p.relative_to(NEW/'source').as_posix():data[str(p)].decode()for p,fd,before,age in held if p.is_relative_to(NEW/'source')}
    counts=[]
    for name in ('independent-r1-controls.py','independent-r1-extra-controls.py','public_disposition_controls.py'):
        source=NEW/'controls'/name;g={'__file__':str(source),'__name__':'executor_mock','SOURCES':sources,'SOURCE_ROOT':str(NEW/'source')}
        exec(compile(data[str(source)],str(source),'exec'),g);result=g['RESULT']
        put(NEW/'controls'/(name+'.results.json'),result);counts.append({'program':name,'PASS':result['PASS'],'FAIL':result['FAIL']})
    put(NEW/'controls/syntax-results.json',{'scope':'PYTHON_AST_ONLY','count':len(syntax),'files':syntax,'PASS':len(syntax),'FAIL':0,'sourceEligibility':False})
    put(NEW/'controls/aggregate-results.json',{'scope':'EXECUTOR_SOURCE_MOCK_ONLY','results':counts,'PASS':sum(r['PASS']for r in counts),'FAIL':sum(r['FAIL']for r in counts),'runtimeAuthority':False,'sourceEligibility':False,'nativeBodiesExecuted':False,'originalAllSixTask04':'OPEN'})
    put(NEW/'evidence/first-mature-all-source-readback.json',{'files':rows,'count':len(rows),'bytes':total,'allFDsBeforeContents':True,'minimumAgeNs':min(r['ageNsAtFirstOpen']for r in rows),'scope':'SOURCE_MOCK_ONLY','sourceEligibility':False,'runtimeAuthority':False})
    for p,fd,before,age in held:
        os.lseek(fd,0,0);h=hashlib.sha256();size=0
        while b:=os.read(fd,65536):h.update(b);size+=len(b)
        assert (size,h.hexdigest())==(len(data[str(p)]),hashlib.sha256(data[str(p)]).hexdigest())and ident(os.fstat(fd))==before and ident(p.lstat())==before
finally:
    for p,fd,before,age in held:
        try:ret=os.close(fd);closes.append({'path':str(p),'fd':fd,'closeReturn':ret})
        except BaseException as e:closes.append({'path':str(p),'fd':fd,'closeError':repr(e)})
put(NEW/'evidence/final-held-source-FDclosure.json',{'files':rows,'FDCloses':closes,'allExplicitCloseReturnsObserved':all('closeReturn'in r for r in closes),'notHistoricalCustody':True,'newOutputsSelfExcludedUpstream':True})
put(NEW/'report.md',('''# Task Completion Report

## Status: COMPLETE for bounded authored repair; independent source eligibility PENDING

This separately owned finite112-file executable proposal repairs public export disposition and host result qualification. Only ci-run.py and public_export_contract.py have semantic changes. The other110 source files, unchanged bootstrap/public48/OWN20 and original100 conservation bytes remain unchanged. Original R1 and all its failed literal pins remain in place.

validate_public requires an exact None-or-string primaryFailure. Successful public acceptance requires a typed zero process exit, a None disposition, a complete exact48 unique PASS result list, held complete result bytes matching the transported hash/size, two full-byte/nine fences around strict parse, explicit close, a remaining-time fence and matching terminal bindings before and after export. Honest failed exports are transported as data and remain sticky failures. All original serial/deadline/security/resource functions and guards remain conserved.

The top-level workflow is proposed only. It points at this new namespace; no .github file is written or activated. Native120, cumulative export300, retirement60, public480, post-wait/post-close20/30/60, body2100/step2220/job2700, private PID1/fullCID/image/UUID/mount/resources remain unchanged. No Docker, native/service/private/CI execution occurred. Startup Python/interpreter/stdlib/tool-text loader is separately trusted; -B suppresses writes without proving cache-read exclusion.

Scoped executor SOURCE/MOCK results: '''+json.dumps(counts)+'''. Python AST parses: '''+str(len(syntax))+'''. These are outcome receipts, not source eligibility or original functionality acceptance. Original122/eight20/whole120/ROOT27/FULLRPC/48GB/C7missing11/transport5of36/unpublished4224 remain HELD. All six original Task04 criteria, Task03 and full17 goal remain OPEN.

Exact executed loader command: python3 -B with a tool-text mature no-follow/fullEOF/hash/nine loader of ../task04-current-producer-native-public-consumer-repair3/infrastructure/run-r1-controls.py. The loader source itself must be mature and held through its run. SOURCE/MOCK commands are compile/exec of the three separately held control source files listed in controls/aggregate-results.json; they receive only verified finite source strings and mocked dependencies. No original body is dispatched.

All outputs are self-excluded from their upstream input authority and require a distinct later first mature current consumer. The companion first source readback and final explicit FD closure record observed custody, not historic repair. A fresh independent judge is required after the current consumer closes.
''').encode())
put(NEW/'source-consumer-manifest.json',{'schema':'SEPARATE_R1_REPAIR3_FINITE_REFERENCE_MANIFEST','source112':mf,'currentInputByteReferences':[{k:r[k]for k in ('path','bytes','sha256')}for r in rows],'declaredSemanticDelta':'semantic-delta.json','outputByteReferences':list(OUTPUTS),'allOutputsSelfExcludedUpstream':True,'sourceEligibility':False,'runtimeAuthority':False,'originalTask04':'OPEN'})
put(NEW/'writer-stop.json',{'writersStopped':True,'scope':'ALL_R1_REPAIR3_SOURCE_CONTROL_REPORT_OUTPUT_WRITERS','stopTimeNs':time.time_ns(),'newOutputsRequireDistinctFirstMatureConsumer':True,'runtimeAuthority':False,'sourceEligibility':False,'closedHandoffSelfExcludedUpstream':True})
put(NEW/'closed-handoff.json',{'schema':'R1_REPAIR3_CLOSED_PROPOSAL_HANDOFF','sourceInputByteReferences':[{k:r[k]for k in ('path','bytes','sha256')}for r in rows],'outputByteReferences':list(OUTPUTS),'sourceEligibility':False,'runtimeAuthority':False,'workflow':'TOP_LEVEL_PROPOSED_ONLY','freshIndependentJudgeRequired':True,'writersStopped':True,'allOutputsSelfExcludedUpstream':True})
print(json.dumps({'results':counts,'syntax':len(syntax),'nativeEffects':False}))
