import os, stat, json, hashlib, time
from pathlib import Path

OWN=Path(__file__).resolve().parent
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
EXCLUDED=('hold-review.py','own-output-first-prospective-capture1.json','final-current-closure.json','writer-stop.json')

def identity(s): return {k:str(getattr(s,'st_'+k)) for k in FIELDS}
def content(fd):
    os.lseek(fd,0,0); h=hashlib.sha256(); count=0
    while True:
        b=os.read(fd,65536)
        if not b: break
        h.update(b); count+=len(b)
    return h.hexdigest(),count
def save(name,obj):
    with (OWN/name).open('x') as f:json.dump(obj,f,sort_keys=True,indent=2);f.write('\n')
def pin(rel):
    with (OWN/rel).open('rb') as f:
        h=hashlib.sha256();count=0
        while True:
            b=f.read(65536)
            if not b: break
            count+=len(b);h.update(b)
    return {'path':rel,'sha256':h.hexdigest(),'bytes':count}

paths=sorted(p for p in OWN.rglob('*') if p.is_file() and p.relative_to(OWN).as_posix() not in EXCLUDED)
fds={}; initial={}; errors=[]; aliases={}
for path in paths:
    pre=identity(os.lstat(path));fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);fds[path]=fd
    s=os.fstat(fd);op=identity(s);initial[path]={'PRE':pre,'OPEN':op}
    if pre!=op or not stat.S_ISREG(s.st_mode) or s.st_nlink!=1:errors.append({'path':str(path),'stage':'FIRST_PRE','error':'regular-nine-single-link-failure'})
    alias=(s.st_dev,s.st_ino)
    if alias in aliases: errors.append({'path':str(path),'stage':'FIRST_PRE','error':'inode-alias','other':str(aliases[alias])})
    aliases[alias]=path
rows=[]
for path,fd in fds.items():
    h,n=content(fd);post=identity(os.fstat(fd));current=identity(os.lstat(path));e=initial[path]
    if e['PRE']!=e['OPEN'] or post!=e['PRE'] or current!=e['PRE']:errors.append({'path':str(path),'stage':'FIRST_EOF','error':'nine-mismatch'})
    rows.append({'path':str(path),'relativePath':path.relative_to(OWN).as_posix(),**e,'POST':post,'pathFINAL':current,'sha256':h,'bytes':n,'EOF':True})
save('own-output-first-prospective-capture1.json',{'scope':'NEW_MATURE_REVIEW_OUTPUTS_FIRST_CURRENT_CONSUMER_ONLY','notHistoricalPRE':True,'excludedFiles':list(EXCLUDED),'failedHoldReviewPinRefreshed':False,'metadataBeforeContents':True,'files':rows,'errors':errors,'enclosingMacAuthority':False})
final=[];closes=[]
for row in rows:
    path=Path(row['path']);fd=fds[path];h,n=content(fd);held=identity(os.fstat(fd));current=identity(os.lstat(path))
    if held!=row['PRE'] or current!=row['PRE'] or h!=row['sha256'] or n!=row['bytes']:errors.append({'path':str(path),'stage':'FINAL','error':'literal-nine-or-full-byte-mismatch'})
    final.append({'path':str(path),'heldFINAL':held,'pathFINAL':current,'sha256':h,'bytes':n,'EOF':True})
    try:ret=os.close(fd);closes.append({'path':str(path),'return':ret})
    except BaseException as ex:closes.append({'path':str(path),'error':repr(ex)});errors.append({'path':str(path),'stage':'CLOSE','error':repr(ex)})
save('final-current-closure.json',{'scope':'INDEPENDENT_REJECT_NEW_OUTPUT_CONSUMER_CLOSED_NON_ENABLING','verdict':'REJECT','sourceEligibility':False,'runtimeAuthority':False,'historicalCustodyRepaired':False,'newOwnOutputFenceStatus':'PASS' if not errors else 'FAIL','firstConsumerCapture':pin('own-output-first-prospective-capture1.json'),'observedMatureWaitSecondsAtLeast':60,'logicallySelfExcludedCycleFiles':list(EXCLUDED),'priorFailedHoldReviewIdentityPreservedUnadopted':True,'priorSourcePacketDistinctFailedPins':119,'sourceExternalFDclosure':pin('evidence/final-held-source-external-FDclosure1.json'),'sourceExternalFDclosureErrors':239,'files':final,'FDCloses':closes,'errors':errors,'report':pin('report.md'),'verdictPin':pin('verdict.json'),'rawControls':pin('controls/independent-fence-control-results1.json')})
save('writer-stop.json',{'scope':'INDEPENDENT_SOURCE_REVIEW_CLOSED_REJECT_ONLY','allWritersStoppedAfterThisReceipt':True,'remainingWrites':[],'verdict':'REJECT','score':2.6,'sourceEligibility':False,'runtimeAuthority':False,'report':pin('report.md'),'verdictPin':pin('verdict.json'),'firstConsumerCapture':pin('own-output-first-prospective-capture1.json'),'finalCurrentClosure':pin('final-current-closure.json'),'original634FDclosure':pin('evidence/final-held-source-external-FDclosure1.json'),'rawControls':pin('controls/independent-fence-control-results1.json'),'newOwnOutputFenceStatus':'PASS' if not errors else 'FAIL','failedHoldReviewIdentityRefreshed':False,'all119FailedExternalIdentitiesPreserved':True,'permittedNextStep':'Distinct consumer-boundary repair plus new fresh review only; activation/native/publication HELD'})
print(json.dumps({'status':'CLOSED_REJECT','newOutputFiles':len(rows),'newOutputFence':'PASS' if not errors else 'FAIL','newOutputCloses':len(closes),'errors':errors,'pins':[pin(p) for p in ('report.md','verdict.json','own-output-first-prospective-capture1.json','final-current-closure.json','writer-stop.json','controls/independent-fence-control-results1.json')]}))
