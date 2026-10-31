"""Independent G3 guard controls on actual reviewer-owned Source FDs.

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
    A=module('independent_G3_rejected_N1_injection',paths['adapter'],bodies[paths['adapter']])
    G=module('independent_G3_guard',paths['guard'],bodies[paths['guard']])
    C=module('independent_G3_original18',paths['guardControls'],bodies[paths['guardControls']])
    N=module('independent_G3_original71',paths['adapterControls'],bodies[paths['adapterControls']])
    assert G.R==R
    original18=C.run(A,P,G,bodies[paths['oldGuard']],bodies[paths['guard']])
    original71=N.run(A,P)
    if isinstance(original71,dict): original71=original71.get('conditions',original71.get('results'))
    assert isinstance(original18,list) and len(original18)==18
    assert isinstance(original71,list) and len(original71)==71
    S=module('independent_G3_original_sticky14',paths['stickyControls'],bodies[paths['stickyControls']])
    X=module('independent_G3_author_live19',paths['liveControls'],bodies[paths['liveControls']])
    original14=S.run(A,P,G,bodies[paths['guardControls']])
    author19=X.run(A,P,G,bodies[paths['guardControls']])
    assert len(original14)==14 and len(author19)==19
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
            cls.body=[n for n in cls.body if not(isinstance(n,ast.FunctionDef)and n.name in ('__init__','check_owner','acquire','read'))]
        assert ast.dump(old,include_attributes=False)==ast.dump(new,include_attributes=False)
        old_original=ast.parse(bodies[paths['priorGuard']]);new_original=ast.parse(bodies[paths['guard']])
        olda=[ast.dump(x,include_attributes=False)for x in ast.walk(old_original)if isinstance(x,ast.Assert)]
        newa=[ast.dump(x,include_attributes=False)for x in ast.walk(new_original)if isinstance(x,ast.Assert)]
        assert all(newa.count(a)>=olda.count(a)for a in set(olda))
        return {'onlyDeclaredFourMethodsChanged':True,'allOriginalAssertMultiplicityPreserved':True,'originalAssertCount':len(olda)}
    case('G2_to_G3_all_unrelated_AST_and_original_assertions_preserved',conserved)
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
    for variant in ('map','tuple','row','fd_owner','borrow_ledger','owner_ledger','guard_ledger','owner_token','guard_borrowed','guard_owner','guard_adapter','borrowed_caller'):
        def mutation(s,b,q,io,v=variant):
            restore=lambda:None
            if v=='map':saved=b.by_path;b.by_path=dict(b.by_path);restore=lambda:setattr(b,'by_path',saved)
            elif v=='tuple':saved=b.rows;b.rows=tuple(copy.deepcopy(r)for r in b.rows);restore=lambda:setattr(b,'rows',saved)
            elif v=='row':saved=b.rows[0]['nine']['ino'];b.rows[0]['nine']['ino']='999999';restore=lambda:b.rows[0]['nine'].__setitem__('ino',saved)
            elif v=='fd_owner':fd=s.owned[rows[0]['path']][0];saved=ledger.owned_fds[fd];ledger.owned_fds[fd]=object();restore=lambda:ledger.owned_fds.__setitem__(fd,saved)
            elif v=='borrow_ledger':saved=b.ledger;b.ledger=P.Ledger();restore=lambda:setattr(b,'ledger',saved)
            elif v=='owner_ledger':saved=s.ledger;s.ledger=P.Ledger();restore=lambda:setattr(s,'ledger',saved)
            elif v=='guard_ledger':saved=q.ledger;q.ledger=P.Ledger();restore=lambda:setattr(q,'ledger',saved)
            elif v=='owner_token':saved=b.ownerToken;b.ownerToken=object();restore=lambda:setattr(b,'ownerToken',saved)
            elif v=='guard_borrowed':saved=q.borrowed;q.borrowed=object();restore=lambda:setattr(q,'borrowed',saved)
            elif v=='guard_owner':saved=q.owner;q.owner=object();restore=lambda:setattr(q,'owner',saved)
            elif v=='guard_adapter':saved=q.adapter_module;q.adapter_module=object();restore=lambda:setattr(q,'adapter_module',saved)
            else:saved=b._caller;b._caller='UNAUTHORIZED_REVIEWER_CALLER';restore=lambda:setattr(b,'_caller',saved)
            prior=len(io.events)
            try:got=deny(lambda:q.read(R/rows[0]['path']));assert len(io.events)==prior,'mutated_authority_reached_metadata_or_body'
            finally:restore()
            detail=later_all(s,q,io);detail.update({'mutatedField':v,'firstError':type(got).__name__,'restoredBeforeWholeLaterReads':True});return detail
        case('current_owner_ledger_row_FD_mutation_'+variant,lambda fn=mutation:exercise(fn))
    def safe_copy(s,b,q,io):
        snapshot=copy.deepcopy(b.rows)
        projection=copy.deepcopy(q.acquire(R/rows[0]['path']))
        assert 'fd' not in projection and 'fd' not in projection['member']
        projection['member']['nine']['ctime_ns']='UNTRUSTED_COPY_ONLY'
        projection['originalNine']['ino']='UNTRUSTED_COPY_ONLY'
        assert b.rows==snapshot
        raw=q.read(R/rows[0]['path']);assert raw==bodies[str(J/fixture_names[0])]
        assert not s.failures and not io.closed
        return {'safeDetachedCopyMutationAllowed':True,'actualReturnedBytes':len(raw),'returnedSHA256':hashlib.sha256(raw).hexdigest(),'noRootMutation':True}
    case('safe_explicit_detached_projection_copy_is_positive',lambda:exercise(safe_copy))
    for key in ('BorrowedSourceLease','SourceSession'):
        def changed_module(s,b,q,io,which=key):
            old=getattr(A,which);setattr(A,which,type('ForeignNativeAuthority',(),{}));before=len(io.events)
            try:error=deny(lambda:q.read(R/rows[0]['path']));assert len(io.events)==before
            finally:setattr(A,which,old)
            detail=later_all(s,q,io);detail.update({'changedNativeClass':which,'firstError':type(error).__name__,'restoredBeforeLaterReads':True});return detail
        case('current_adapter_native_class_'+key+'_sticky_before_IO',lambda fn=changed_module:exercise(fn))
    for variant in ('borrow_ledger','owner_ledger','owner_token'):
        def callback_boundary(s,b,q,io,v=variant):
            target,key={'borrow_ledger':(b,'ledger'),'owner_ledger':(s,'ledger'),'owner_token':(b,'ownerToken')}[v]
            saved=getattr(target,key);foreign=P.Ledger()if v!='owner_token'else object();calls=[];before=len(io.events);foreign_debts=len(foreign.read_debts)if v!='owner_token'else None
            def callback(*args):calls.append(tuple(id(x)for x in args));setattr(target,key,foreign);return True
            q2=None;constructor_error=None
            try:
                try:q2=G.RootBorrowedGuardLease(b,A,ledger,caller,callback)
                except BaseException as error:constructor_error=error
                assert len(calls)==1 and len(io.events)==before,'constructor_callback_reached_IO'
                if q2 is not None:
                    failure=deny(lambda:q2.read(R/rows[0]['path']));assert len(io.events)==before and s.failures
                else:
                    failure=constructor_error;assert failure is not None
                assert (len(foreign.read_debts)if v!='owner_token'else None)==foreign_debts
            finally:setattr(target,key,saved)
            if q2 is not None:
                detail=later_all(s,q2,io);denial_stage='current_use_after_callback_returned'
            else:
                # Pure early validation denial before owned IO is not asserted
                # to poison the previously healthy Root Source interval.
                raw=q.read(R/rows[0]['path']);assert raw==bodies[str(J/fixture_names[0])]
                detail={'priorHealthyGuardStillUsableAfterSafeEarlyValidation':True};denial_stage='constructor_after_callback'
            detail.update({'changedLink':v,'callbackCount':1,'denialStage':denial_stage,'foreignDebtDelta':0,'firstError':type(failure).__name__})
            return detail
        case('external_constructor_callback_link_'+variant+'_never_allows_source_body',lambda fn=callback_boundary:exercise(fn))
    for variant in ('borrow_ledger','owner_ledger','owner_token','guard_owner','borrowed_caller'):
        def post_body_link(s,b,q,io,v=variant):
            target,key={'borrow_ledger':(b,'ledger'),'owner_ledger':(s,'ledger'),'owner_token':(b,'ownerToken'),'guard_owner':(q,'owner'),'borrowed_caller':(b,'_caller')}[v]
            saved=getattr(target,key);replacement='UNAUTHORIZED_AFTER_BODY_CALLER'if v=='borrowed_caller'else P.Ledger()if v in ('borrow_ledger','owner_ledger')else object()
            original=io.pread;fired=[];before=len(io.events)
            def pread(fd,size,offset):
                raw=original(fd,size,offset)
                if raw and not fired:fired.append(fd);setattr(target,key,replacement)
                return raw
            io.pread=pread
            try:failure=deny(lambda:q.read(R/rows[0]['path']));assert fired and s.failures
            finally:io.pread=original;setattr(target,key,saved)
            detail=later_all(s,q,io);detail.update({'changedLink':v,'actualBodyPreadBeforePostcheck':len([e for e in io.events[before:]if e['event']=='PREAD']),'originalRootRetainedFailure':True,'bodyNotReturned':True,'firstError':type(failure).__name__})
            return detail
        case('actual_body_callback_current_link_'+variant+'_postcheck_sticky',lambda fn=post_body_link:exercise(fn))
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
    return {'scope':'INDEPENDENT_G3_CURRENT_BINDING_CODE_HOST_ONLY','original18':original18,'original71':original71,'original14':original14,'author19':author19,'independent':results,'actualIntervals':intervals,
            'original18Count':len(original18),'original71Count':len(original71),'original14Count':len(original14),'author19Count':len(author19),'independentCount':len(results),
            'independentPassed':sum(bool(r['PASS'])for r in results),'independentFailed':sum(not r['PASS']for r in results),
            'sameSuppliedLedgerForAllActualIntervals':True,'retainedLedgerPaths':len(ledger.paths),'retainedLedgerBytes':ledger.byte_count,
            'oneDATAReserveBytes':2097152,'underlyingN1R8':'REJECTED_INJECTION_ONLY','SourceEligibility':False,'effects':0}
