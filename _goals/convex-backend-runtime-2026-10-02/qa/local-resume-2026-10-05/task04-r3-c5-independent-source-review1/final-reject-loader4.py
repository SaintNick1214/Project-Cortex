"""Small finite REJECT publisher custody; never repairs original failed tuples."""
import hashlib,json,os,stat,time,sys
from pathlib import Path
J=Path("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1");P=J.parent
A=P/'task04-current-producer-native-public-repair3';B=P/'task04-current-producer-native-public-consumer-repair3'
WORKER=J/'final-reject-publisher3.py';LOADER=J/'final-reject-loader4.py';STOP=J/'final-reject-author-stop4.json'
PATHS=[WORKER,LOADER,STOP,P/'root-task04-r3-c5-mature-readback2.json',J/'holder2-final-UNKNOWN-closure1.json',J/'source-FDclosure.json',J/'metadata-flags-xattr-names1.json',
       A/'source/ci-run.py',A/'source/native_export.py',A/'source/public_export_contract.py',B/'programs/consumer.py',J/'final-reject-subset-FDclosure2.json',J/'final-review-writer-stop2.json',J/'publisher2-author-byte-diagnosis1.json',J/'final-reject-publisher2.py',J/'final-reject-subset-FDclosure3.json',J/'final-review-writer-stop3.json']
