"""Actual repaired entry/manifest/open_inputs functions; isolated SOURCE/MOCK only."""
import ast,copy,dis,json,sys,types
from pathlib import Path
RESULTS=[]

def extract(source,names):
    nodes=[n for n in ast.parse(source).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))and n.name in names]
    assert len(nodes)==len(names)
    return compile(ast.Module(body=nodes,type_ignores=[]),'exact-reviewed-repair4-functions','exec')

def case(name,fn):
    try:detail=fn();RESULTS.append({'name':name,'status':'PASS_SOURCE_MOCK_ONLY','detail':detail})
    except BaseException as error:RESULTS.append({'name':name,'status':'FAIL_SOURCE_MOCK_ONLY','error':repr(error)})

def ci_case(close_bad=(),primary=False,report_bad=None,fence_bad=(),early=False,cleanup_bad=False):
    closed=[];fenced=[];saved=[];owned=[]
    class H:
        def __init__(self,n):self.n=n;self.detached=False
        def fence(self,full=False):
            assert full;fenced.append(self.n)
            if self.n in fence_bad:raise OSError('fence-'+str(self.n))
        def close(self):
            assert not self.detached;self.detached=True;closed.append(self.n)
            if self.n in close_bad:raise OSError('close-'+str(self.n))
    g={'__name__':'source_mock','SOURCE_HELD':owned,'SOURCE_DIRS':[],'RUN':None,'WHOLE_END':None,
       'time':types.SimpleNamespace(monotonic=lambda:10.0),'phase':lambda name,seconds:None,
       'remaining':lambda:1,'fence_directories':lambda rows:None,'artifact_manifest':lambda:None}
    def main():
        owned.extend(H(n)for n in (1,2,3));g['RUN']=None if early else Path('/mock/run')
        if primary:raise MemoryError('original-main-memory')
    def cleanup():
        if cleanup_bad:raise OSError('owned-cleanup')
    def save(name,value):
        if name==report_bad:raise OSError('report-'+name)
        saved.append((name,copy.deepcopy(value)))
    g.update(main=main,cleanup=cleanup,save=save)
    exec(extract(SOURCES['ci-run.py'],{'EntryFailure','entry'}),g)
    error=None
    try:g['entry']()
    except g['EntryFailure']as observed:error=observed
    assert closed==[1,2,3]and fenced==[1,2,3]and g['SOURCE_HELD']==[]
    expected=primary or bool(close_bad)or bool(fence_bad)or bool(report_bad)or cleanup_bad
    assert (error is not None)==bool(expected)
    if error:
        stages=[stage for stage,e in error.failures]
        assert stages.count('source-close')==len(close_bad)and stages.count('source-fence')==len(fence_bad)
        assert error.__cause__ is error.primaryFailure
        if primary:assert isinstance(error.primaryFailure,MemoryError)and str(error.primaryFailure)=='original-main-memory'
        if report_bad:assert any(str(e)=='report-'+report_bad for stage,e in error.failures)
    for name,value in saved:
        if name=='writer-stop.json':assert value['sourceWritersClosed']==(not bool(close_bad))and (value['primary']is None)==(not bool(expected))
    return {'closes':closed,'fences':fenced,'sticky':error is not None,'errorStages':[s for s,e in error.failures]if error else[],'foreignEffects':0}

case('actual_ci_entry_complete',lambda:ci_case())
for failures in ((1,),(2,),(3,),(1,2,3)):
    for primary in (False,True):case('ci_all_close_'+str(failures)+'_primary_'+str(primary),lambda failures=failures,primary=primary:ci_case(failures,primary))
for report in ('host-failure.json','cleanup-failure.json','writer-stop.json'):
    case('ci_report_failure_'+report,lambda report=report:ci_case((1,3),True,report,(2,),cleanup_bad=report=='cleanup-failure.json'))
case('ci_early_setup_memory_sources_owned',lambda:ci_case((2,),True,early=True))
case('ci_cleanup_report_only_failure_all_sources_closed',lambda:ci_case(report_bad='cleanup-failure.json',cleanup_bad=True))

class ExportPath:
    def __init__(self,value):self.value=value
    def __truediv__(self,name):return ExportPath(self.value+'/'+name)
    def __str__(self):return self.value
    @property
    def name(self):return self.value.rsplit('/',1)[-1]
    def exists(self):return self.value!='/mock/public-manifest'
    def is_symlink(self):return False
    def iterdir(self):return []

def export_case(close_bad=(),primary_index=None):
    owned=[];closed=[]
    class H:
        def __init__(self,path,cap):self.n=len(owned)+1;self.size=0;self.digest='a'*64;self.pin={};self.detached=False;owned.append(self)
        def row(self):
            if self.n==primary_index:raise ValueError('original-export-'+str(self.n))
            return {'path':'mock','bytes':0}
        def fence(self,full=False):assert full
        def close(self):
            assert not self.detached;self.detached=True;closed.append(self.n)
            if self.n in close_bad:raise OSError('close-export-'+str(self.n))
    g={'Held':H,'strict':lambda raw:None,'sys':sys,'re':__import__('re'),'MAX_BYTES':570425344,'FIXED':tuple('member-'+str(i)for i in range(1,24)),'PUBLIC':()}
    exec(extract(SOURCES['native_export.py'],{'manifest'}),g)
    error=None;result=None
    try:result=g['manifest'](ExportPath('/mock/base'),ExportPath('/mock/public'),ExportPath('/mock/public-manifest'))
    except BaseException as e:error=e
    assert closed==list(range(1,len(owned)+1))and len(set(closed))==len(closed)
    assert (error is not None)==bool(close_bad or primary_index)
    if close_bad:
        assert len(error.closeFailures)==len([n for n in close_bad if n<=len(owned)])
        if primary_index:assert str(error.__cause__)=='original-export-'+str(primary_index)and error.primaryFailure is error.__cause__
    if result:assert result['fileCount']==23 and result['nativeFunctionalAcceptance']is False and result['original122']=='HELD'
    return {'owned':len(owned),'allCloseAttempts':closed,'sticky':error is not None,'effects':0}

