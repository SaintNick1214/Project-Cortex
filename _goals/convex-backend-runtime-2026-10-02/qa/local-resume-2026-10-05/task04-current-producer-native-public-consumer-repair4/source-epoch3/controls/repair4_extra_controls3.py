"""Registration, actual generator rendering and unchanged assertion conservation."""
import ast,copy,hashlib,json,sys,types
from pathlib import Path
RESULTS=[]
def case(name,fn):
    try:detail=fn();RESULTS.append({'name':name,'status':'PASS_SOURCE_MOCK_ONLY','detail':detail})
    except BaseException as error:RESULTS.append({'name':name,'status':'FAIL_SOURCE_MOCK_ONLY','error':repr(error)})
def extract(source,names):
    return compile(ast.Module(body=[n for n in ast.parse(source).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))and n.name in names],type_ignores=[]),'actual-source-registration-entry','exec')
def registration(index=None,partial=False,close_bad=False):
    made=[];closed=[];saved=[]
    class H:
        def __init__(self,*args):self.n=len(made)+1;self.detached=False;made.append(self)
        def row(self):return {'n':self.n}
        def fence(self,full=False):assert full
        def close(self):
            assert not self.detached;self.detached=True;closed.append(self.n)
            if close_bad and self.n==index:raise OSError('registration-fallback-close')
    class Owned(list):
        def append(self,h):
            if h.n==index:
                if partial:super().append(h)
                raise MemoryError('source-registration-memory')
            super().append(h)
    owned=Owned();g={'S':Path('/mock/source'),'SOURCE_HELD':owned,'SOURCE_DIRS':[],'RUN':Path('/mock/run'),'WHOLE_END':None,'Held':H,'time':types.SimpleNamespace(monotonic=lambda:10),'phase':lambda*a:None,'remaining':lambda:1,'cleanup':lambda:None,'artifact_manifest':lambda:None,'fence_directories':lambda rows:None,'save':lambda name,value:saved.append((name,value))}
    def opening(root):return ({'files':[{'path':'a'},{'path':'b'},{'path':'c'}]},H(),[])
    g['open_manifest']=opening
    exec(extract(SOURCES['ci-run.py'],{'register_source','verify_source','EntryFailure','entry'}),g)
    g['main']=g['verify_source'];error=None
    try:g['entry']()
    except g['EntryFailure']as e:error=e
    assert sorted(closed)==list(range(1,len(made)+1))and len(set(closed))==len(closed)and g['SOURCE_HELD']==[]
    assert (error is not None)==(index is not None)
    if error:
        chain=[];current=error
        while current is not None:chain.append(current);current=current.__cause__
        assert any(isinstance(e,MemoryError)for e in chain)
        if close_bad:assert any(getattr(e,'closeFailures',[])for e in chain)
    return {'made':len(made),'closeAttempts':closed,'noUnknownCloseRetry':True,'sticky':error is not None,'effects':0}
case('actual_verify_source_complete',lambda:registration())
for index in (1,2,4):
    for partial in (False,True):
        for bad in (False,True):case('source_registration_'+str(index)+'_partial_'+str(partial)+'_close_'+str(bad),lambda index=index,partial=partial,bad=bad:registration(index,partial,bad))

def late_failure(stage):
    calls=[];g={'SOURCE_HELD':[],'SOURCE_DIRS':[],'RUN':Path('/mock/run'),'WHOLE_END':None,'time':types.SimpleNamespace(monotonic=lambda:10)}
    class H:
        def fence(self,full=False):assert full
        def close(self):calls.append('close')
    def failing():raise MemoryError('late-'+stage)
    g.update(main=lambda:g['SOURCE_HELD'].extend([H(),H(),H()]),cleanup=lambda:None,phase=lambda*a:None,fence_directories=lambda rows:None,remaining=lambda:1,artifact_manifest=lambda:None,save=lambda*a:None)
    if stage=='phase':g['phase']=lambda*a:failing()
    elif stage=='directories':g['fence_directories']=lambda*a:failing()
    elif stage=='remaining':g['remaining']=failing
    elif stage=='artifact':g['artifact_manifest']=failing
    exec(extract(SOURCES['ci-run.py'],{'EntryFailure','entry'}),g)
    try:g['entry']()
    except g['EntryFailure']as error:assert any(str(e)=='late-'+stage for s,e in error.failures)
    else:raise AssertionError('late cleanup failure became PASS')
    assert calls==['close']*3
    return {'allThreeCloseAttempts':True,'sticky':True}
for stage in ('phase','directories','remaining','artifact'):case('ci_outer_lifetime_late_'+stage,lambda stage=stage:late_failure(stage))

