"""Independent held-byte SOURCE_ONLY controls. No entry dispatch or Docker."""
import ast, hashlib, json, os, math, time, termios
from pathlib import Path
R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
U = P / 'task03-attempt6-actual-public-custody-readiness-repair2'
OLD = P / 'task03-attempt6-actual-public-custody-readiness-review1'
Q = R / '_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06'
rows=[]
def check(name, value, detail=None):
    rows.append({'name':name,'pass':bool(value),'detail':detail})
def body(path): return DATA[str(path)]
def sha(raw): return hashlib.sha256(raw).hexdigest()
original = body(Q/'integrated/coordinate-common.py')
adapted = body(U/'coordinate-common-highfd.py')
helper = 'def control_readable(control, wait):\n    with selectors.DefaultSelector() as readiness:\n        readiness.register(control, selectors.EVENT_READ)\n        return bool(readiness.select(wait))\n\n'
text=original.decode()
check('one-helper-insertion-site',text.count('def anchor_main(fd, argv):\n')==1)
text=text.replace('def anchor_main(fd, argv):\n',helper+'def anchor_main(fd, argv):\n')
for i,(old,new) in enumerate([
 ('select.select([control],[],[],0.02)[0]','control_readable(control,0.02)'),
 ('select.select([control],[],[],wait)[0]','control_readable(control,wait)'),
 ('select.select([control],[],[],max(0,ready_deadline-time.monotonic()))[0]','control_readable(control,max(0,ready_deadline-time.monotonic()))')]):
    check('single-original-readiness-site-'+str(i),text.count(old)==1)
    text=text.replace(old,new)
check('exact-common-transform-and-every-other-byte-conserved',text.encode()==adapted)
for name in ['linux-public-observer.py','linux-dependency-observer.mjs']:
    check('observer-exact-original-copy-'+name,body(OLD/name)==body(U/name))
tree=ast.parse(body(U/'run-actual-review.py'))
funcs={x.name:x for x in tree.body if isinstance(x,(ast.FunctionDef,ast.AsyncFunctionDef))}
ns={'json':json,'Path':Path,'hashlib':hashlib,'os':os,'time':time,'stat':__import__('stat'),
    'SOURCE_GRAPH_MAX_FILES':4096,'SOURCE_GRAPH_MAX_BYTES':67108864,'SOURCE_GRAPH_MAX_FILE_BYTES':16777216,
    'SOURCE_GRAPH_MAX_FILE':16777216,'source_graph_members':{},'source_graph_bytes':0}
exec(compile(ast.Module(body=[funcs['reserve_source_graph'],funcs['strict']],type_ignores=[]),'<verified-U2-isolated-functions>','exec'),ns)
reserve=ns['reserve_source_graph']
for i in range(4): reserve('/independent/source/'+str(i),16777216)
check('aggregate-exact64MiB-positive',ns['source_graph_bytes']==67108864)
reserve('/independent/source/0',16777216)
check('same-size-dedup-no-reset',ns['source_graph_bytes']==67108864 and len(ns['source_graph_members'])==4)
for name,path,size in [('aggregate-extra-control-byte','/independent/control',1),('perfile-plus-one','/independent/large',16777217),('duplicate-size-drift','/independent/source/0',0),('bool-size','/independent/bool',True),('float-size','/independent/float',1.0),('negative-size','/independent/negative',-1)]:
    old=(dict(ns['source_graph_members']),ns['source_graph_bytes']); reason=None
    try: reserve(path,size)
    except AssertionError as e: reason=str(e)
    check(name+'-denied-before-state-change',reason is not None and old==(ns['source_graph_members'],ns['source_graph_bytes']),reason)
countns={**ns,'source_graph_members':{},'source_graph_bytes':0}
exec(compile(ast.Module(body=[funcs['reserve_source_graph']],type_ignores=[]),'<separate-independent-count-boundary>','exec'),countns)
for i in range(4096):countns['reserve_source_graph']('/independent/count/'+str(i),0)
reason=None
try:countns['reserve_source_graph']('/independent/count/4096',0)
except AssertionError as e:reason=str(e)
check('4096-positive4097-negative',len(countns['source_graph_members'])==4096 and reason=='source_graph_descriptor_ceiling',reason)
strict=ns['strict']
for raw in ['{"x":NaN}','{"x":Infinity}','{"x":-Infinity}','{"x":1,"x":2}']:
    denied=False
    try:strict(raw)
    except (ValueError,AssertionError):denied=True
    check('strict-special-or-duplicate-'+raw,denied)
