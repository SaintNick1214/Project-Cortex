"""Held, mature reviewer entry and headers; all FDs share the actor ledger."""
import hashlib,json,os,stat,time,types
from pathlib import Path

J=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-root-borrowed-guard-independent-review3')
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(s):
    return dict(zip(FIELDS,map(str,(s.st_dev,s.st_ino,s.st_mode,s.st_uid,s.st_gid,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns))))
def eof(fd):
    chunks=[]
    while True:
        data=os.read(fd,65536)
        if not data:return b''.join(chunks)
        chunks.append(data)

def run(outer_row,outer_fd,outer_raw):
    began=time.monotonic();rows=[outer_row];fds={outer_row['path']:outer_fd};bodies={outer_row['path']:outer_raw};errors=[];ledger=None;owner=None;result=None
    outer_row['closeAttempts']=0
    try:
        for name in ('held-review-entry2.py','review-source-input-plan2.json','review-writers-stopped2.json'):
            path=J/name;s=os.lstat(path);age=(time.time_ns()-max(s.st_mtime_ns,s.st_ctime_ns))/1e9
            assert age>=240 and stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_uid==501 and s.st_gid==20 and s.st_size<=16777216
            rows.append({'path':str(path),'bytes':s.st_size,'PRE9':nine(s),'ageSeconds':age,'closeAttempts':0})
        for row in rows[1:]:
            fd=os.open(row['path'],os.O_RDONLY|os.O_NOFOLLOW);fds[row['path']]=fd;row['OPEN9']=nine(os.fstat(fd));assert row['OPEN9']==row['PRE9']
        for row in rows[1:]:
            raw=eof(fds[row['path']]);assert len(raw)==row['bytes'];row.update(sha256=hashlib.sha256(raw).hexdigest(),fullEOF=True,POST9=nine(os.fstat(fds[row['path']])));assert row['POST9']==row['PRE9'];bodies[row['path']]=raw
        plan=json.loads(bodies[str(J/'review-source-input-plan2.json')]);stop=json.loads(bodies[str(J/'review-writers-stopped2.json')])
        assert stop['remainingWrites']==[] and time.time_ns()-int(stop['stoppedUnixNs'])>=240000000000
        assert stop['planSha256']==hashlib.sha256(bodies[str(J/'review-source-input-plan2.json')]).hexdigest()
        for path in (J/'held-review-entry2.py',J/'native-bootstrap2.py'):
            member=next(x for x in plan['members']if x['path']==str(path));row=next(x for x in rows if x['path']==str(path))
            assert member['bytes']==row['bytes'] and member['sha256']==hashlib.sha256(bodies[str(path)]).hexdigest() and member['PRE9']==row['PRE9']
        assert time.monotonic()-began<=30
        m=types.ModuleType('independent_G3_exact_held_source_entry1');m.__file__=str(J/'held-review-entry2.py')
        exec(compile(bodies[m.__file__],m.__file__,'exec',dont_inherit=True),m.__dict__)
        result,ledger,owner=m.main(bootstrap_fds=tuple(fds.values()))
    except BaseException as error:
        errors.append({'stage':'primary','type':type(error).__name__,'error':str(error)})
    finally:
        for row in rows:
            if row['path']not in fds:continue
            try:
                fd=fds[row['path']];os.lseek(fd,0,os.SEEK_SET);raw=eof(fd);assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'];row.update(finalEOF=True,FINAL9=nine(os.fstat(fd)));assert row['FINAL9']==row['PRE9'] and nine(os.lstat(row['path']))==row['PRE9']
            except BaseException as error:errors.append({'stage':'final','path':row['path'],'type':type(error).__name__,'error':str(error)})
        for row in rows:
            if row['path']not in fds:continue
            row['closeAttempts']+=1;success=False
            try:os.close(fds[row['path']]);row['closeOutcome']='CLOSED_ONCE';success=True
            except BaseException as error:row['closeOutcome']='UNKNOWN';errors.append({'stage':'close','path':row['path'],'type':type(error).__name__})
            if ledger is not None:
                try:ledger.release_fd(fds[row['path']],owner,success)
                except BaseException as error:errors.append({'stage':'ledger_close','path':row['path'],'type':type(error).__name__,'error':str(error)})
    receipt={'scope':'INDEPENDENT_G3_HELD_NATIVE_BOOTSTRAP_NO_EFFECTS','sourceRecords':rows,'errors':errors,'allThreeAdditionalNativeFDsBeforeTheirBodies':True,'outerBootstrapHeldBeforeBootstrapExecution':True,'nativeFDsRetainedThroughActor':True,'sameActorLedgerOwnsAllFourNativeFDs':ledger is not None,'remainingOwnedFDs':None if ledger is None else len(ledger.owned_fds),'intentionalLastFixtureCloseUNKNOWN':None if ledger is None else ledger.unknown_close,'elapsedSeconds':time.monotonic()-began,'SourceEligibility':False,'candidateWrites':0,'protectedEffects':0}
    assert not(J/'native-bootstrap-closure2.json').exists()
    (J/'native-bootstrap-closure2.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({'nativeSourceCount':len(rows),'nativeOnceCloses':sum(x['closeAttempts']for x in rows),'nativeErrors':errors,'remainingOwnedFDs':receipt['remainingOwnedFDs'],'elapsedSeconds':receipt['elapsedSeconds']},indent=2))
    return receipt
