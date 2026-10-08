"""Independent G2 guard controls on actual reviewer-owned Source FDs.

The one supplied ledger carries the held Source graph and all real fixture uses.
Original author regressions use their unchanged virtual unit fixtures separately.
No runtime authority or Source adoption follows from either kind of control.
"""
import ast, copy, hashlib, json, os, stat, time, types, sys
from pathlib import Path

FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(s):
    return dict(zip(FIELDS,map(str,(s.st_dev,s.st_ino,s.st_mode,s.st_uid,s.st_gid,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns))))
def module(name,path,raw):
    m=types.ModuleType(name);m.__file__=path;sys.modules[name]=m
    exec(compile(raw,path,'exec',dont_inherit=True),m.__dict__);return m

class ActualIO:
    O_RDONLY=os.O_RDONLY;O_NOFOLLOW=os.O_NOFOLLOW
    def __init__(self,paths):
        self.paths={str(p)for p in paths};self.allowed_dirs=set();self.fds={};self.closed=[];self.events=[]
        for p in paths:self.allowed_dirs.update(str(x)for x in Path(p).parents)
    def lstat(self,path):
        path=str(path);assert path in self.paths or path in self.allowed_dirs,'outside_reviewer_metadata'
        self.events.append({'event':'LSTAT','path':path});return os.lstat(path)
    def open(self,path,flags):
        path=str(path);assert path in self.paths and flags==(os.O_RDONLY|os.O_NOFOLLOW)
        fd=os.open(path,flags);assert fd not in self.fds;self.fds[fd]=path
        self.events.append({'event':'OPEN','fd':fd,'path':path});return fd
    def fstat(self,fd):
        assert fd in self.fds and fd not in self.closed
        self.events.append({'event':'FSTAT','fd':fd});return os.fstat(fd)
    def pread(self,fd,size,offset):
        assert fd in self.fds and fd not in self.closed
        self.events.append({'event':'PREAD','fd':fd,'size':size,'offset':offset});return os.pread(fd,size,offset)
    def close(self,fd):
        assert fd in self.fds and fd not in self.closed,'retry_or_foreign_close'
        self.events.append({'event':'CLOSE','fd':fd});os.close(fd);self.closed.append(fd)