G={'__name__':'source_mock_generator','__file__':GENERATOR_PATH}
exec(compile(GENERATOR_SOURCE,GENERATOR_PATH,'exec'),G)
source_bytes={row['sourcePath']:SOURCES[row['path']].encode()for row in PLAN['files']}
def generated_positive():
    rendered=G['render_candidate'](PLAN,source_bytes);mf=G['strict'](rendered['source-manifest.json'])
    assert len(rendered)==113 and len(mf['files'])==112 and mf['fileCount']==112
    assert rendered['ci-run.py']==SOURCES['ci-run.py'].encode()and rendered['native_export.py']==SOURCES['native_export.py'].encode()
    assert mf['sourceBytes']==sum(len(rendered[row['path']])for row in mf['files'])
    for row in mf['files']:assert row['sha256']==hashlib.sha256(rendered[row['path']]).hexdigest()
    tree=ast.parse(GENERATOR_SOURCE);acquire=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='acquire_sources');materialize=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='materialize')
    assert any(isinstance(n,ast.Call)and isinstance(n.func,ast.Name)and n.func.id=='render_candidate'for n in ast.walk(acquire))
    assert any(isinstance(n,ast.Call)and isinstance(n.func,ast.Name)and n.func.id=='acquire_sources'for n in ast.walk(materialize))
    return {'actualGeneratorProducesRepairedBytes':True,'sourceNames':112,'companion':1,'unchangedFromR3':110,'unchangedFromOriginalR1':109,'physicalCopies':0}
case('actual_generator_render_and_materialize_wiring',generated_positive)
for fault in ('count','duplicate','hash','payload','authority'):
    def denial(fault=fault):
        plan=copy.deepcopy(PLAN);bodies=dict(source_bytes)
        if fault=='count':plan['fileCount']=111
        elif fault=='duplicate':plan['files'][1]=plan['files'][0]
        elif fault=='hash':plan['files'][0]['sha256']='0'*64
        elif fault=='payload':bodies[plan['files'][0]['sourcePath']]+=b'x'
        else:plan['runtimeAuthority']=True
        try:G['render_candidate'](plan,bodies)
        except (ValueError,KeyError):return {'deniedBeforeWrite':True}
        raise AssertionError('invalid candidate generator input accepted')
    case('generator_'+fault+'_denied',denial)
def strict_finite():
    for raw in (b'1e309',b'NaN',b'{"a":1,"a":2}'):
        try:G['strict'](raw)
        except ValueError:continue
        raise AssertionError('nonfinite/duplicate generator DATA accepted')
    assert G['strict'](b'{"a":[1e308,null]}')=={'a':[1e308,None]}
    return {'finiteNonePreserved':True}
case('generator_finite_json_and_null_conserved',strict_finite)

