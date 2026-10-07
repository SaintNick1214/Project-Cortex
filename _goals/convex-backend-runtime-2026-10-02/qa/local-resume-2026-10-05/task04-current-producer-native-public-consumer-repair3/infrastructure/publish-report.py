"""Publish finite report from mature held own source/control/data; no acceptance authority."""
import hashlib,json,os,stat,time
from pathlib import Path
N=Path(__file__).resolve().parents[1];P=N.parent;R1=P/'task04-current-producer-native-public-repair3'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def write(path,value):
    raw=value if isinstance(value,bytes)else(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode();assert len(raw)<=16777216
    fd=os.open(path,os.O_RDWR|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        view=memoryview(raw)
        while view:count=os.write(fd,view);assert count>0;view=view[count:]
        os.fsync(fd);pin=ident(os.fstat(fd));os.lseek(fd,0,0);read=[]
        while b:=os.read(fd,65536):read.append(b)
        assert b''.join(read)==raw and ident(os.fstat(fd))==pin and ident(path.lstat())==pin
    finally:returned=os.close(fd)
    return {'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'closeReturn':returned,'selfExcludedUpstream':True,'currentWriteReadbackNotFuturePRE':True}
paths=sorted(set([p for p in N.rglob('*')if p.is_file()]+[R1/'controls/aggregate-results.json',R1/'source/source-manifest.json',R1/'semantic-delta.json',R1/'writer-stop.json',R1/'closed-handoff.json']))
held=[];data={};rows=[];total=0;closes=[]
try:
    for p in paths:
        pre=ident(p.lstat());age=time.time_ns()-max(int(pre['mtime_ns']),int(pre['ctime_ns']))
        assert age>=60000000000 and pre['nlink']=='1'and stat.S_ISREG(int(pre['mode']))and int(pre['size'])<=16777216
        total+=int(pre['size']);assert total<=67108864 and len(held)<4096
        fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);held.append((p,fd,pre,age));assert ident(os.fstat(fd))==pre
    for p,fd,pre,age in held:
        parts=[]
        while b:=os.read(fd,65536):parts.append(b)
        raw=b''.join(parts);assert len(raw)==int(pre['size'])and ident(os.fstat(fd))==pre and ident(p.lstat())==pre
        data[str(p)]=raw;rows.append({'path':str(p),'PRE':pre,'OPEN':pre,'POST':pre,'heldFINAL':pre,'pathFINAL':pre,'heldFD':fd,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'EOF':True,'ageNsAtFirstOpen':age})
    current=json.loads(data[str(N/'evidence/current-consumer1.json')]);baseline=json.loads(data[str(N/'evidence/first-current-mature-baseline1.json')]);controls=json.loads(data[str(N/'controls/consumer-results2.json')]);r1=json.loads(data[str(R1/'controls/aggregate-results.json')]);plan=json.loads(data[str(N/'data/inputs-plan2.json')]);proof=json.loads(data[str(N/'evidence/plan2-first-held-reference-readback.json')])
    assert current['count']==baseline['count']==plan['count']==1500 and current['status']=='CURRENT_REFERENCE_MATCH'
    assert controls['PASS']==66 and controls['FAIL']==0 and r1['PASS']==92 and r1['FAIL']==0
    assert len(proof['original100'])==100 and all(r['match']is True for r in proof['original100'])
    bypath={r['path']:r for r in rows}
    active=['programs/consumer.py','controls/consumer_controls2.py','infrastructure/prepare.py','infrastructure/run-r1-controls.py','infrastructure/current-stage2.py','infrastructure/final-close.py','infrastructure/publish-report.py']
    source_mf=write(N/'program-source-manifest2.json',{'schema':'REPAIR3_CURRENT_ACTIVE_SOURCE_CONTROL_MF','files':[{'path':p,'bytes':bypath[str(N/p)]['bytes'],'sha256':bypath[str(N/p)]['sha256'],'firstMatureCurrentNine':bypath[str(N/p)]['PRE']}for p in active],'count':7,'oldFailedControlAndDriverPreservedAsData':True,'sourceEligibility':False,'runtimeAuthority':False,'selfExcludedUpstream':True})
    report='''# Task Completion Report

## Status: COMPLETE for bounded repair authorship and SOURCE/MOCK/current consumption; independent source eligibility PENDING

The distinct consumer repair3 qualifies the separately owned R1 repair3 finite executable proposal and immutable legacy graph. All1500 current references match their complete byte/hash/current-nine expectations. Original stable113 source/MF and336 external literals remain exact;100 original preimages/conservation backings were checked in full. Exactly119 old packet expectations still fail only in ctime; their bytes/pins and UNKNOWN cause remain unchanged. No historical custody is repaired. The original old R1/C4/Source2/Review3 packets and all their rejections remain untouched.

Consumer fixes: guard the baseline lifetime immediately after successful open; guard pending inputs separately; attempt every owned close exactly once including partial-open/fstat failures; never retry unknown FD state; close failure is sticky and accumulated/chained failure information survives; reject nonfinite float overflow at all JSON nesting levels while preserving finite values; retain one aggregate4096FD/64MiB/16MiB source ledger with no graph resets. Meaningful executor controls pass66/0, including four baseline failures, pending read/close, baseline close, double-close failure, complete positive baseline, all-close attempts and partial-open cleanup, valid finite/nested overflow, late-nine/maturity and aggregate caps.

R1 repair changes only ci-run.py and public_export_contract.py. All other110 executable files remain byte unchanged; original bootstrap/public48/OWN20/100 bodies remain byte conserved. Public failure disposition is exactly None-or-string; successful acceptance additionally requires typed process exit0, disposition None, complete48 unique PASS public results, held result full bytes/hash/nine around parse, explicit close, remaining deadline and exact terminal equality before/after export. Honest failed exports stay data and remain sticky failures. R1 executor controls pass92/0 with22 Python AST parses. Original serial120→export≤300 cumulative→retirement60→public480, exact prestart PID1/fullCID/image/UUID/mount/Source/Driver/PidMode/privateIPC/Initfalse/resources, post-wait/post-close20/30/60 fences and body2100/step2220/job2700 are conserved. The copied admission JSON remains expressly original R1 provenance; data/operative-r1-admission-binding.json provides the current source count/bytes/MF hash. The workflow is top-level proposed only; no .github write/activation exists.

Evidence sequence: mature held finite preparation; mature held R1 SOURCE/MOCK controls; plan1 full graph capture followed by a syntax-processing failure in newly authored consumer_controls.py; corrected controls2/driver2 with distinct mature unchanged-old-pin graph capture; plan2 publication then ≥60 actual seconds before baseline capture; baseline2636789 bytes/SHA44bee0d018e839106c29b9f68925891dc784b0fb827eb483f460b5db077b2008 publication then ≥60 actual seconds before distinct consumption; consumer2250994 bytes/SHA63fd920f7eda5bba054a4ebffcd5c3013359ad688134cba20db3c691734d2a83 publication then ≥60 actual seconds before this report input use. Plan2 source graph has50903386 bytes. Current consumption ledger is '''+json.dumps(current['aggregateLedger'],sort_keys=True)+'''.

The first source maturity guard denied before contents at56.336107385 seconds; its exact failure is preserved. Plan1's syntax typo and outputs remain supplemental failed data. Its finally block ran but individual close-return receipts were not published because processing raised; continuous custody across that gap is not claimed. Controls2/current-stage2 supersede execution only, with old sources/first pins preserved. program-source-manifest.json remains the first failed-source declaration; program-source-manifest2.json declares current active source/control membership. No assertion was weakened.

All qualifying source/control/data inputs are stopped, mature at least60 actual seconds since the later mtime/ctime, no-follow opened, read to full EOF, hash/size/nine verified and explicitly closed. Finite headers precede graph acquisition; all graph FDs precede referenced graph contents, sharing one aggregate ledger. Every publisher self-excludes its new outputs upstream. The final combined closing consumer must separately mature this report and every current own output; its complete EOF/hash/nine/close receipt is a mandatory companion, not preclaimed here. Final publication outputs then require the coordinator's distinct first mature read and fresh independent judge.

No native/Docker/service/private/CI workflow operation occurred. Python interpreter/stdlib/tool-text first loaders remain a separate trusted startup boundary; -B is write suppression without cache-read exclusion proof. SOURCE/MOCK receipts/current matches do not enable source eligibility, runtime authority, actual capacity, native effects or product behavior. Original122/eight20/whole120/ROOT27/FULLRPC/48GB/C7missing11/transport5of36/unpublished4224,741 executable operational and501/residual301 remain HELD. All original six Task04 criteria, Task03 and full17 goal remain OPEN.
'''
    report_pin=write(N/'report.md',report.encode())
    command_pin=write(N/'exact-commands.md',b'''# Exact scoped execution commands and entry bytes

Every entry was executed by python3 -B - with a tool-text loader that first lstat-checks actual>=60000000000ns maturity, os.open(O_RDONLY|O_NOFOLLOW), fstat/open-nine equality, reads os.read to full EOF, verifies hash/size/all nine, compile/exec from those held bytes, final-nine and explicit os.close. Its receipt is evidence/<stage>-loader-first-mature-FDclosure.json. The source entry paths and modes were:

1. infrastructure/prepare.py (no argv); one failed precontent maturity guard, then separate qualifying execution.
2. infrastructure/run-r1-controls.py (no argv); mocked controls receive verified finite SOURCES strings.
3. infrastructure/current-stage.py argv plan (processing SyntaxError preserved).
4. infrastructure/current-stage2.py argv plan (66/0 controls), baseline, consume.

consume supplied BASELINE_BYTE_PIN exactly {"bytes":2636789,"sha256":"44bee0d018e839106c29b9f68925891dc784b0fb827eb483f460b5db077b2008"}. No original native subject entry was dispatched. R1 SOURCE/MOCK compile/exec targets are controls/independent-r1-controls.py, controls/independent-r1-extra-controls.py and controls/public_disposition_controls.py. Consumer target is controls/consumer_controls2.py. Actual exact source bytes/hashes and held loader closures are in program-source-manifest2.json and evidence/.

5. infrastructure/publish-report.py (no argv), same mature held tool-text first-loader protocol.
6. infrastructure/final-close.py (no argv), same protocol, after all own report/output writers stop and actual>=60seconds.

The top-level R1 .yml.proposed and source/ci-run.py are executable proposals only, never invoked as workflow/native commands. No npm/SDK/application QA command was selected: the permitted changes are solely finite QA/source proposal packets, with meaningful Python AST and source/mock/current graph checks above.
''')
    manifest=write(N/'source-consumer-manifest.json',{'schema':'REPAIR3_FINITE_CURRENT_CONSUMER_REFERENCE_MANIFEST','operativeR1MF':{k:bypath[str(R1/'source/source-manifest.json')][k]for k in ('path','bytes','sha256')},'sourceControlMF':source_mf,'referencePlan':{k:bypath[str(N/'data/inputs-plan2.json')][k]for k in ('path','bytes','sha256')},'baseline':{k:bypath[str(N/'evidence/first-current-mature-baseline1.json')][k]for k in ('path','bytes','sha256')},'distinctCurrentConsumption':{k:bypath[str(N/'evidence/current-consumer1.json')][k]for k in ('path','bytes','sha256')},'matureReportInputByteReferences':[{k:r[k]for k in ('path','bytes','sha256')}for r in rows],'report':report_pin,'exactCommands':command_pin,'originalStableSource113':113,'originalStableExternal336':336,'original100':100,'old119':'FAILED_IMMUTABLE','oldFailedOwnPlan1Preserved':True,'newSemanticDelta':'data/semantic-delta.json','sourceEligibility':False,'runtimeAuthority':False,'originalAssertionsDeadlinesResourcesChanged':False,'futureFreshIndependentJudge':'REQUIRED','allPublisherOutputsSelfExcludedUpstream':True})
    for p,fd,pre,age in held:
        os.lseek(fd,0,0);h=hashlib.sha256();size=0
        while b:=os.read(fd,65536):size+=len(b);h.update(b)
        assert(size,h.hexdigest())==(len(data[str(p)]),hashlib.sha256(data[str(p)]).hexdigest())and ident(os.fstat(fd))==pre and ident(p.lstat())==pre
finally:
    failures=[]
    for p,fd,pre,age in held:
        try:ret=os.close(fd);closes.append({'path':str(p),'fd':fd,'closeReturn':ret})
        except BaseException as error:failures.append({'path':str(p),'fd':fd,'failure':repr(error),'retryForbidden':True})
    if failures:raise RuntimeError('REPORT_CLOSE_FAILURE_STICKY:'+repr(failures))
write(N/'evidence/report-input-final-FDclosure.json',{'files':rows,'FDCloses':closes,'count':len(rows),'bytes':total,'minimumAgeNs':min(r['ageNsAtFirstOpen']for r in rows),'allFDsBeforeContents':True,'allFinalFullEOFHashNineFences':True,'sourceEligibility':False,'runtimeAuthority':False,'upstreamSelfExcluded':True})
write(N/'writer-stop.json',{'writersStopped':True,'scope':'ALL_REPAIR3_SOURCE_CONTROL_DATA_REPORT_MANIFEST_WRITERS_BEFORE_FINAL_DISTINCT_CLOSING_CONSUMER','stopTimeNs':time.time_ns(),'sourceEligibility':False,'runtimeAuthority':False,'finalClosingPublicationOutputsSelfExcludedUpstream':True})
print(json.dumps({'reportedCurrentCount':1500,'sourceMockPASS':158,'sourceMockFAIL':0,'reportInputFiles':len(rows),'reportInputBytes':total,'sourceEligibility':False}))
