"""Fresh independent Source facade controls; all authority is SOURCE/MOCK.

Actual filesystem effects are confined to the two stopped reviewer fixtures.
The real held A5 Ledger implementation is injected to test facade behavior,
without adopting A5 or claiming its full contract has independent acceptance.
"""
import copy,hashlib,os,stat,sys,time,types
from pathlib import Path

def module(name,path,raw):
    m=types.ModuleType(name);m.__file__=path;sys.modules[name]=m
    try:exec(compile(raw,path,'exec',dont_inherit=True),m.__dict__)
    except BaseException:
        sys.modules.pop(name,None);raise
    return m

def run(bodies,paths,review_dir):
    J=Path(review_dir)
    A=module('independent_facade_adapters6',paths['adapter'],bodies[paths['adapter']])
    P=module('independent_facade_phase5_injection6',paths['api'],bodies[paths['api']])
    O=module('independent_facade_fd_observer6',str(J/'reviewer-fd-observer2.py'),bodies[str(J/'reviewer-fd-observer2.py')])
    names=['reviewer-fixture-module1.py','reviewer-fixture-data1.json']
    rows=[]
    for name in names:
        path=J/name;raw=bodies[str(path)]
        rows.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
          'nine':O.nine(os.lstat(path)),'roles':['program'] if name.endswith('.py') else ['document'],
          'nineBasis':'DECLARED_ORIGINAL'})
    caller=P.admission_id(rows[0]);outcomes=[];details={}
    adapter_digest=hashlib.sha256(bodies[paths['adapter']]).hexdigest()
    def same(a,b):
        if type(a) is not type(b) or a!=b:raise AssertionError((a,b))
    def deny(fn):
        try:fn()
        except BaseException as e:
            if isinstance(e,AssertionError):raise
            return e
        raise AssertionError('EXPECTED_DENIAL_NOT_OBSERVED')
    def case(name,fn):
        try:details[name]=fn();outcomes.append({'name':name,'status':'PASS'})
        except BaseException as e:outcomes.append({'name':name,'status':'FAIL','type':type(e).__name__,'error':str(e)})
    def view_for(items,edges=None):
        if edges is None:edges=[{'caller':caller,'target':P.admission_id(r),'operation':op} for r in items for op in ('read','hash','parse','control','compile','import')]
        recipe={'futureDATA':[],'bodyUseEdges':edges,'programApprovals':{P.admission_id(r):r['sha256'] for r in items if 'program' in r['roles']}}
        return A.SourceView(recipe,tuple(copy.deepcopy(items)),(), 'a'*64,'b'*64,(),object())
    def permit(v,h,l):return A.RuntimePermit(object(),v.view_sha256,h,v.phase_sha256)
    def make(ledger=None,io=None,view=None,verifier=permit,stop=None):
        ledger=P.Ledger() if ledger is None else ledger
        io=O.Observer([J/n for n in names]) if io is None else io
        v=view_for(rows) if view is None else view
        stopped=max(max(int(r['nine']['mtime_ns']),int(r['nine']['ctime_ns'])) for r in rows)+1 if stop is None else stop
        return A.SourceSession(P,J,v,ledger,stopped,adapter_digest,verifier,io=io,clock=time.time_ns),io,ledger
    def snapshot(s,io,l):
        return {'events':io.events,'closeAttempts':s.close_attempts,'remainingObservedFDs':list(io.fds),
          'ledgerBytes':l.byte_count,'ledgerReadDebts':sorted(l.read_debts),'ledgerOwnedFDs':len(l.owned_fds),
          'unknownClose':l.unknown_close,'sessionFailures':[{'stage':k,'type':type(e).__name__,'error':str(e)} for k,e in s.failures]}
    def finish(s,io):
        try:
            if not s.closed:s.close()
        except A.Failures:pass
        leaked=io.emergency_close_owned();same(leaked,[])
    def actual_positive():
        s,io,l=make();values={}
        def action(current):
            same(current is s,True);same(current.ledger is l,True)
            borrow=current.borrow(caller);same(borrow.ledger is l,True);same(borrow.ownerToken is s,True)
            same(set(borrow.lookup(names[0])),{'path','bytes','sha256','nine','roles','nineBasis'})
            same(borrow.read(borrow.lookup(names[0])),bodies[str(J/names[0])])
            compiled=A.root_compile(current,caller,names[0]);same(compiled.co_filename,names[0])
            borrow.release();same(len(io.fds),2);same(l.owned_fds.keys()==io.fds.keys(),True)
            deny(lambda:borrow.read(borrow.rows[0]));values['collector']=A.collector_manifest(current,caller)
            return 'CONTROLLED_SOURCE_RESULT'
        same(s.run(caller,action),'CONTROLLED_SOURCE_RESULT');O.assert_group_open_before_body(io.events,[J/n for n in names]);O.assert_once_closes(io.events,[J/n for n in names]);io.no_leaks();same(l.owned_fds,{})
        same(l.byte_count,61);same(len(l.read_debts),2);same(s.final_checked,True)
        return snapshot(s,io,l)|{'collector':values['collector'],'compileExecuted':False,'protectedEffects':False}
    case('actual_two_FD_collector_compile_borrow_release_final_owner_once_close',actual_positive)
    for mode in ('dict','authority-none','view','adapter','phase'):
        def bad_runtime(mode=mode):
            io=O.Observer([J/n for n in names]);calls=[]
            def verifier(v,h,l):
                calls.append('externalVerifier')
                if mode=='dict':return {'authority':object(),'view_sha256':v.view_sha256,'adapter_sha256':h,'phase_sha256':v.phase_sha256}
                return A.RuntimePermit(None if mode=='authority-none' else object(),'0'*64 if mode=='view' else v.view_sha256,'0'*64 if mode=='adapter' else h,'0'*64 if mode=='phase' else v.phase_sha256)
            error=deny(lambda:make(io=io,verifier=verifier));same(io.events,[]);same(io.fds,{})
            return {'denial':str(error),'IOEvents':io.events,'callbacks':calls,'payloadCallbacks':0}
        case('forged_or_stale_runtime_permit_'+mode+'_before_IO',bad_runtime)
    def absent_verifier():
        io=O.Observer([J/n for n in names]);error=deny(lambda:make(io=io,verifier=None));same(io.events,[]);return {'denial':str(error),'IOEvents':[]}
    case('missing_runtime_verifier_before_IO',absent_verifier)
    def unknown_before_verifier():
        l=P.Ledger();l.unknown_close=True;io=O.Observer([J/n for n in names]);calls=[]
        def verifier(*a):calls.append(1);raise AssertionError('UNKNOWN_REACHED_VERIFIER')
        error=deny(lambda:make(l,io,verifier=verifier));same(calls,[]);same(io.events,[]);return {'denial':str(error),'callbacks':calls,'IOEvents':[]}
    case('unknown_close_denied_before_verifier_and_IO',unknown_before_verifier)
    def hidden_edge():
        v=view_for(rows,edges=[]);s,io,l=make(view=v);error=deny(lambda:s.run(caller,lambda _:(_ for _ in ()).throw(AssertionError('HIDDEN_EDGE_REACHED_ACTION'))));same(io.events,[]);same(l.byte_count,61)
        return snapshot(s,io,l)|{'denial':str(error),'payloadCallbacks':0}
    case('hidden_read_edge_denies_before_any_IO_and_action',hidden_edge)
    def mutation():
        s,io,l=make();s.rows[names[0]]['sha256']='0'*64;error=deny(lambda:s.run(caller,lambda _:(_ for _ in ()).throw(AssertionError('MUTATION_REACHED_ACTION'))));same(io.events,[]);same(l.byte_count,61)
        return snapshot(s,io,l)|{'denial':str(error),'payloadCallbacks':0}
    case('sealed_row_mutation_denies_before_IO_and_action',mutation)
    def combined_actual_failures():
        io=O.Observer([J/n for n in names],close_failure_numbers=(1,2));s,io,l=make(io=io)
        def action(_):raise SystemExit(0)
        error=deny(lambda:s.run(caller,action),A.Failures) if False else deny(lambda:s.run(caller,action))
        same(sum(stage.startswith('owned_close:') for stage,e in error.failures),2)
        same(any(isinstance(e,SystemExit) and e.code==0 for stage,e in error.failures),True)
        O.assert_once_closes(io.events,[J/n for n in names]);io.no_leaks();same(l.owned_fds,{});same(l.unknown_close,True);same(l.byte_count,61)
        return snapshot(s,io,l)|{'retainedBaseException':True,'actualFDsClosedEvenThoughCloseOutcomeFailed':True}
    case('actual_SystemExit0_plus_two_virtual_close_failures_all_owned_once',combined_actual_failures)
    def budget_initial():
        l=P.Ledger()
        for i in range(4):l.admit(fake_row('prior-'+str(i),16*1024*1024-1),debt=True)
        io=O.Observer([J/n for n in names]);error=deny(lambda:make(l,io));same(io.events,[])
        return {'denial':str(error),'retainedBytes':l.byte_count,'IOEvents':[],'noRefund':True}
    def fake_row(path,size):
        pin=dict(zip(P.FIELDS,map(str,(1,90000+len(path),33152,501,20,1,size,1,1))))
        return {'path':path,'bytes':size,'sha256':'0'*64,'nine':pin,'roles':['document'],'nineBasis':'DECLARED_ORIGINAL'}
    case('initial_union_plus_reserves_denies_before_any_IO_no_refund',budget_initial)
    def changed_tuple_charge():
        l=P.Ledger();r=copy.deepcopy(rows[0]);l.admit(r,debt=True);x=copy.deepcopy(r);x['nine']['ctime_ns']=str(int(x['nine']['ctime_ns'])+1);l.admit(x,debt=True)
        same(l.byte_count,22);same(len(l.rows),2);error=deny(l.preflight);return {'denial':str(error),'chargedBytes':l.byte_count,'versionAdmissions':len(l.rows),'readDebtCount':len(l.read_debts)}
    case('same_content_changed_nine_charged_twice_and_conflict_denied',changed_tuple_charge)
    def wrong_stop():
        s,io,l=make(stop=1);error=deny(lambda:s.run(caller,lambda _:(_ for _ in ()).throw(AssertionError('BAD_STOP_REACHED_ACTION'))));same(len([x for x in io.events if x['event']=='OPEN']),0);same(l.byte_count,61)
        return snapshot(s,io,l)|{'denial':str(error),'payloadCallbacks':0}
    case('genuine_STOP_maxmtimectime_before_any_open_or_action',wrong_stop)
    def shared_growth_observation():
        s,io,l=make();before=l.byte_count
        for i,size in enumerate([16777216,16777216,16777216,12582912]):l.admit(fake_row('new-import-debt-'+str(i),size),debt=True)
        over=l.byte_count+P.CAPS['MF']+P.CAPS['approval']+P.CAPS['DATA']-P.CAPS['bytes'];same(over>0,True)
        callback=[];error=None
        try:s.run(caller,lambda _:callback.append('AFTER_UNION_BECAME_OVER_CAP'))
        except BaseException as e:error=e
        finally:finish(s,io)
        # Observation is not an acceptance assertion. It independently detects
        # whether the facade rechecks the SAME mutable ledger before effects.
        violation=bool(callback or any(x['event']=='OPEN' for x in io.events))
        return snapshot(s,io,l)|{'bytesBefore':before,'currentUnionWithReserves':l.byte_count+7340032,'over64MiB':over,'callbacks':callback,'error':None if error is None else str(error),'requiredDenyBeforeIOAndActionViolated':violation}
    case('OBSERVATION_shared_ledger_growth_after_constructor_current_cap_gate',shared_growth_observation)
    def path_io_observation():
        s,io,l=make();original=A.Path;attempts=[]
        class ProbePath(type(Path())):
            def resolve(self,*a,**k):attempts.append(str(self));raise OSError('INDEPENDENT_ORDINARY_PATH_RESOLVE_OUTSIDE_INJECTED_IO')
        A.Path=ProbePath;s.root=ProbePath(str(J));error=None
        try:s.run(caller,lambda _:(_ for _ in ()).throw(AssertionError('PATH_DENIAL_REACHED_ACTION')))
        except BaseException as e:error=e
        finally:A.Path=original;finish(s,io)
        return snapshot(s,io,l)|{'ordinaryResolveAttempts':attempts,'error':None if error is None else str(error),'ordinaryInjectedIOBypassObserved':bool(attempts)}
    case('OBSERVATION_Path_resolve_ordinary_metadata_outside_injected_IO',path_io_observation)
    def publish_observation():
        s,io,l=make();published=[];error=None
        def primary(_):raise ValueError('INDEPENDENT_PRIMARY_FAILURE')
        try:s.run(caller,primary,lambda result:published.append({'result':result,'failuresPresent':bool(s.failures)}))
        except BaseException as e:error=e
        finally:finish(s,io)
        return snapshot(s,io,l)|{'publicationCallsAfterPrimaryFailure':published,'error':None if error is None else str(error),'scope':'OBSERVATION_NO_REAL_PUBLICATION_OR_AUTHORITY_EFFECT'}
    case('OBSERVATION_publication_callback_after_primary_failure',publish_observation)
    return {'scope':'INDEPENDENT_SOURCE_FACADE_CODE_BEHAVIOR_ONLY','conditions':outcomes,'details':details,'passed':sum(x['status']=='PASS' for x in outcomes),'failed':sum(x['status']=='FAIL' for x in outcomes),
      'actualOwnedFixtureFDChecks':True,'phaseAPI':'INJECTED_A5_REJECTED_NO_ADOPTION','sourceEligibility':False,'runtimeAuthority':False,'functionalAcceptance':False,'DockerEffects':0,'serviceEffects':0,'privateReads':0}