def conserve():
    old_ci={n.name:ast.dump(n,include_attributes=False)for n in ast.parse(OLD_SOURCES['ci-run.py']).body if isinstance(n,ast.FunctionDef)}
    new_ci={n.name:ast.dump(n,include_attributes=False)for n in ast.parse(SOURCES['ci-run.py']).body if isinstance(n,ast.FunctionDef)}
    kept=[name for name in old_ci if name not in ('verify_source','prepare_inputs')]
    assert all(old_ci[name]==new_ci[name]for name in kept)
    old_ne=ast.parse(OLD_SOURCES['native_export.py']);new_ne=ast.parse(SOURCES['native_export.py'])
    validation=lambda tree:ast.dump(next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='validate_manifest'),include_attributes=False)
    assert validation(old_ne)==validation(new_ne)
    old_raises={ast.dump(n,include_attributes=False)for n in ast.walk(old_ne)if isinstance(n,ast.Raise)}
    new_raises={ast.dump(n,include_attributes=False)for n in ast.walk(new_ne)if isinstance(n,ast.Raise)}
    assert old_raises<=new_raises
    old_c={n.name:ast.dump(n,include_attributes=False)for n in ast.parse(OLD_CONSUMER_SOURCE).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
    new_c={n.name:ast.dump(n,include_attributes=False)for n in ast.parse(CONSUMER_SOURCE).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
    unchanged=[name for name in old_c if name not in ('open_inputs','read_held','close_inputs')]
    assert all(old_c[name]==new_c[name]for name in unchanged)
    return {'unchangedOriginalCiFunctions':kept,'unchangedConsumerFunctionsClasses':unchanged,'nativeValidatorExact':True,'allOriginalNativeExportRaisesConserved':True,'nativeOrPolicyExecuted':False}
case('all_original_resource_deadline_security_schema_assertions_conserved',conserve)

class EP:
    def __init__(self,value):self.value=value
    def __truediv__(self,name):return EP(self.value+'/'+name)
    def __str__(self):return self.value
    @property
    def name(self):return self.value.rsplit('/',1)[-1]
    def exists(self):return self.value!='/mock/no-public-manifest'
    def is_symlink(self):return False
    def iterdir(self):return []
def native_registration(index,close_bad):
    import dis
    made=[];closed=[]
    class H:
        def __init__(self,*args):self.n=len(made)+1;self.size=0;self.digest='a'*64;self.pin={};self.detached=False;made.append(self)
        def row(self):return {'path':'mock','bytes':0}
        def fence(self,full=False):assert full
        def close(self):
            assert not self.detached;self.detached=True;closed.append(self.n)
            if close_bad and self.n in (1,index):raise OSError('native-registration-close-'+str(self.n))
    g={'Held':H,'sys':sys,'re':__import__('re'),'strict':lambda raw:None,'MAX_BYTES':570425344,'FIXED':tuple('member-'+str(n)for n in range(23)),'PUBLIC':()}
    exec(extract(SOURCES['native_export.py'],{'manifest'}),g)
    code=g['manifest'].__code__;line=next(i for i,text in enumerate(SOURCES['native_export.py'].splitlines(),1)if 'try:held.append(h)'in text);current=0;offset=None
    for instruction in dis.get_instructions(code):
        positions=getattr(instruction,'positions',None)
        if positions is not None and positions.lineno is not None:current=positions.lineno
        elif type(instruction.starts_line)is int:current=instruction.starts_line
        if current==line and instruction.argval=='append':offset=instruction.offset
    assert offset is not None;fired=False
    def trace(frame,event,arg):
        nonlocal fired
        if frame.f_code is code:
            frame.f_trace_opcodes=True
            if event=='opcode'and frame.f_lasti==offset and len(made)==index and not fired:
                fired=True;raise MemoryError('native-append-memory')
        return trace
    error=None
    try:
        sys.settrace(trace)
        try:g['manifest'](EP('/mock/base'),EP('/mock/public'),EP('/mock/no-public-manifest'))
        except BaseException as e:error=e
    finally:sys.settrace(None)
    assert fired and error is not None and sorted(closed)==list(range(1,index+1))and len(set(closed))==len(closed)
    chain=[];current=error
    while current is not None:chain.append(current);current=current.__cause__
    assert any(isinstance(e,MemoryError)for e in chain)
    if close_bad:assert any(getattr(e,'closeFailures',[])for e in chain)
    return {'made':index,'closeAttempts':closed,'unknownFDsRetried':False,'sticky':True}
for index in (1,12,23):
    for bad in (False,True):case('native_manifest_registration_'+str(index)+'_close_'+str(bad),lambda index=index,bad=bad:native_registration(index,bad))

def generator_closes(bad=(),primary=False):
    saved=G['os'];calls=[];rows=[{'path':'/mock/'+str(fd),'fd':fd}for fd in (11,12,13)]
    def close(fd):
        calls.append(fd)
        if fd in bad:raise OSError('generator-close-'+str(fd))
    G['os']=types.SimpleNamespace(close=close);error=None
    try:
        try:
            try:
                if primary:raise MemoryError('generator-original')
            finally:G['close_owned'](rows)
        except BaseException as e:error=e
        assert calls==[11,12,13]and all('fd'not in row for row in rows)
        G['close_owned'](rows);assert calls==[11,12,13]
        assert (error is not None)==bool(bad or primary)
        if bad:assert len(error.closeFailures)==len(bad)
        if primary and bad:assert isinstance(error.__cause__,MemoryError)and str(error.__cause__)=='generator-original'
        return {'closeAttempts':calls,'sticky':error is not None,'noUnknownCloseRetry':True}
    finally:G['os']=saved
case('actual_generator_owner_complete',lambda:generator_closes())
for bad in ((11,),(12,),(13,),(11,12,13)):
    for primary in (False,True):case('actual_generator_owner_close_'+str(bad)+'_primary_'+str(primary),lambda bad=bad,primary=primary:generator_closes(bad,primary))

RESULT={'scope':'TASK04_REPAIR4_SOURCE_MOCK_REGISTRATION_GENERATOR_CONSERVATION_ONLY','count':len(RESULTS),'PASS':sum(r['status']=='PASS_SOURCE_MOCK_ONLY'for r in RESULTS),'FAIL':sum(r['status']=='FAIL_SOURCE_MOCK_ONLY'for r in RESULTS),'rows':RESULTS,'effects':0,'sourceEligibility':False,'runtimeAuthority':False,'nativeTask04':False}
