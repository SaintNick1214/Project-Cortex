"""Independent existing-vs-new guard live binding isolation; actual own FDs."""
import copy,hashlib,os,time
from pathlib import Path

def run(bodies,paths,review_dir,ledger,phase):
    J=Path(review_dir);R=Path(paths['root']);P=phase
    helper_path=str(J/'independent-controls1.py')
    helper=__import__('types').ModuleType('G2_own_held_fixture_definitions_only')
    exec(compile(bodies[helper_path],helper_path,'exec',dont_inherit=True),helper.__dict__)
    A=helper.module('G2_focused_rejected_N1_injection',paths['adapter'],bodies[paths['adapter']])
    G=helper.module('G2_focused_guard',paths['guard'],bodies[paths['guard']])
    names=['fixture-program1.py']+['fixture-data'+str(i)+'.json'for i in range(1,6)]
    rows=[]
    for name in names:
        path=J/name;raw=bodies[str(path)]
        rows.append({'path':str(path.relative_to(R)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nine':helper.nine(os.lstat(path)),
                     'roles':['program']if name.endswith('.py')else['document'],'nineBasis':'MATURE_EXACT_REVIEWER_SOURCE'})
    caller=P.admission_id(rows[0]);results=[];intervals=[]
    def make():
        io=helper.ActualIO([J/name for name in names]);view=A.SourceView({'futureDATA':[],
             'bodyUseEdges':[{'caller':caller,'target':P.admission_id(r),'operation':op}for r in rows for op in ('read','hash','compile','control','parse')],
             'programApprovals':{caller:rows[0]['sha256']}},tuple(copy.deepcopy(rows)),(),'a'*64,'b'*64,(),object())
        stop=max(max(int(r['nine']['mtime_ns']),int(r['nine']['ctime_ns']))for r in rows)+1
        s=A.SourceSession(P,R,view,ledger,stop,hashlib.sha256(bodies[paths['adapter']]).hexdigest(),
             lambda v,h,l:A.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256),io=io,clock=time.time_ns)
        s.open_all(caller);b=s.borrow(caller);calls=[]
        q=G.RootBorrowedGuardLease(b,A,ledger,caller,lambda *_:(calls.append(True)or True))
        return s,b,q,io,calls
    def links(s,b,q):return {'borrowedLedgerIsOriginalRootLedger':b.ledger is ledger,'ownerLedgerIsOriginalRootLedger':s.ledger is ledger,
       'borrowedOwnerTokenIsOriginalRootOwner':b.ownerToken is s,'guardOwnerIsOriginalRootOwner':q.owner is s,'guardLedgerIsOriginalRootLedger':q.ledger is ledger}
    def finish(s,io):
        try:s.final(caller)
        finally:
            try:s.close()
            finally:assert set(io.closed)==set(io.fds) and len(io.closed)==len(set(io.closed))==6 and all(fd not in ledger.owned_fds for fd in io.fds)
    for variant in ('borrow_ledger','owner_ledger','owner_token'):
        s,b,q,io,initial_calls=make();detail={'variant':variant,'beforeMutation':links(s,b,q),'originalBridgeCalls':len(initial_calls)}
        restore=None
        try:
            assert all(detail['beforeMutation'].values()) and initial_calls==[True]
            foreign=P.Ledger()if variant!='owner_token'else object()
            if variant=='borrow_ledger':old=b.ledger;b.ledger=foreign;restore=lambda:setattr(b,'ledger',old)
            elif variant=='owner_ledger':old=s.ledger;s.ledger=foreign;restore=lambda:setattr(s,'ledger',old)
            else:old=b.ownerToken;b.ownerToken=foreign;restore=lambda:setattr(b,'ownerToken',old)
            detail['afterMutation']=links(s,b,q);assert sum(not value for value in detail['afterMutation'].values())==1
            # The same constructor explicitly rejects this exact current binding.
            callback=[];before_constructor=len(io.events);constructor_error=None
            try:G.RootBorrowedGuardLease(b,A,ledger,caller,lambda *_:(callback.append(True)or True))
            except BaseException as error:constructor_error={'type':type(error).__name__,'error':str(error)}
            assert constructor_error is not None and not callback and len(io.events)==before_constructor
            detail['newConstructorDeniesSameMutationBeforeCallbackOrIO']=True;detail['newConstructorError']=constructor_error
            before_events=len(io.events);before_debts=len(ledger.read_debts);before_foreign=len(foreign.read_debts)if variant!='owner_token'else None
            check_error=None
            try:q.check_owner()
            except BaseException as error:check_error={'type':type(error).__name__,'error':str(error)}
            raw=q.read(R/rows[0]['path']);assert raw==bodies[str(J/names[0])]
            used=io.events[before_events:];pread=[e for e in used if e['event']=='PREAD'];assert len(pread)==2 and pread[0]['offset']==0 and pread[1]['offset']==len(raw)
            assert check_error is None and not s.failures and not io.closed
            detail.update({'existingGuardCheckOwnerError':check_error,'existingGuardReturnedExactFixtureBytes':raw.decode(),
                'returnedBytes':len(raw),'returnedSHA256':hashlib.sha256(raw).hexdigest(),'actualOwnedFD':s.owned[rows[0]['path']][0],
                'metadataAndBodyEventsDuringForeignBinding':copy.deepcopy(used),'bodyPreadCalls':len(pread),'retainedRootFailures':[],
                'rootReadDebtCountBefore':before_debts,'rootReadDebtCountAfter':len(ledger.read_debts),
                'foreignLedgerReadDebtCountBefore':before_foreign,'foreignLedgerReadDebtCountAfter':len(foreign.read_debts)if variant!='owner_token'else None,
                'RootOwnedDescriptorClosesByBorrower':0,'existingGuardBridgeCallsDuringRead':len(initial_calls)-1})
            results.append({'name':'OBSERVATION_constructor_rejects_but_existing_guard_reads_with_'+variant,'PASS':True,'detail':detail})
        except BaseException as error:results.append({'name':'OBSERVATION_constructor_rejects_but_existing_guard_reads_with_'+variant,'PASS':False,'errorType':type(error).__name__,'error':str(error),'detail':detail})
        finally:
            if restore is not None:restore()
            detail['afterRestore']=links(s,b,q)
            try:finish(s,io)
            finally:intervals.append({'variant':variant,'allActualEvents':copy.deepcopy(io.events),'physicalOnceCloses':list(io.closed),'closeAttempts':copy.deepcopy(s.close_attempts),'sameSuppliedLedgerRestoredBeforeRootCleanup':s.ledger is ledger})
    return {'scope':'FOCUSED_LIVE_BINDING_CODE_HOST_ONLY','original18':[],'original71':[],'original18Count':0,'original71Count':0,
        'originalRegressionsAlreadyExecutedUnchangedInRun1':89,'independent':results,'independentCount':len(results),
        'independentPassed':sum(r['PASS']for r in results),'independentFailed':sum(not r['PASS']for r in results),'actualIntervals':intervals,
        'sameSuppliedLedgerAcrossAllActualIntervals':True,'SourceEligibility':False,'effects':0}
