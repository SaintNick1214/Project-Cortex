"""Independent R4/C6 source/mock assessment; all candidate bodies supplied by held source gate."""
import ast,copy,hashlib,json,sys,types,dis,time
from pathlib import Path

def extract(source,names):
    nodes=[n for n in ast.parse(source).body if isinstance(n,(ast.ClassDef,ast.FunctionDef)) and n.name in names]
    assert len(nodes)==len(names)
    return compile(ast.Module(body=nodes,type_ignores=[]),'independent-exact-candidate-functions','exec',dont_inherit=True)

def chain(e):
    out=[];seen=set()
    def visit(v):
        if not isinstance(v,BaseException) or id(v) in seen:return
        seen.add(id(v));out.append(v)
        for child in getattr(v,'exceptions',()):visit(child)
        visit(getattr(v,'primaryFailure',None))
        for item in getattr(v,'failures',()):
            if isinstance(item,(list,tuple)):
                for child in item:visit(child)
            else:visit(item)
        for item in getattr(v,'closeFailures',()):
            if isinstance(item,(list,tuple)):
                for child in item:visit(child)
            else:visit(item)
        visit(v.__cause__);visit(v.__context__)
    visit(e);return out

def main(cache,rows,holder,args):
    started=time.monotonic();J=Path(__file__).parent;P=J.parent
    R3=P/'task04-current-producer-native-public-repair3';R4=P/'task04-current-producer-native-public-repair4'
    C5=P/'task04-current-producer-native-public-consumer-repair3';C6=P/'task04-current-producer-native-public-consumer-repair4';E4=C6/'source-epoch3'
    candidate=json.loads(cache[str(E4/'candidate-source-plan.json')])
    sources={r['path']:cache[r['sourcePath']].decode()for r in candidate['files']}
    assert len(sources)==112 and candidate['fileCount']==112
    current=cache[str(C6/'programs/consumer.py')].decode()
    C={'__name__':'independent_source_mock','__file__':str(C6/'programs/consumer.py')}
    exec(compile(current,str(C6/'programs/consumer.py'),'exec',dont_inherit=True),C)
    controls=[];replays=[];failures=[]
    def case(name,fn):
        assert name not in {r['name']for r in controls}
        try:detail=fn();controls.append({'name':name,'status':'PASS','detail':detail})
        except BaseException as e:
            controls.append({'name':name,'status':'FAIL','error':repr(e)});failures.append(name)
    proof=json.loads(cache[str(R3/'original100-conservation-reference.json')]);old_root=Path(proof['originalProof']['path']).parents[1]
    assert proof['originalCount']==100 and len(proof['rows'])==100
    for r in proof['rows']:
        b=cache[str(old_root/r['newExactConservationBacking'])];assert(len(b),hashlib.sha256(b).hexdigest())==(r['bytes'],r['sha256'])
    for name in sources:
        if name not in ('ci-run.py','native_export.py'):assert sources[name].encode()==cache[str(R3/'source'/name)]
    programs=[(R3/'controls'/n,{'SOURCES':sources,'SOURCE_ROOT':str(E4/'runtime-stage/generated-candidate/source')})for n in ('independent-r1-controls.py','independent-r1-extra-controls.py','public_disposition_controls.py')]
    programs += [(C5/'controls/consumer_controls2.py',{'C':C}),(C5/'controls/bootstrap_close_controls.py',{'SOURCE':cache[str(C5/'infrastructure/final-close3.py')].decode()}),(C6/'controls/repair4_fault_controls2.py',{'SOURCES':sources,'CONSUMER_SOURCE':current,'CONSUMER_PATH':str(C6/'programs/consumer.py')})]
    programs += [(E4/'controls/repair4_extra_controls3.py',{'SOURCES':sources,'OLD_SOURCES':{n:cache[str(R3/'source'/n)].decode()for n in ('ci-run.py','native_export.py')},'CONSUMER_SOURCE':current,'OLD_CONSUMER_SOURCE':cache[str(C5/'programs/consumer.py')].decode(),'GENERATOR_SOURCE':cache[str(E4/'infrastructure/prepare.py')].decode(),'GENERATOR_PATH':str(E4/'infrastructure/prepare.py'),'PLAN':candidate})]
    programs += [(E4/'controls/prepare-input-registration-controls.py',{'SOURCES':sources,'PREVIOUS_CI_SOURCE':cache[str(R4/'source/ci-run.py')].decode()})]
    namespaces=[]
    for (path,context),count in zip(programs,(30,20,42,66,6,49,40,18)):
        context.update(__name__='independent_held_source_mock_replay',__file__=str(path))
        exec(compile(cache[str(path)],str(path),'exec',dont_inherit=True),context)
        r=context['RESULT'];assert r['PASS']+r['FAIL']==count
        replays.append({'path':str(path),'sourceSha256':rows[str(path)]['sha256'],'expected':count,'result':r})
        namespaces.append(context)
        if r['FAIL']:failures.append('replay:'+str(path))
    # These are independent oracles over exact candidate definitions, with synthetic
    # descriptor ownership; no original acquisition/publication code is invoked.
    def ci_lifetime(stage,index,kind):
        primary=SystemExit(0) if kind=='exit0' else SystemExit(7) if kind=='exit7' else MemoryError('independent-primary')
        final=OSError('independent-final');report=OSError('independent-report');closing=OSError('independent-close')
        opened=[];closed=[];fenced=[];saved=[];originals=[]
        class H:
            def __init__(self,n):self.n=n;self.detached=False;opened.append(n)
            def fence(self,full=False):
                assert full;fenced.append(self.n)
                if stage in ('final','combined')and self.n==index:originals.append(final);raise final
            def close(self):
                assert not self.detached;self.detached=True;closed.append(self.n)
                if stage in ('close','combined')and self.n==index:originals.append(closing);raise closing
        owned=[]
        g={'SOURCE_HELD':owned,'SOURCE_DIRS':[],'RUN':Path('/mock/run'),'WHOLE_END':None,
           'time':types.SimpleNamespace(monotonic=lambda:1),'phase':lambda*a:None,'remaining':lambda:1,
           'fence_directories':lambda*a:None,'artifact_manifest':lambda:None,'cleanup':lambda:None}
        def m():
            owned.extend(H(n)for n in (1,2,3))
            if stage in ('primary','combined'):originals.append(primary);raise primary
        def save(name,data):
            if stage in ('report','combined')and name=='writer-stop.json':originals.append(report);raise report
            saved.append(name)
        g.update(main=m,save=save);exec(extract(sources['ci-run.py'],{'EntryFailure','entry'}),g)
        error=None
        try:g['entry']()
        except BaseException as e:error=e
        assert closed==opened==[1,2,3]and fenced==[1,2,3]and g['SOURCE_HELD']==[]
        assert(error is not None)==(stage!='positive')
        if error:
            assert all(any(e is original for e in chain(error))for original in originals)
            assert error.__cause__ is error.primaryFailure
        return {'closeAttempts':closed,'fences':fenced,'originalErrorsRetained':len(originals),'zeroRetries':True}
    case('independent_ci_positive_complete',lambda:ci_lifetime('positive',2,'memory'))
    for stage in ('primary','final','close','report','combined'):
        for index in (1,2,3):
            for kind in (('exit0','exit7','memory')if stage in ('primary','combined')else('memory',)):
                case('independent_ci_'+stage+'_'+str(index)+'_'+kind,lambda s=stage,i=index,k=kind:ci_lifetime(s,i,k))
    # Reach actual complete native manifest and registration seams with an
    # independent expected opened/close set and structured sticky-error oracle.
    N=namespaces[5];X=namespaces[6];I=namespaces[7]
    for index in (1,12,23):
        case('independent_native_primary_close_'+str(index),lambda i=index:N['export_case']((1,i),i))
        case('independent_native_registration_close_'+str(index),lambda i=index:X['native_registration'](i,True))
    for index in (1,2,4):
        for partial in (False,True):
            case('independent_verify_source_registration_'+str(index)+'_'+str(partial),lambda i=index,p=partial:X['registration'](i,p,True))
    for index in (3,4,5,6):
        for partial in (False,True):
            case('independent_prepare_inputs_registration_'+str(index)+'_'+str(partial),lambda i=index,p=partial:I['exercise'](i,p,True))
    def consumer_lifetime(stage,index,bad_close=False):
        g={'__name__':'independent_consumer','__file__':str(C6/'programs/consumer.py')}
        exec(compile(current,str(C6/'programs/consumer.py'),'exec',dont_inherit=True),g)
        opened=[];closed=[];offset={};primary=SystemExit(0)if stage=='parse'else MemoryError('independent-'+stage)
        close_error=OSError('independent-consumer-close');hit=False
        class FP(type(Path())):
            def resolve(self,*a,**k):return self
        paths=[FP('/mock/'+str(n))for n in (1,2,3)]
        def pin(n):
            return types.SimpleNamespace(st_dev=7,st_ino=n,st_mode=33152,st_nlink=1,st_uid=501,st_gid=20,st_size=2,st_mtime_ns=1,st_ctime_ns=1)
        def ls(p):
            nonlocal hit
            n=int(Path(p).name)
            if stage=='maturity'and n==index:return types.SimpleNamespace(**{**pin(n).__dict__,'st_ctime_ns':60000000001})
            return pin(n)
        def op(p,flags):
            nonlocal hit
            n=int(p.name)
            if stage=='open'and n==index:hit=True;raise primary
            fd=100+n;opened.append(fd);offset[fd]=0;return fd
        def fs(fd):
            nonlocal hit
            if stage=='fstat'and fd==100+index:hit=True;raise primary
            return pin(fd-100)
        def read(fd,cap):
            nonlocal hit
            if stage=='read'and fd==100+index:hit=True;raise primary
            i=offset[fd];offset[fd]=2;return b'{}'[i:]
        def close(fd):
            closed.append(fd);assert closed.count(fd)==1
            if bad_close and fd==100+index:raise close_error
        ledger=g['InputLedger']();ledger.active=5;ledger.peak=5
        class Ledger(g['InputLedger']):
            def opened(self):
                nonlocal hit
                if stage=='ledger-before'and len(opened)==index:hit=True;raise primary
                super().opened()
                if stage=='ledger-after'and len(opened)==index:hit=True;raise primary
        ledger=Ledger();ledger.active=5;ledger.peak=5
        g.update(os=types.SimpleNamespace(lstat=ls,open=op,fstat=fs,read=read,lseek=lambda fd,*a:offset.update({fd:0}),close=close,O_RDONLY=0,O_NOFOLLOW=0,SEEK_SET=0),time=types.SimpleNamespace(time_ns=lambda:60000000001),LEDGER=ledger)
        error=None;pending=[]
        try:
            try:
                pending=g['open_inputs'](paths)
                for n,row in enumerate(pending,1):
                    rr,raw=g['read_held'](row,collect=True)
                    if stage=='parse'and n==index:hit=True;raise primary
                    assert g['strict'](raw)=={}
            except BaseException as e:error=e
            finally:
                if pending:
                    try:
                        if error is not None:raise error
                    finally:g['close_scope'](pending)
        except BaseException as e:error=e
        assert sorted(opened)==sorted(closed)and len(set(closed))==len(closed)and ledger.active==5
        assert(error is not None)==(stage!='positive'or bad_close)
        if stage not in ('positive','maturity'):assert hit and any(e is primary for e in chain(error))
        if bad_close and 100+index in opened:assert any(e is close_error for e in chain(error))or any('independent-consumer-close'in str(getattr(e,'closeFailures',None))for e in chain(error))
        return {'opened':opened,'closes':closed,'foreignOwners':ledger.active,'sticky':error is not None}
    case('independent_consumer_fullEOF_parse_positive',lambda:consumer_lifetime('positive',2))
    for stage in ('open','fstat','maturity','read','parse','ledger-before','ledger-after'):
        for index in (1,2,3):
            case('independent_consumer_'+stage+'_'+str(index),lambda s=stage,i=index:consumer_lifetime(s,i))
    for index in (1,2,3):
        case('independent_consumer_read_and_close_'+str(index),lambda i=index:consumer_lifetime('read',i,True))
        case('independent_consumer_close_'+str(index),lambda i=index:consumer_lifetime('positive',i,True))
    for index in (1,2,3):
        case('independent_consumer_pending_append_'+str(index),lambda i=index:N['consumer_case']('append',i,(100+i,)))
    # Explicit typed boundary controls are independently checked, not counted
    # from author receipts.
    def json_boundary():
        for raw in (b'1e309',b'-1e309',b'{"a":[1e309]}',b'NaN',b'{"a":1,"a":2}'):
            try:C['strict'](raw)
            except C['BoundaryFailure']:continue
            raise AssertionError('unsafe JSON accepted')
        assert C['strict'](b'{"a":[1e308,null]}')=={'a':[1e308,None]}
        return {'finiteOverflowAndDuplicateDenied':True,'NoneConserved':True}
    case('independent_json_finite_and_none',json_boundary)
    case('independent_original100_full_bytes_and110_unchanged',lambda:{'original100':100,'unchangedR3':110})
    # Strong negative proof: old broken full entry must fail the same all-close
    # expectation. Old preimage functions are never given real external handles.
    def old_close_denial():
        old=cache[str(R3/'source/ci-run.py')].decode();closes=[]
        class H:
            def close(self):
                closes.append(len(closes)+1)
                if len(closes)==1:raise OSError('old-first-close')
        g={'SOURCE_HELD':[H(),H(),H()],'SOURCE_DIRS':[],'RUN':None,'WHOLE_END':None,'time':types.SimpleNamespace(monotonic=lambda:0),'phase':lambda*a:None,'main':lambda:None,'cleanup':lambda:None,'fence_directories':lambda*a:None,'remaining':lambda:1,'artifact_manifest':lambda:None,'save':lambda*a:None}
        exec(extract(old,{'entry'}),g)
        try:g['entry']()
        except BaseException:pass
        assert len(closes)<3
        return {'preimageAbandonsLaterFDs':True,'closeAttempts':len(closes),'candidateOracleDetectsIt':True}
    case('independent_old_ci_leak_negative_proof',old_close_denial)
    assert time.monotonic()-started<120,'FINITE_SOURCE_MOCK_CONTROL_BUDGET'
    final=holder.verify_all();assert all(r['exact']for r in final)and len(final)==len(holder.owned)
    pass_count=sum(r['status']=='PASS'for r in controls)
    return {'scope':'INDEPENDENT_TASK04_R4_C6_HELD_SOURCE_MOCK_ONLY','original164Replayed':sum(r['result']['PASS']for r in replays[:5]),'new107Replayed':sum(r['result']['PASS']for r in replays[5:]),'replayTotal':sum(r['result']['PASS']for r in replays),'replayFAIL':sum(r['result']['FAIL']for r in replays),'replays':replays,'independentPASS':pass_count,'independentFAIL':len(controls)-pass_count,'independentControls':controls,'failureNames':failures,'original100FullBodiesConserved':True,'unchangedR3SourceCount':110,'sourcePin':rows[str(Path(__file__))],'heldAtVerdict':len(holder.owned),'finalNineExact':True,'sameSourceLedger':{'admissions':holder.count,'bytes':holder.total,'reset':False},'allOriginalTask04Requirements':'OPEN','Task04Functional':{'complete':0,'total':3},'registry':'EMPTY','runtimeAuthority':False,'nativeEffects':0,'privateAccess':0,'Docker':False,'sourceEligibility':False,'elapsedSeconds':time.monotonic()-started,'harnessAdaptations':['Only eight pure SOURCE/MOCK bodies compiled from held cache; original author acquisition/publish omitted','Exact candidate function AST definitions with injected in-memory path/FD/process objects','No candidate body edits; SOURCE_ROOT only names hypothetical immutable generation destination']}