NEW={str(p)for p in(WORKER,LOADER,STOP,J/'final-reject-subset-FDclosure3.json',J/'final-review-writer-stop3.json')}
BASE_FILES=1604;BASE_BYTES=66406738;MAX_FILES=4096;MAX_BYTES=67108864;MAX_FILE=16777216
def wire(v):return(json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def digest(raw):return hashlib.sha256(raw).hexdigest()
def nine(s):return[s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_uid,s.st_gid,s.st_size,s.st_mtime_ns,s.st_ctime_ns]
def read_full(fd):
    out=[];total=0
    while True:
        b=os.read(fd,min(131072,MAX_FILE+1-total))
        if not b:return b''.join(out)
        total+=len(b);assert total<=MAX_FILE
        out.append(b)
def write_output(name,raw):
    path=J/name;fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        v=memoryview(raw)
        while v:
            n=os.write(fd,v);assert n>0;v=v[n:]
        os.fsync(fd)
    finally:os.close(fd)
    return{'path':str(path),'sha256':digest(raw),'bytes':len(raw),'origin':'AUTHORED_OUTPUT_BYTES_SELF_EXCLUDED_PENDING_ROOT_MATURE_PHYSICAL_READ'}
def main(author_loader_bytes,author_worker_bytes):
    owned=[];pins={};raws={};primary=None;publication=None;result=None;stage='ACQUISITION';final=[];closes=[];close_errors=[]
    ledger={'limits':{'files':MAX_FILES,'bytes':MAX_BYTES,'perFileBytes':MAX_FILE},'originalCumulativeFiles':BASE_FILES,'originalCumulativeBytes':BASE_BYTES,
      'newDistinctInputPaths':sorted(NEW),'newInputFiles':0,'newInputBytes':0,'files':BASE_FILES,'bytes':BASE_BYTES,
      'originalRemainingBytes':MAX_BYTES-BASE_BYTES,'noReset':True,'metadataExemption':False,'newSubsetNotWholeSourceAcceptance':True}
    try:
        # Every successful open immediately has exactly one lifetime owner.
        for path in PATHS:
            fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
            owned.append({'path':str(path),'fd':fd,'attemptedClose':False})
            row=owned[-1];s=os.fstat(fd);pre=nine(s);now=time.time_ns()
            assert stat.S_ISREG(s.st_mode)and s.st_uid==501 and s.st_gid==20 and s.st_nlink==1
            assert s.st_size<=MAX_FILE and now-max(s.st_mtime_ns,s.st_ctime_ns)>=60000000000,(str(path),'MATURITY_DENIED')
            assert nine(os.lstat(path))==pre
            assert not any(old.get('PRE9',[None,None])[:2]==pre[:2]for old in owned[:-1]),'FD_ALIAS'
            row.update(PRE9=pre,capturedUnixNs=now)
            if str(path)in NEW:
                ledger['newInputFiles']+=1;ledger['newInputBytes']+=s.st_size
                ledger['files']+=1;ledger['bytes']+=s.st_size
            assert ledger['files']<=MAX_FILES and ledger['bytes']<=MAX_BYTES,'SOURCE_BUDGET'
        # The entire finite subset is held before its first content read.
        for row in owned:
            fd=row['fd'];raw=read_full(fd);path=row['path']
            assert len(raw)==row['PRE9'][6]and nine(os.fstat(fd))==row['PRE9']and nine(os.lstat(path))==row['PRE9']
            row.update(bytes=len(raw),sha256=digest(raw),fullEOF=True)
            raws[path]=raw;pins[path]={k:v for k,v in row.items()if k not in('fd','attemptedClose')}
        assert raws[str(LOADER)]==author_loader_bytes and raws[str(WORKER)]==author_worker_bytes,'AUTHOR_SOURCE_CHANGED'
        stop=json.loads(raws[str(STOP)])
        assert stop['writerState']=='STOPPED'and stop['remainingWrites']==[]and stop['sourceOnly']is True
        assert stop['sources']==[{'path':str(WORKER),'sha256':digest(author_worker_bytes),'bytes':len(author_worker_bytes)},
                                {'path':str(LOADER),'sha256':digest(author_loader_bytes),'bytes':len(author_loader_bytes)}]
        ledger['remainingBytes']=MAX_BYTES-ledger['bytes'];ledger['remainingFDs']=MAX_FILES-ledger['files']
        ns={'__file__':str(WORKER),'__name__':'finite_reject_publisher2'}
        exec(compile(raws[str(WORKER)],str(WORKER),'exec'),ns)
        older=json.loads(raws[str(J/'final-reject-subset-FDclosure3.json')])
        assert older['cumulativeSourceLedger']['files']==BASE_FILES and older['cumulativeSourceLedger']['bytes']==BASE_BYTES
        assert older['primaryFailure']=={'type':'AssertionError','message':''}and older['publicationFailure']==older['primaryFailure']and not older['closeErrors']
        assert len(older['closeCalls'])==14 and older['allOwnedCloseAttemptsExactlyOnce']is True and older['closeRetries']==0
        diagnosis=json.loads(raws[str(J/'publisher2-author-byte-diagnosis1.json')])
        assert diagnosis['candidateFinding']is False and diagnosis['closeRetries']==0 and len(diagnosis['closeCalls'])==2
        assert diagnosis['rows'][0]['sha256']=='efa3ed95e35d0109fd6dc14518bb89323d5168bfe850f46367fd9abc72b77fbc'and diagnosis['rows'][0]['bytes']==14783
        ledger['priorFailedFinitePublisher']='AUTHOR_NEWLINE_EXPECTATION_AND_ROOT_NINE_SCHEMA_FAILURES_PRESERVED_NO_CANDIDATE_FINDING'
        ledger['priorFailureOriginalPinsRefreshed']=False
        stage='PUBLICATION';result=ns['main'](raws,pins,ledger)
    except BaseException as e:
        primary={'type':type(e).__name__,'message':str(e)}
        if stage=='PUBLICATION':publication=primary
    finally:
        # Keep primary failure sticky and attempt all final checks independently.
        for row in owned:
            check={'path':row['path'],'PRE9':row.get('PRE9')}
            try:
                fd=row['fd'];before=nine(os.fstat(fd));os.lseek(fd,0,0);raw=read_full(fd)
                after=nine(os.fstat(fd));path_after=nine(os.lstat(row['path']))
                check.update(before9=before,after9=after,pathAfter9=path_after,fullEOF=True,sha256=digest(raw),bytes=len(raw))
                check['exact']=row.get('PRE9')==before==after==path_after and row.get('sha256')==digest(raw)and row.get('bytes')==len(raw)
                if not check['exact']and primary is None:primary={'type':'FINAL_INPUT_MISMATCH','path':row['path']}
            except BaseException as e:
                check.update(exact=False,error={'type':type(e).__name__,'message':str(e)})
                if primary is None:primary=check['error']
            final.append(check)
        # Mark close attempt before calling os.close; never retry an unknown FD.
        for row in owned:
            assert row['attemptedClose']is False
            row['attemptedClose']=True;call={'path':row['path'],'fd':row['fd'],'attempt':1,'error':None}
            try:os.close(row['fd'])
            except BaseException as e:
                call['error']={'type':type(e).__name__,'message':str(e)};close_errors.append(call)
            closes.append(call)
    receipt={'scope':'FINITE_FINAL_REJECT_SUBSET_ONLY','sourceEligibility':False,'runtimeAuthority':False,
      'originalWholeCustody':'FAILED_UNKNOWN_NOT_REPAIRED','originalWholePinsRefreshed':False,
      'capturedPins':list(pins.values()),'allFinalChecks':final,'closeCalls':closes,'closeErrors':close_errors,
      'allOwnedCloseAttemptsExactlyOnce':len(closes)==len(owned)and all(r['attemptedClose']for r in owned),'closeRetries':0,
      'primaryFailure':primary,'publicationFailure':publication,'result':result,'cumulativeSourceLedger':ledger,
      'writerState':'STOPPED','remainingWrites':[],'outputsSelfExcludedUntilRootLaterMaturePhysicalRead':True}
    closurepin=write_output('final-reject-subset-FDclosure4.json',wire(receipt))
    stopbody={'scope':'FINAL_TASK04_REJECT_PACKET_WRITER_STOP','writerState':'STOPPED','remainingWrites':[],
      'authorStoppedUnixNs':time.time_ns(),'sourceOnly':True,'verdict':'REJECT'if result else'PUBLICATION_FAILED',
      'sourceEligibility':False,'runtimeAuthority':False,'oldWholeCustody':'FAILED_UNKNOWN_NOT_REPAIRED',
      'principals':result['principals']if result else[],'finalSubsetClosure':closurepin,'cumulativeSourceLedger':ledger}
    stoppin=write_output('final-review-writer-stop4.json',wire(stopbody))
    print(json.dumps({'result':result,'closure':closurepin,'stop':stoppin,'primaryFailure':primary,'closeErrors':close_errors},sort_keys=True),flush=True)
    return 0 if result is not None and primary is None and not close_errors else 1
