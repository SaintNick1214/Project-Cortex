"""Actual prepare_inputs source injection under outer entry; no file/service effects."""
import ast,hashlib,types
from pathlib import Path
RESULTS=[]
def case(name,fn):
    try:RESULTS.append({'name':name,'status':'PASS_SOURCE_MOCK_ONLY','detail':fn()})
    except BaseException as error:RESULTS.append({'name':name,'status':'FAIL_SOURCE_MOCK_ONLY','error':repr(error)})
def extract(names):
    nodes=[n for n in ast.parse(SOURCES['ci-run.py']).body if isinstance(n,(ast.FunctionDef,ast.ClassDef))and n.name in names]
    return compile(ast.Module(body=nodes,type_ignores=[]),'actual-successor-prepare-inputs','exec')
class P:
    def __init__(self,value):self.value=value
    def __truediv__(self,name):return P(self.value+'/'+name)
    def __str__(self):return self.value
    def read_bytes(self):return b'public owned dummy source'
def exercise(index=None,partial=False,close_bad=False):
    made=[];closed=[];saved=[];calls=[]
    class H:
        def __init__(self,*args):self.n=len(made)+1;self.size=3;self.digest=hashlib.sha256(b'xxx').hexdigest();self.detached=False;made.append(self)
        def fence(self,full=False):assert full
        def close(self):
            assert not self.detached;self.detached=True;closed.append(self.n)
            if close_bad and self.n==index:raise OSError('prepare-input-fallback-close')
    class Owned(list):
        def append(self,h):
            if h.n==index:
                if partial:super().append(h)
                raise MemoryError('prepare-input-register-memory')
            super().append(h)
    owned=Owned();owned.extend([H(),H()])
    def call(argv,*args):calls.append(argv);return b'{}'
    g={'S':P('/mock/source'),'RUN':P('/mock/run'),'SOURCE_HELD':owned,'SOURCE_DIRS':[],'Held':H,'hashlib':hashlib,'strict':lambda raw:{},'call':call,'sys':types.SimpleNamespace(executable='/mock/python'),'save':lambda n,v:saved.append((n,v)),'WHOLE_END':None,'time':types.SimpleNamespace(monotonic=lambda:10),'phase':lambda*a:None,'cleanup':lambda:None,'fence_directories':lambda rows:None,'remaining':lambda:1,'artifact_manifest':lambda:None}
    exec(extract({'register_source','prepare_inputs','EntryFailure','entry'}),g);g['main']=g['prepare_inputs'];error=None
    try:g['entry']()
    except g['EntryFailure']as e:error=e
    assert len(calls)==1 and calls[0][1]=='-B'
    assert sorted(closed)==list(range(1,len(made)+1))and len(closed)==len(set(closed))and g['SOURCE_HELD']==[]
    assert (error is not None)==(index is not None)
    if error:
        chain=[];current=error
        while current is not None:chain.append(current);current=current.__cause__
        assert any(isinstance(e,MemoryError)and str(e)=='prepare-input-register-memory'for e in chain)
        if close_bad:assert any(getattr(e,'closeFailures',[])for e in chain)
    else:
        assert len(made)==6 and any(n=='input-manifest.json'for n,v in saved)
    return {'originalPriorOwnedHolders':2,'madeHolders':len(made),'closeAttempts':closed,'allDetachedOnce':True,'sticky':error is not None,'fourActualPrepareInputsSeams':True,'fileDockerServicePrivateEffects':0}
case('actual_prepare_inputs_complete_outer_lifetime',lambda:exercise())
for index in (3,4,5,6):
    for partial in (False,True):
        for bad in (False,True):case('prepare_inputs_registration_'+str(index)+'_partial_'+str(partial)+'_close_'+str(bad),lambda index=index,partial=partial,bad=bad:exercise(index,partial,bad))
def narrow_delta():
    old=ast.parse(PREVIOUS_CI_SOURCE);new=ast.parse(SOURCES['ci-run.py'])
    oldfunc={n.name:ast.dump(n,include_attributes=False)for n in old.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))};newfunc={n.name:ast.dump(n,include_attributes=False)for n in new.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
    assert set(oldfunc)==set(newfunc)and all(oldfunc[n]==newfunc[n]for n in oldfunc if n!='prepare_inputs')
    expected=PREVIOUS_CI_SOURCE.replace('SOURCE_HELD.append(h);rows.append','register_source(h);rows.append').replace("SOURCE_HELD.append(Held(str(RUN/'input-manifest.json'),65536))","register_source(Held(str(RUN/'input-manifest.json'),65536))")
    assert expected==SOURCES['ci-run.py']
    tree=next(n for n in new.body if isinstance(n,ast.FunctionDef)and n.name=='prepare_inputs')
    calls=[n for n in ast.walk(tree)if isinstance(n,ast.Call)]
    assert sum(isinstance(n.func,ast.Name)and n.func.id=='register_source'for n in calls)==2
    assert not any(isinstance(n.func,ast.Attribute)and isinstance(n.func.value,ast.Name)and n.func.value.id=='SOURCE_HELD'and n.func.attr=='append'for n in calls)
    return {'onlyPrepareInputsChangedFromStoppedPriorCi':True,'loopCoversThreeHoldersPlusInputManifest':True,'allOriginalAssertionsDeadlineResourcesExact':True}
case('successor_exact_guarded_prepare_inputs_delta_only',narrow_delta)
RESULT={'scope':'TASK04_R4_RUNTIME_SUCCESSOR_PREPARE_INPUTS_SOURCE_MOCK_ONLY','PASS':sum(r['status']=='PASS_SOURCE_MOCK_ONLY'for r in RESULTS),'FAIL':sum(r['status']=='FAIL_SOURCE_MOCK_ONLY'for r in RESULTS),'count':len(RESULTS),'rows':RESULTS,'sourceEligibility':False,'runtimeAuthority':False,'effects':0,'nativeTask04':False}