value=strict('{"sourceRows":1e309,"sourceBytes":-1e309}')
check('numeric-overflow-parser-demonstrated',math.isinf(value['sourceRows']) and math.isinf(value['sourceBytes']), 'Not by itself an acceptance bypass; independently test actual typed gates.')
top=next(x for x in tree.body if isinstance(x,ast.Try))
guards=[]
for node in ast.walk(top):
    if isinstance(node,ast.Assert):
        text=ast.get_source_segment(body(U/'run-actual-review.py').decode(),node)
        if "H['sourceRows']" in text or "H['sourceBytes']" in text: guards.append(node)
check('actual-handoff-count-guards-found',len(guards)>=2,[ast.unparse(g) for g in guards])
for field in ['sourceRows','sourceBytes']:
    relevant=[g for g in guards if field in ast.unparse(g)]
    for value in [float('inf'),-float('inf'),True,1.0,[],{}]:
        h={'sourceRows':1,'sourceBytes':1,field:value}; denied=False
        try:exec(compile(ast.Module(body=relevant,type_ignores=[]),'<actual-typed-handoff-guards>','exec'),{**ns,'H':h})
        except (AssertionError,TypeError):denied=True
        check('handoff-'+field+'-'+type(value).__name__+'-'+repr(value)+'-denied',denied)
summary=json.loads(body(U/'highfd-controls1/controls-summary.json'))
actual=[]
for command in summary['commands']:
    label=command['label']; raw=body(U/'highfd-controls1'/(label+'.receipt.json'))
    row=json.loads(raw); out=body(U/'highfd-controls1'/(label+'.stdout'));err=body(U/'highfd-controls1'/(label+'.stderr'))
    valid=row==command and sha(out)==row['stdoutSha256'] and sha(err)==row['stderrSha256'] and len(out)<=262144 and len(err)<=262144
    valid=valid and row['closeErrors']==[] and row['ownedGroup']['absenceObserved'] is True and row['ownedGroup']['unknownOwnershipNeverSignaled'] is True
    if 'missing' not in label: valid=valid and row['terminal'] is True
    else:valid=valid and row['terminal'] is False and row['failureClass']=='FileNotFoundError'
    check('author-host-raw-receipt-consistent-'+label,valid)
    actual.append({'label':label,'exitCode':row['exitCode'],'failureClass':row['failureClass'],'bytes':[len(out),len(err)],'elapsedSeconds':row['elapsedSeconds'],'terminal':row['terminal']})
check('author-exact11-receipt-cohort',len(actual)==11)
fixture=Path(REVIEW_DIR)/'verified-common-host-fixture.py'
fd=os.open(fixture,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
try:
    data=memoryview(adapted)
    while data:
        n=os.write(fd,data); assert n>0;data=data[n:]
    os.fsync(fd)
finally:os.close(fd)
stop={'scope':'INDEPENDENT_OWN_FINITE_EXACT_COMMON_FIXTURE_WRITERS_STOPPED','path':str(fixture),'bytes':len(adapted),'sha256':sha(adapted),'stoppedNs':str(time.time_ns()),'remainingWrites':[],'noU2SourceWrites':True}
path=Path(REVIEW_DIR)/'host-fixture-writer-stop.json'
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
try:os.write(fd,(json.dumps(stop,indent=2)+'\n').encode());os.fsync(fd)
finally:os.close(fd)
# PTY transport only: avoid canonical line clipping when publishing a long report.
attrs=termios.tcgetattr(0);attrs[3]&=~(termios.ICANON|termios.ECHO);termios.tcsetattr(0,termios.TCSANOW,attrs)
RESULT={'scope':'INDEPENDENT_SOURCE_AND_RETAINED_RAW_CONTROLS_ONLY','controls':rows,'pass':sum(r['pass'] for r in rows),'fail':sum(not r['pass'] for r in rows),'authorHostReceipts':actual,'hostFixtureStop':stop,'selectedFunctionSource':{n:ast.get_source_segment(body(U/'run-actual-review.py').decode(),funcs[n]) for n in ['capture','qualify','command','compressed']},'topFinalizerSource':[ast.get_source_segment(body(U/'run-actual-review.py').decode(),x) for x in top.finalbody],'dockerCalls':0,'sourceEligibility':False,'fullTask03':False,'fullGoal':False}
