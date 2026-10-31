"""Extract only reviewed host monitor functions; all CLI effects substituted."""
import ast
import copy
import hashlib
import json
from pathlib import Path
import sys
import types

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
B=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
D=Path(__file__).resolve().parent
P=B/'task04-current-producer-repair1-parent-preparation'
source=Path(sys.argv[1]);raw=source.read_bytes();tree=ast.parse(raw)
checks=[];errors=[]
def require(ok,reason):
    if not ok:raise RuntimeError(reason)
def no(name,fn,token):
    try:fn()
    except (RuntimeError,ValueError)as error:
        assert token in str(error),(name,str(error),token);checks.append({'name':name,'status':'PASS','denial':str(error)});return
    raise AssertionError('adverse accepted:'+name)
try:
    m=types.ModuleType('mock_monitor_metadata');module=(P/'metadata-module.py').read_bytes();exec(compile(module,str(P/'metadata-module.py'),'exec'),m.__dict__)
    c=json.loads((P/'mocked-fixture.json').read_bytes());recipe=json.loads((R/'work/resume/task04-c8-current-canonical-input-producers/repair1/proposal/recipe.json').read_bytes());cid=c['Id'];state={'current':copy.deepcopy(c)};calls=[]
    def fake_capture(label,argv,maximum=65536):
        assert argv==['docker','container','inspect',cid];calls.append(argv)
        return {'exitCode':0},(json.dumps([state['current']])+'\n').encode(),b''
    ns={'require':require,'capture':fake_capture,'metadata':m,'recipe':recipe,'CID':cid,'poll_bytes':0,'json':json}
    inspect_node=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='inspect')
    exec(compile(ast.Module(body=[inspect_node],type_ignores=[]),str(source),'exec'),ns)
    returned=ns['inspect']('mock-created',created=True);assert returned['Id']==cid and ns['poll_bytes']==len((json.dumps([c])+'\n').encode())
    checks.append({'name':'mock-current-created-guard-accepts-exact-owned-metadata','status':'PASS','inspectBytes':ns['poll_bytes']})
    state['current']['HostConfig']['OomKillDisable']=None;state['current']['State'].update(Status='running',Running=True,Pid=123)
    returned=ns['inspect']('mock-running');assert returned['HostConfig']['OomKillDisable']is None
    checks.append({'name':'mock-monitor-accepts-only-raw-unset-null-transition','status':'PASS','rawOomKillDisable':None})
    state['current']['HostConfig']['Memory']=2147483648;before=ns['poll_bytes'];size=len((json.dumps([state['current']])+'\n').encode())
    no('monitor-resource-failure-guard-still-denies',lambda:ns['inspect']('mock-resource-failure'),'exact required guard')
    assert ns['poll_bytes']==before+size
    checks.append({'name':'failed-metadata-inspect-bytes-counted-before-rejection','status':'PASS','byteDelta':size})
    returned=ns['inspect']('mock-known-own-cleanup',full=False);assert returned['Id']==cid
    checks.append({'name':'own-only-cleanup-query-retains-known-target-after-resource-denial','status':'PASS','containerId':cid})
    state['current']['Config']['Labels']['com.cortex.operation']='FOREIGN'
    no('ownership-only-cleanup-refuses-foreign-UUID',lambda:ns['inspect']('mock-foreign-cleanup',full=False),'exact owned')
    state['current']=copy.deepcopy(c);ns['poll_bytes']=33554432
    no('32MiB-inspect-aggregate-fails-before-next-guard',lambda:ns['inspect']('mock-over-bound'),'combined owned-inspect bytes')
    assert ns['poll_bytes']>33554432
    # capture's receipt validation runs with completely substituted subprocess/read.
    stdout=b'MOCK_INSPECT\n';stderr=b'';argv=['docker','container','inspect',cid]
    receipt={'argv':argv,'terminal':True,'failureClass':None,'closeErrors':[],'ownedGroup':{'absenceObserved':True},'stdinBytes':0,'elapsedSeconds':30,'exitCode':0,'streamByteCounts':{'stdout':len(stdout),'stderr':0},'stdoutSha256':hashlib.sha256(stdout).hexdigest(),'stderrSha256':hashlib.sha256(stderr).hexdigest()}
    selected={'receipt':copy.deepcopy(receipt)}
    fake_subprocess=types.SimpleNamespace(run=lambda *a,**k:types.SimpleNamespace(returncode=0))
    def fake_read(path,maximum=65536):
        value=stdout if str(path).endswith('.stdout')else stderr;assert len(value)<=maximum;return value,{}
    ns2={'require':require,'subprocess':fake_subprocess,'sys':types.SimpleNamespace(executable='MOCK_PYTHON'),'ADAPTER':Path('/MOCK_ADAPTER'),'data':lambda path:selected['receipt'],'OUT':Path('/MOCK_OUTPUT'),'read':fake_read,'hashlib':hashlib}
    capture_node=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='capture');exec(compile(ast.Module(body=[capture_node],type_ignores=[]),str(source),'exec'),ns2)
    result=ns2['capture']('mock-cli',argv);assert result[0]['elapsedSeconds']==30 and result[1]==stdout
    checks.append({'name':'bounded-CLI-exact-terminal-and-byte-proof-accepted','status':'PASS','seconds':30})
    for name,mutate,token in [
        ('nonterminal',lambda x:x.update(terminal=False),'known bounded terminal CLI'),
        ('unknown-owner',lambda x:x['ownedGroup'].update(absenceObserved=False),'known bounded terminal CLI'),
        ('late',lambda x:x.update(elapsedSeconds=30.001),'known bounded terminal CLI'),
        ('bool-exit',lambda x:x.update(exitCode=False),'actual CLI byte proof'),
        ('byte-count',lambda x:x['streamByteCounts'].update(stdout=0),'actual CLI byte proof'),
        ('byte-hash',lambda x:x.update(stdoutSha256='f'*64),'actual CLI byte proof'),
        ('wrong-argv',lambda x:x.update(argv=['docker','container','inspect','foreign']),'known bounded terminal CLI'),
        ('cleanup-errors',lambda x:x.update(closeErrors=['unknown']),'known bounded terminal CLI')]:
        selected['receipt']=copy.deepcopy(receipt);mutate(selected['receipt']);no('mock-CLI-'+name,lambda:ns2['capture']('mock-cli-adverse',argv),token)
except BaseException as error:errors.append(repr(error))
result={'scope':'INDEPENDENT_PARENT_MONITOR_FUNCTION_AND_SUBSTITUTED_CLI_CONTROLS_ONLY','status':'PASS'if not errors else'FAIL','driver':str(source),'driverSHA256':hashlib.sha256(raw).hexdigest(),'checks':checks,'count':len(checks),'errors':errors,'effects':'SUBSTITUTED_NO_DOCKER','activation':'NOT_GRANTED_BY_THESE_CHECKS','actualPipelineExecuted':0,'native':False,'Task03':'HELD','Task04':'OPEN','wholeGoal':'OPEN'}
with(D/('monitor-controls-'+sys.argv[2]+'.json')).open('x')as f:f.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'checks':len(checks),'errors':errors}));raise SystemExit(bool(errors))
