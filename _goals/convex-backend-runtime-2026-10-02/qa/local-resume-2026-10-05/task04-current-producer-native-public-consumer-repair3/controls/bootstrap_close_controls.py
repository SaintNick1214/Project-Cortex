"""Finite closing-bootstrap SOURCE/MOCK outcomes; no actual target effects."""
import ast,sys,types
node=next(n for n in ast.parse(SOURCE) .body if isinstance(n,ast.FunctionDef)and n.name=='close_bootstrap')
RESULTS=[]
for bad in (None,10,11,12):
    calls=[];rows=[{'path':'/mock/'+str(fd),'heldFD':fd}for fd in (10,11,12)]
    def closing(fd):
        calls.append(fd)
        if fd==bad:raise OSError('INJECT_CLOSE')
    g={'C':{} if bad==12 else None,'os':types.SimpleNamespace(close=closing),'sys':sys}
    exec(compile(ast.Module(body=[node],type_ignores=[]),'held-final-close3-helper','exec'),g)
    error=None
    try:g['close_bootstrap'](rows)
    except RuntimeError as e:error=e
    assert calls==[10,11,12]and all('heldFD'not in r for r in rows)
    assert (error is not None)==(bad is not None)
    assert g['close_bootstrap'](rows)==[]and calls==[10,11,12]
    RESULTS.append({'name':'all_owned_bootstrap_close_'+str(bad),'status':'PASS','scope':'EXECUTOR_SOURCE_MOCK','calls':calls,'unknownFDsRetried':False})
calls=[];g={'C':None,'os':types.SimpleNamespace(close=lambda fd:calls.append(fd)or (_ for _ in ()).throw(OSError('INJECT_CLOSE'))),'sys':sys}
exec(compile(ast.Module(body=[node],type_ignores=[]),'held-final-close3-helper','exec'),g)
try:
    try:raise ValueError('INJECT_COMPILE_OR_GRAPH_FAILURE')
    finally:g['close_bootstrap']([{'path':'/mock','heldFD':99}])
except RuntimeError as e:
    assert isinstance(e.__cause__,ValueError)and len(e.closeFailures)==1 and calls==[99]
    RESULTS.append({'name':'bootstrap_failure_preserves_primary_and_sticky_close','status':'PASS','scope':'EXECUTOR_SOURCE_MOCK'})
else:raise AssertionError('cleanup failure accepted')
calls=[];g={'C':{'close_scope':lambda rows:calls.append(rows)or [{'delegated':True}]},'sys':sys}
exec(compile(ast.Module(body=[node],type_ignores=[]),'held-final-close3-helper','exec'),g)
rows=[{'path':'/mock','heldFD':1}];assert g['close_bootstrap'](rows)==[{'delegated':True}]and calls==[rows]
RESULTS.append({'name':'qualified_namespace_uses_guarded_close_scope','status':'PASS','scope':'EXECUTOR_SOURCE_MOCK'})
RESULT={'schema':'EXECUTOR_CLOSING_BOOTSTRAP_SOURCE_MOCK','results':RESULTS,'PASS':6,'FAIL':0,'runtimeAuthority':False,'sourceEligibility':False,'nativeEffects':False}