case('actual_native_manifest_complete',lambda:export_case())
for bad in ((1,),(12,),(23,),tuple(range(1,24))):
    case('native_manifest_all_closes_'+str(bad),lambda bad=bad:export_case(bad))
for index in (1,12,23):
    case('native_manifest_original_failure_'+str(index),lambda index=index:export_case(primary_index=index))
    case('native_manifest_original_and_close_failure_'+str(index),lambda index=index:export_case(tuple(range(1,index+1)),index))

def consumer_case(stage='complete',index=1,close_bad=()):
    g={'__name__':'source_mock','__file__':CONSUMER_PATH};exec(compile(CONSUMER_SOURCE,CONSUMER_PATH,'exec'),g)
    opened=[];closed=[];target=0
    class FakePath(type(Path())):
        def resolve(self,*args,**kwargs):return self
        def is_absolute(self):return True
    paths=[FakePath('/mock/'+str(n))for n in (1,2,3)]
    def number(path):return int(path.name)
    def pin(n):
        return types.SimpleNamespace(**{'st_'+k:v for k,v in {'dev':1,'ino':n,'mode':33152,'uid':501,'gid':20,'nlink':1,'size':1,'mtime_ns':1,'ctime_ns':1}.items()})
    def opening(path,flags):
        if stage=='open'and number(path)==index:raise MemoryError('open-memory')
        fd=100+number(path);opened.append(fd);return fd
    def fstat(fd):
        if stage=='metadata'and fd==100+index:raise MemoryError('metadata-memory')
        return pin(fd-100)
    def closing(fd):
        closed.append(fd)
        if fd in close_bad:raise OSError('close-input-'+str(fd))
    class Ledger(g['InputLedger']):
        def opened(self):
            if stage=='ledger-before'and len(opened)==index:raise MemoryError('ledger-before-memory')
            super().opened()
            if stage=='ledger-after'and len(opened)==index:raise MemoryError('ledger-after-memory')
    ledger=Ledger();ledger.active=5;ledger.peak=5
    g.update(os=types.SimpleNamespace(lstat=lambda p:pin(number(p)),open=opening,fstat=fstat,close=closing,O_RDONLY=0,O_NOFOLLOW=0),time=types.SimpleNamespace(time_ns=lambda:60000000001),LEDGER=ledger)
    code=g['open_inputs'].__code__;instructions=list(dis.get_instructions(code));append_offset=next(i.offset for i in instructions if i.opname in ('LOAD_METHOD','LOAD_ATTR')and i.argval=='append')
    entry_store=next(i.offset for i in instructions if i.opname=='STORE_FAST'and i.argval=='entry');allocation_offset=max(i.offset for i in instructions if i.offset<entry_store and i.opname in ('BUILD_MAP','BUILD_CONST_KEY_MAP'))
    fired=False
    def tracer(frame,event,arg):
        nonlocal fired
        if frame.f_code is code:
            frame.f_trace_opcodes=True
            if event=='opcode'and not fired:
                if frame.f_lasti==append_offset and stage=='append'and len(opened)==index:
                    fired=True;raise MemoryError('pending-append-memory')
                if frame.f_lasti==allocation_offset and stage=='entry-allocation'and len(opened)==index-1:
                    fired=True;raise MemoryError('entry-allocation-memory')
        return tracer
    error=None;pending=None
    try:
        if stage in ('append','entry-allocation'):sys.settrace(tracer)
        try:pending=g['open_inputs'](paths)
        except BaseException as e:error=e
    finally:sys.settrace(None)
    if pending is not None:
        try:g['close_inputs'](pending)
        except BaseException as e:error=e
    assert sorted(opened)==sorted(closed)and len(set(closed))==len(closed)and ledger.active==5
    assert (error is not None)==bool(stage!='complete'or close_bad)
    if stage in ('append','entry-allocation'):assert fired
    if error and close_bad:
        assert getattr(error,'closeFailures',[])or getattr(error.__cause__,'closeFailures',[])
    return {'actualFunction':'open_inputs','opened':opened,'closeAttempts':closed,'foreignLedgerOwnersRetained':ledger.active,'unknownFDsRetried':False,'sticky':error is not None}

case('actual_consumer_open_complete',lambda:consumer_case())
for stage in ('open','metadata','ledger-before','ledger-after','append','entry-allocation'):
    for index in (1,2,3):case('consumer_'+stage+'_'+str(index),lambda stage=stage,index=index:consumer_case(stage,index))
for index in (1,2,3):case('consumer_append_and_close_'+str(index),lambda index=index:consumer_case('append',index,(100+index,)))
case('consumer_registration_multiple_close_failures',lambda:consumer_case('append',3,(101,102,103)))
case('consumer_all_owned_closes_sticky',lambda:consumer_case(close_bad=(101,102,103)))

RESULT={'scope':'TASK04_REPAIR4_ACTUAL_FUNCTION_SOURCE_MOCK_FAULT_OUTCOMES_ONLY','count':len(RESULTS),'PASS':sum(r['status']=='PASS_SOURCE_MOCK_ONLY'for r in RESULTS),'FAIL':sum(r['status']=='FAIL_SOURCE_MOCK_ONLY'for r in RESULTS),'rows':RESULTS,'nativeEffects':0,'Docker':False,'privateAccess':0,'runtimeAuthority':False,'sourceEligibility':False,'functionalTask04':False}