def run(bodies,paths,review_dir,ledger,phase):
    J=Path(review_dir);R=Path(paths['root']);P=phase
    A=module('independent_G2_rejected_N1_injection',paths['adapter'],bodies[paths['adapter']])
    G=module('independent_G2_guard',paths['guard'],bodies[paths['guard']])
    C=module('independent_G2_original18',paths['guardControls'],bodies[paths['guardControls']])
    N=module('independent_G2_original71',paths['adapterControls'],bodies[paths['adapterControls']])
    assert G.R==R
    original18=C.run(A,P,G,bodies[paths['oldGuard']],bodies[paths['guard']])
    original71=N.run(A,P)
    if isinstance(original71,dict): original71=original71.get('conditions',original71.get('results'))
    assert isinstance(original18,list) and len(original18)==18
    assert isinstance(original71,list) and len(original71)==71
    rows=[];results=[];intervals=[];current_case=[''];fixture_names=['fixture-program1.py']+['fixture-data'+str(i)+'.json'for i in range(1,6)]
    for name in fixture_names:
        path=J/name;raw=bodies[str(path)]
        rows.append({'path':str(path.relative_to(R)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                     'nine':nine(os.lstat(path)),'roles':['program']if name.endswith('.py')else['document'],
                     'nineBasis':'MATURE_EXACT_REVIEWER_SOURCE'})
    caller=P.admission_id(rows[0]);ledgers_seen=[]
    def deny(fn):
        try:fn()
        except BaseException as e:return e
        raise AssertionError('REQUIRED_DENIAL_ABSENT')
    def case(name,fn):
        current_case[0]=name
        try:result=fn();results.append({'name':name,'PASS':True,'detail':result})
        except BaseException as e:results.append({'name':name,'PASS':False,'errorType':type(e).__name__,'error':str(e)})
    def make():
        io=ActualIO([J/name for name in fixture_names]);recipe={'futureDATA':[],
             'bodyUseEdges':[{'caller':caller,'target':P.admission_id(r),'operation':op}for r in rows for op in ('read','hash','compile','control','parse')],
             'programApprovals':{caller:rows[0]['sha256']}}
        view=A.SourceView(recipe,tuple(copy.deepcopy(rows)),(),'a'*64,'b'*64,(),object())
        stop=max(max(int(r['nine']['mtime_ns']),int(r['nine']['ctime_ns']))for r in rows)+1
        s=A.SourceSession(P,R,view,ledger,stop,hashlib.sha256(bodies[paths['adapter']]).hexdigest(),
            lambda v,h,l:A.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256),io=io,clock=time.time_ns)
        s.open_all(caller);b=s.borrow(caller);q=G.RootBorrowedGuardLease(b,A,ledger,caller,lambda *_:True)
        ledgers_seen.append(id(s.ledger));return s,b,q,io
    def finish(s,io):
        if not s.closed:
            try:s.final(caller)
            except BaseException:pass
            try:s.close()
            except A.Failures:assert s.failures
        assert set(io.closed)==set(io.fds) and len(io.closed)==len(set(io.closed))==6
        assert all(fd not in ledger.owned_fds for fd in io.fds)
        assert all(x.get('attempt')==1 for x in s.close_attempts)
    def exercise(fn):
        s,b,q,io=make()
        caught=None
        try:return fn(s,b,q,io)
        except BaseException as error:caught={'type':type(error).__name__,'error':str(error)};raise
        finally:
            snapshot={'case':current_case[0],'error':caught,'beforeRootCleanupEvents':copy.deepcopy(io.events),
                      'retainedFailuresBeforeRootCleanup':[{'stage':stage,'type':type(error).__name__,'error':str(error)}for stage,error in s.failures],
                      'sameOriginalSuppliedLedger':s.ledger is ledger,'physicalFDs':dict(io.fds)}
            try:finish(s,io)
            finally:snapshot.update({'allIOEventsAfterRootCleanup':copy.deepcopy(io.events),'physicalOnceCloses':list(io.closed),'closeAttempts':copy.deepcopy(s.close_attempts)});intervals.append(snapshot)
    def later_all(s,q,io):
        before=len(io.events)
        for row in rows:deny(lambda r=row:q.read(R/r['path']))
        assert len(io.events)==before,'failed_interval_allowed_later_metadata_or_body_IO'
        assert not io.closed and len(s.owned)==6 and s.failures
        return {'wholeLaterReadsDenied':6,'laterMetadataAndBodyIO':0,'borrowerClosedFDs':0}
    def positive(s,b,q,io):
        before=ledger.byte_count
        for row in rows:
            got=q.read(R/row['path'],row['nine']);assert got==bodies[str(R/row['path'])]
            projection=q.acquire(R/row['path']);assert 'fd'not in projection and 'fd'not in projection['member']
        assert next(i for i,e in enumerate(io.events)if e['event']=='PREAD')>max(i for i,e in enumerate(io.events)if e['event']=='OPEN')
        q.release();assert not io.closed and len(s.owned)==6 and ledger.byte_count==before
        denied=deny(lambda:q.read(R/rows[0]['path']));assert not io.closed
        return {'actualSourceFDs':6,'allSixOpensBeforeFirstBody':True,'exactBodies':6,'fdProjection':False,'borrowReleasePhysicalCloses':0,'sourceBytesNotRefunded':True,'releaseDenial':type(denied).__name__}
    case('actual_positive_six_held_bodies_borrow_release_no_close_or_refund',lambda:exercise(positive))
    def conserved():
        old=ast.parse(bodies[paths['priorGuard']]);new=ast.parse(bodies[paths['guard']])
        oldcls=next(n for n in old.body if isinstance(n,ast.ClassDef)and n.name=='RootBorrowedGuardLease')
        newcls=next(n for n in new.body if isinstance(n,ast.ClassDef)and n.name=='RootBorrowedGuardLease')
        for tree in (old,new):
            cls=next(n for n in tree.body if isinstance(n,ast.ClassDef)and n.name=='RootBorrowedGuardLease')
            cls.body=[n for n in cls.body if not(isinstance(n,ast.FunctionDef)and n.name in ('acquire','read'))]
        assert ast.dump(old,include_attributes=False)==ast.dump(new,include_attributes=False)
        old_original=ast.parse(bodies[paths['priorGuard']]);new_original=ast.parse(bodies[paths['guard']])
        olda=[ast.dump(x,include_attributes=False)for x in ast.walk(old_original)if isinstance(x,ast.Assert)]
        newa=[ast.dump(x,include_attributes=False)for x in ast.walk(new_original)if isinstance(x,ast.Assert)]
        assert all(newa.count(a)>=olda.count(a)for a in set(olda))
        return {'onlyAcquireReadChanged':True,'allOriginalAssertMultiplicityPreserved':True,'originalAssertCount':len(olda)}
    case('G1_to_G2_all_unrelated_AST_and_original_assertions_preserved',conserved)
    for position in (0,2,5):
        for boundary in ('acquire','read'):
            for error_type in (OSError,SystemExit):
                def metadata(s,b,q,io,i=position,bound=boundary,etype=error_type):
                    target=rows[i]['path'];fd=s.owned[target][0];original=io.fstat;failure=etype('INDEPENDENT_ACTUAL_FD_METADATA_FAILURE');fired=[]
                    def fault(candidate):
                        if candidate==fd and not fired:fired.append(candidate);raise failure
                        return original(candidate)
                    io.fstat=fault
                    try:got=deny(lambda:getattr(q,bound)(R/target));assert got is failure
                    finally:io.fstat=original
                    assert any(error is failure for stage,error in s.failures)
                    detail=later_all(s,q,io);detail.update({'position':i,'boundary':bound,'originalExceptionIdentityRetained':True,'errorType':etype.__name__,'actualFD':fd});return detail
                case('actual_metadata_'+str(position)+'_'+boundary+'_'+error_type.__name__+'_sticky',lambda fn=metadata:exercise(fn))
    for position in (0,2,5):
        def changed_nine(s,b,q,io,i=position):
            target=rows[i]['path'];fd=s.owned[target][0];original=io.fstat;fired=[]
            def fault(candidate):
                observed=original(candidate)
                if candidate==fd and not fired:
                    fired.append(candidate)
                    class Changed:pass
                    value=Changed()
                    for name in ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'):setattr(value,'st_'+name,getattr(observed,'st_'+name))
                    value.st_ctime_ns+=1;return value
                return observed
            io.fstat=fault
            try:got=deny(lambda:q.read(R/target))
            finally:io.fstat=original
            detail=later_all(s,q,io);detail.update({'position':i,'firstError':type(got).__name__,'originalPhysicalFileUnchanged':True});return detail
        case('actual_first_middle_last_stale_metadata_nine_'+str(position),lambda fn=changed_nine:exercise(fn))
        for error_type in (OSError,SystemExit):
            def body_error(s,b,q,io,i=position,etype=error_type):
                target=rows[i]['path'];fd=s.owned[target][0];original=io.pread;failure=etype('INDEPENDENT_ACTUAL_FD_BODY_FAILURE');fired=[]
                def fault(candidate,size,offset):
                    if candidate==fd and not fired:fired.append(candidate);raise failure
                    return original(candidate,size,offset)
                io.pread=fault
                try:got=deny(lambda:q.read(R/target));assert got is failure
                finally:io.pread=original
                detail=later_all(s,q,io);detail.update({'originalExceptionIdentityRetained':True,'position':i,'errorType':etype.__name__});return detail
            case('actual_body_'+str(position)+'_'+error_type.__name__+'_sticky',lambda fn=body_error:exercise(fn))
        def bad_hash(s,b,q,io,i=position):
            target=rows[i]['path'];fd=s.owned[target][0];original=io.pread
            io.pread=lambda candidate,size,offset:b'!'if candidate==fd and offset==0 else b''if candidate==fd else original(candidate,size,offset)
            try:got=deny(lambda:q.read(R/target))
            finally:io.pread=original
            detail=later_all(s,q,io);detail.update({'position':i,'firstError':type(got).__name__});return detail
        case('actual_first_middle_last_body_hash_failure_'+str(position),lambda fn=bad_hash:exercise(fn))
    for name,cap in G.RELEASE_DATA_NAMES.items():
        def local_cap(s,b,q,io,target=name,limit=cap):
            payload=b'X'*(limit+1);member={'path':'MOCK_ONLY_LOCAL_DATA_CAP'}
            saved=(q.acquire,b.read,q.check_owner)
            q.acquire=lambda *_args,**_kw:{'member':member,'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}
            b.read=lambda *_args,**_kw:payload;q.check_owner=lambda:None
            try:first=deny(lambda:q.read(G.P/target));assert isinstance(first,AssertionError)
            finally:q.acquire,b.read,q.check_owner=saved
            detail=later_all(s,q,io);detail.update({'localDATAName':target,'cap':limit,'attemptedBytes':len(payload),'allThreeStubsRestoredBeforeWholeLaterReads':True,'localOversizePayloadVirtualOnly':True});return detail
        case('local_DATA_cap_sticky_'+name,lambda fn=local_cap:exercise(fn))
    for error_type in (OSError,SystemExit):
        def post_body(s,b,q,io,etype=error_type):
            original=q.check_owner;calls=[];failure=etype('INDEPENDENT_POST_BODY_CHECK_FAILURE')
            def check():
                calls.append(1)
                if len(calls)==2:raise failure
                return original()
            q.check_owner=check
            try:got=deny(lambda:q.read(R/rows[0]['path']));assert got is failure and len(calls)==2
            finally:q.check_owner=original
            detail=later_all(s,q,io);detail.update({'postBodyCheckOriginalExceptionIdentityRetained':True,'errorType':etype.__name__});return detail
        case('post_body_check_'+error_type.__name__+'_sticky',lambda fn=post_body:exercise(fn))
    for variant in ('map','tuple','row','fd_owner','borrow_ledger','owner_ledger','guard_ledger','owner_token'):
        def mutation(s,b,q,io,v=variant):
            restore=lambda:None
            if v=='map':saved=b.by_path;b.by_path=dict(b.by_path);restore=lambda:setattr(b,'by_path',saved)
            elif v=='tuple':saved=b.rows;b.rows=tuple(copy.deepcopy(r)for r in b.rows);restore=lambda:setattr(b,'rows',saved)
            elif v=='row':saved=b.rows[0]['nine']['ino'];b.rows[0]['nine']['ino']='999999';restore=lambda:b.rows[0]['nine'].__setitem__('ino',saved)
            elif v=='fd_owner':fd=s.owned[rows[0]['path']][0];saved=ledger.owned_fds[fd];ledger.owned_fds[fd]=object();restore=lambda:ledger.owned_fds.__setitem__(fd,saved)
            elif v=='borrow_ledger':saved=b.ledger;b.ledger=P.Ledger();restore=lambda:setattr(b,'ledger',saved)
            elif v=='owner_ledger':saved=s.ledger;s.ledger=P.Ledger();restore=lambda:setattr(s,'ledger',saved)
            elif v=='guard_ledger':saved=q.ledger;q.ledger=P.Ledger();restore=lambda:setattr(q,'ledger',saved)
            else:saved=b.ownerToken;b.ownerToken=object();restore=lambda:setattr(b,'ownerToken',saved)
            prior=len(io.events)
            try:got=deny(lambda:q.read(R/rows[0]['path']));assert len(io.events)==prior,'mutated_authority_reached_metadata_or_body'
            finally:restore()
            detail=later_all(s,q,io);detail.update({'mutatedField':v,'firstError':type(got).__name__,'restoredBeforeWholeLaterReads':True});return detail
        case('current_owner_ledger_row_FD_mutation_'+variant,lambda fn=mutation:exercise(fn))
    # Last actual interval: cap debt and a reported close fault remain on this
    # same shared ledger. No new actual session is created after sticky UNKNOWN.
    def cap_and_close(s,b,q,io):
        for i,size in enumerate((16777216,16777216,16777216,14680064)):
            r=copy.deepcopy(rows[0]);r['path']='MOCK_TYPED_LEDGER_CAP_DEBT_'+str(i);r['bytes']=size;r['sha256']='0'*64;r['nine']['size']=str(size);r['nine']['ino']=str(1000000+i)
            ledger.admit(r,debt=True,reason='INDEPENDENT_TYPED_CAP_DEBT_NO_PHYSICAL_BODY')
        before=len(io.events);error=deny(lambda:q.read(R/rows[0]['path']));assert len(io.events)==before and s.failures
        assert ledger.byte_count+2097152>67108864
        original=io.close;target=s.owned[rows[2]['path']][0];attempts=[]
        def closing(fd):
            attempts.append(fd);original(fd)
            if fd==target:raise OSError('INDEPENDENT_REPORTED_CLOSE_FAILURE_AFTER_PHYSICAL_CLOSE')
        io.close=closing
        close_error=deny(s.close)
        assert len(attempts)==len(set(attempts))==6 and set(attempts)==set(io.fds)
        assert ledger.unknown_close and s.closed
        assert all(fd not in ledger.owned_fds for fd in io.fds)
        deny(q.check_owner)
        return {'capDenial':type(error).__name__,'bodyAndMetadataIOBeforeDenial':0,'sameLedgerSourceBytes':ledger.byte_count,'oneDATAReserve':2097152,'capDebtRetained':True,'physicalAllOwnedOnceClose':attempts,'unknownCloseSticky':True,'closeError':type(close_error).__name__,'newActualSessionsAfterUnknown':0}
    case('current_shared_Source_cap_and_last_all_owned_close_UNKNOWN',lambda:exercise(cap_and_close))
    assert set(ledgers_seen)=={id(ledger)}
    return {'scope':'INDEPENDENT_G2_STICKY_CODE_HOST_ONLY','original18':original18,'original71':original71,'independent':results,'actualIntervals':intervals,
            'original18Count':len(original18),'original71Count':len(original71),'independentCount':len(results),
            'independentPassed':sum(bool(r['PASS'])for r in results),'independentFailed':sum(not r['PASS']for r in results),
            'sameSuppliedLedgerForAllActualIntervals':True,'retainedLedgerPaths':len(ledger.paths),'retainedLedgerBytes':ledger.byte_count,
            'oneDATAReserveBytes':2097152,'underlyingN1R6':'REJECTED_INJECTION_ONLY','SourceEligibility':False,'effects':0}
