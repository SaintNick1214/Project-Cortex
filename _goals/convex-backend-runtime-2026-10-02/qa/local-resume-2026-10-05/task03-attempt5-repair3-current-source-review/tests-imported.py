"""Independent imported-current-source controls. Every external effect is mocked.
All simulated private-shaped files are in-memory PUBLIC DUMMY documents.
"""
from pathlib import Path
import ast, copy, hashlib, importlib.util, json, os, sys, types
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
G=R/'_goals/convex-backend-runtime-2026-10-02/qa'
P=G/'local-resume-2026-10-05'; Q=G/'task03-local-native-attempt5-2026-10-06'
J=P/'task03-attempt5-repair3-current-source-review'
PUBLIC=Q/'coordinate-source/repair3/task03-attempt5-public-coordinate.py'
PRIVATE=P/'task03-attempt5-private-source-repair3/task03-attempt5-private-coordinate.py'
RESULTS=[]

def module(path,name):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def put(o,path,value):
    for k in path[:-1]:o=o[k]
    o[path[-1]]=value
def record(name,kind,events,**values):
    RESULTS.append({'name':name,'kind':kind,'assertions':'PASS','events':events,'allExternalEffectsMocked':True,**values})

def public_controls():
    m=module(PUBLIC,'judge_actual_public'); dummy=['PUBLIC_DUMMY_NEVER_EXECUTED']
    initial_fixture=json.loads((Q/'coordinate-source/repair2/task03-attempt5-public-acquisition/copy-initial-inspect.stdout').read_bytes())[0]
    def fixture(mapping='literal'):
        o=copy.deepcopy(initial_fixture);o['Name']='/'+m.NAMES['copy'];o['Config']['Cmd']=['/usr/local/bin/python3.12','-B',*dummy]
        o['HostConfig']['Mounts'][0]['Source']=m.VOLUME
        for mount in o['HostConfig']['Mounts'][1:]:mount['Source']=m.SOURCE_MAPPINGS[mapping]+str(m.Q if mount['Target']=='/input' else m.P)
        for mount in o['Mounts']:
            if mount['Type']=='volume':mount['Name']=m.VOLUME;mount['Source']='/var/lib/docker/volumes/'+m.VOLUME+'/_data'
            else:mount['Source']=m.SOURCE_MAPPINGS[mapping]+str(m.Q if mount['Destination']=='/input' else m.P)
        return o
    def case(name,change=None,terminal_change=None,row_change=None,mapping='literal'):
        initial=fixture(mapping); terminal=copy.deepcopy(initial);events=[];receipts=[]
        if change:change(initial)
        if terminal_change:terminal_change(terminal)
        class Fake:
            @staticmethod
            def run(label,argv,out,timeout,env,required):
                assert required is False and timeout<=120
                events.append({'label':label,'argv':argv,'timeout':timeout})
                row={'terminal':True,'closeErrors':[],'failureClass':None,'exitCode':0}
                if row_change and label=='copy-initial-inspect':row_change(row)
                raw=json.dumps([terminal if label=='copy-terminal-inspect' else initial]).encode() if 'inspect' in label else b'PUBLIC DUMMY RESULT'
                return row,raw,b''
            @staticmethod
            def durable_json(path,value):receipts.append(value)
        m.C=Fake;m.records=[]
        error=None
        try:m.execute('copy','501:20',[],dummy,120)
        except BaseException as e:error=type(e).__name__
        negative=any([change,terminal_change,row_change]);assert (error is not None)==negative,(name,error)
        starts=[x for x in events if x['argv'][1]=='start']; removes=[x for x in events if x['argv'][1]=='rm']
        if change or row_change:assert not starts and not removes
        elif terminal_change:assert len(starts)==1 and not removes
        else:assert len(starts)==len(removes)==1 and receipts[0]['selectedDaemonSourceMapping']==mapping
        record(name,'public-execute',events,expectedReject=negative,exception=error,deniedBeforeStart=bool((change or row_change) and not starts),terminalFailureSticky=bool(terminal_change and error and not removes))
    for mapping in m.SOURCE_MAPPINGS:case('public-valid-'+mapping,mapping=mapping)
    paths=[('HostConfig','ReadonlyRootfs'),('State','Running'),('State','OOMKilled'),('HostConfig','Mounts',0,'VolumeOptions','NoCopy'),('HostConfig','Mounts',1,'ReadOnly'),('HostConfig','Mounts',2,'ReadOnly'),('Mounts',0,'RW'),('Mounts',1,'RW'),('Mounts',2,'RW')]
    for path in paths:
        for value in (0,1,0.0,1.0):case('public-bool-'+str(path)+'-'+repr(value),change=lambda o,p=path,v=value:put(o,p,v))
    mutations={
        'mixed-host':lambda o:put(o,('HostConfig','Mounts',1,'Source'),'/host_mnt'+str(m.Q)),
        'mixed-actual':lambda o:put(o,('Mounts',0,'Source'),'/host_mnt'+str(m.P)),
        'suffix-alias':lambda o:put(o,('HostConfig','Mounts',1,'Source'),'/FOREIGN'+str(m.Q)),
        'parent-path':lambda o:put(o,('HostConfig','Mounts',1,'Source'),str(m.Q.parent)),
        'traversal-path':lambda o:put(o,('HostConfig','Mounts',1,'Source'),str(m.Q)+'/../'+m.Q.name),
        'old-helper':lambda o:put(o,('HostConfig','Mounts',2,'Source'),str(m.P.parent/'repair2')),
        'bind-writable':lambda o:put(o,('HostConfig','Mounts',1,'ReadOnly'),False),
        'actual-writable':lambda o:put(o,('Mounts',0,'RW'),True),
        'duplicate-destination':lambda o:put(o,('Mounts',0,'Destination'),'/input'),
        'mount-cardinality':lambda o:o['HostConfig']['Mounts'].pop(),
        'mount-extra-option':lambda o:o['HostConfig']['Mounts'][1].update(BindOptions={'Propagation':'rshared'}),
        'wrong-image':lambda o:o.update(Image='sha256:'+'f'*64),
        'wrong-label':lambda o:o['Config']['Labels'].update({'cortex.operation':'FOREIGN'}),
        'wrong-name':lambda o:o.update(Name='/FOREIGN'),
        'wrong-user':lambda o:o['Config'].update(User='0:0'),
        'wrong-net':lambda o:o['HostConfig'].update(NetworkMode='host'),
        'wrong-memory':lambda o:o['HostConfig'].update(Memory=1),
        'wrong-swap':lambda o:o['HostConfig'].update(MemorySwap=-1),
        'wrong-cpu':lambda o:o['HostConfig'].update(NanoCpus=1),
        'float-pids':lambda o:o['HostConfig'].update(PidsLimit=64.0)}
    for name,mutation in mutations.items():case('public-'+name,change=mutation)
    for name,mut in [('nonterminal',lambda r:r.update(terminal=False)),('numeric-terminal',lambda r:r.update(terminal=1)),('close-failure',lambda r:r.update(closeErrors=['DUMMY'])),('unknown',lambda r:r.update(failureClass='UNKNOWN')),('boolean-exit',lambda r:r.update(exitCode=False))]:case('public-row-'+name,row_change=mut)
    case('public-terminal-id',terminal_change=lambda o:o.update(Id='1'*64))
    def remap(o):
        for mount in o['HostConfig']['Mounts'][1:]:mount['Source']='/host_mnt'+mount['Source']
        for mount in o['Mounts']:
            if mount['Type']=='bind':mount['Source']='/host_mnt'+mount['Source']
    case('public-terminal-mapping',terminal_change=remap)

def private_object(m,name,selector=False):
    host=[{'Type':'volume','Source':m.VOLUME,'Target':'/owned','VolumeOptions':{'NoCopy':True}}]
    actual=[{'Type':'volume','Name':m.VOLUME,'Destination':'/owned','RW':True}]
    if not selector:
        host.append({'Type':'volume','Source':m.VOLUME,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}})
        actual.append({'Type':'volume','Name':m.VOLUME,'Destination':'/prep','RW':False})
    return {'Name':'/'+name,'Image':m.IMAGE,'Config':{'User':'501:20','Labels':{'cortex.operation':m.OP}},'State':{'Running':False,'ExitCode':0,'OOMKilled':False},'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Memory':536870912,'MemorySwap':536870912,'NanoCpus':2000000000,'PidsLimit':64,'Mounts':host},'Mounts':actual}

def cleanup_controls():
    m=module(PRIVATE,'judge_actual_private_cleanup')
    raw_dir=Q/'coordinate-source/repair2/task03-attempt5-public-acquisition'
    actual=(raw_dir/'final-inspect-init.stdout').read_bytes();assert actual==b'[]\n'
    raw_receipt=json.loads((raw_dir/'final-inspect-init.receipt.json').read_bytes())
    assert raw_receipt['exitCode']==1 and type(raw_receipt['exitCode']) is int and raw_receipt['terminal'] is True and raw_receipt['closeErrors']==[] and raw_receipt['failureClass'] is None
    def case(name,raw=actual,code=1,stderr=None,row_change=None,owned_change=None,post=False,running=False):
        events=[];store={};m.RECORDS=[];obj=private_object(m,m.NAME);obj['State']['Running']=running
        if owned_change:owned_change(obj)
        class Stream:
            def __init__(self,key):self.key=key
            def read_bytes(self):return store[self.key]
        class Log:
            def __truediv__(self,key):return Stream(key)
        m.LOG=Log()
        class Common:
            @staticmethod
            def run(label,argv,log,timeout,env,input_bytes,required,progress):
                assert required is False and timeout==30;events.append({'label':label,'argv':argv})
                row={'terminal':True,'closeErrors':[],'failureClass':None,'exitCode':0};out=err=b''
                absence=('absence-' in label) or ('inspect-' in label and not post)
                if absence:
                    row['exitCode']=code;out=raw;err=stderr if stderr is not None else ('error: no such object: '+m.NAME+'\n').encode()
                    if row_change:row_change(row)
                elif 'inspect-' in label:out=json.dumps([obj]).encode()
                elif 'terminal-' in label:
                    terminal=copy.deepcopy(obj);terminal['State']['Running']=False;out=json.dumps([terminal]).encode()
                store[label+'.stdout']=out;store[label+'.stderr']=err
                return row,out,err
        m.C=Common;error=None
        try:m.cleanup_owned(m.NAME,'dummy')
        except BaseException as e:error=type(e).__name__
        good=raw==actual and type(code) is int and code==1 and stderr is None and row_change is None and owned_change is None
        assert (error is None)==good,(name,error)
        actions=[x['argv'][1] for x in events]
        if not post or owned_change:assert 'kill' not in actions and 'rm' not in actions
        if good and post:assert actions.count('rm')==1 and actions.count('kill')==int(running)
        record(name,'private-cleanup',events,expectedAccept=good,exception=error,qualifiedRawSha256=hashlib.sha256(actual).hexdigest())
    case('private-qualified-actual-absence');case('private-post-remove-actual-absence',post=True);case('private-running-owned',post=True,running=True)
    for post in (False,True):
        for raw in (b'',b'[]',b'[]\r\n',b'[ ]\n',b'[]\nEXTRA',b'{}\n'):case('private-absence-raw-'+repr(raw)+'-'+str(post),raw=raw,post=post)
        for code in (True,1.0,2,None):case('private-absence-exit-'+repr(code)+'-'+str(post),code=code,post=post)
        case('private-absence-foreign-stderr-'+str(post),stderr=b'error: no such object: FOREIGN\n',post=post)
        for name,mut in [('nonterminal',lambda r:r.update(terminal=False)),('numeric-terminal',lambda r:r.update(terminal=1)),('close',lambda r:r.update(closeErrors=['DUMMY'])),('unknown',lambda r:r.update(failureClass='UNKNOWN'))]:case('private-absence-'+name+'-'+str(post),row_change=mut,post=post)
    case('private-cleanup-foreign-label',post=True,owned_change=lambda o:o['Config']['Labels'].update({'cortex.operation':'FOREIGN'}))
    case('private-cleanup-foreign-image',post=True,owned_change=lambda o:o.update(Image='FOREIGN'))
    for selector in (False,True):
        name=m.SELECTOR_NAME if selector else m.NAME;valid=private_object(m,name,selector)
        m.assert_recipe(valid,name,selector);record('private-recipe-valid-'+str(selector),'private-recipe',[])
        paths=[('State','Running'),('HostConfig','ReadonlyRootfs'),('HostConfig','Mounts',0,'VolumeOptions','NoCopy'),('Mounts',0,'RW')]
        if not selector:paths += [('HostConfig','Mounts',1,'VolumeOptions','NoCopy'),('HostConfig','Mounts',1,'ReadOnly'),('Mounts',1,'RW')]
        for path in paths:
            for value in (0,1,0.0,1.0):
                changed=copy.deepcopy(valid);put(changed,path,value);error=None
                try:m.assert_recipe(changed,name,selector)
                except BaseException as e:error=type(e).__name__
                assert error is not None
                record('private-recipe-bool-'+str(selector)+'-'+str(path)+'-'+repr(value),'private-recipe',[],exception=error)

def main_case(name,fault=None):
    m=module(PRIVATE,'judge_main_'+name.replace('-','_'));events=[];commands=[];statuses=[];files={};dirs=set();containers={};clock_calls=[0]
    class VP:
        def __init__(self,p):self.p=str(p)
        def __str__(self):return self.p
        def __truediv__(self,x):return VP(self.p+'/'+str(x))
        def __hash__(self):return hash(self.p)
        def __eq__(self,o):return self.p==str(o)
        def relative_to(self,p):return Path(self.p).relative_to(str(p))
        @property
        def name(self):return Path(self.p).name
        def exists(self):events.append('dummy-exists:'+self.p);return self.p in files or self.p in dirs
        def read_bytes(self):events.append('dummy-read:'+self.p);return files[self.p]
        def read_text(self):return self.read_bytes().decode()
        def mkdir(self,mode=0o700,exist_ok=False):
            assert self.p.startswith(str(J)+'/PUBLIC_DUMMY_MEMORY');events.append('dummy-mkdir:'+self.p)
            if not exist_ok:assert self.p not in dirs
            dirs.add(self.p)
    root=VP(str(J)+'/PUBLIC_DUMMY_MEMORY/'+name)
    m.Path=VP;m.R=root;m.P=root/'public';m.Q=root/'preparation';m.B=root/'source';m.RECIPE=m.Q/'coordinate-source/repair3'
    m.COMMON=m.RECIPE/'task03-attempt5-coordinate-common.py';m.SELECTOR=m.B/'selector.py';m.APPROVAL=m.B/'approval.json'
    m.S=root/'PUBLIC_DUMMY_PRIVATE_SHAPE';m.TOOL=root/'DUMMY_TOOL';m.EXPORT=m.S/'export';m.LOG=m.S/'coordination';m.PUBLIC=m.B/'status'
    m.MGMT=m.P/'management.mjs';m.RETIREMENT=m.P/'retirement.json';m.RECORDS=[]
    files[str(PRIVATE)]=PRIVATE.read_bytes()
    def dump(p,data):files[str(p)]=json.dumps(data).encode()
    binding={'operation':m.OP,'privateEnvironmentFile':str(m.S/'deploy.env'),'requestSha256':'d'*64}
    prep={'verdict':'PASS','independent':True,'scope':'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION','candidateSha256':m.FREEZE,'candidateMembers':1905}
    management={'verdict':'PASS','independent':True,'scope':'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY','managementSourceSha256':m.MANAGEMENT_SHA,'requestSha256':binding['requestSha256']}
    public={'scope':'PUBLIC_RECIPE_BINDING_ONLY_NOT_ACCEPTANCE','preparationFreezeSha256':m.FREEZE,'preparationMembers':1905,'publicCopiedFiles':1912,'sourceBundleExcludedFromPreparationMembership':True,'recipeNamespace':str(m.RECIPE.relative_to(m.R)),'ownedSourceMounts':{'candidate':str(m.Q),'helper':str(m.RECIPE)}}
    docs={str(m.Q/'independent-preparation-review.json'):prep,str(m.P/'task03-attempt5-management-review.json'):management,str(m.RECIPE/'public-recipe-binding.json'):public,str(m.Q/'transport-prep/transport-binding.json'):binding}
    for path in m.dependencies():dump(path,docs.get(str(path),{'publicDummy':True}))
    hard={str(m.Q/'candidate-freeze-attempt5.json'):m.FREEZE,str(m.MGMT):m.MANAGEMENT_SHA,str(m.Q/'transport-prep/private-transport.py'):m.PRIVATE_HELPER_SHA,str(m.SELECTOR):m.SELECTOR_SHA}
    def digest(p):
        events.append('dummy-hash:'+str(p));raw=p.read_bytes();return hard.get(str(p),hashlib.sha256(raw).hexdigest())
    m.digest=digest
    custody={'verdict':'PASS','independent':True,'scope':'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY','candidateSha256':m.FREEZE,'operation':m.OP,'volume':m.VOLUME,'publicFiles':1912,'publicSourceManifestSha256':digest(m.RECIPE/'source-receipt-manifest.json'),'publicRecipeBindingSha256':digest(m.RECIPE/'public-recipe-binding.json'),'allCurrentDestinationIdentities':'PASS_ALL9','currentSourceDestinationFullContent':'PASS'}
    custody_path=m.P/'task03-attempt5-linux-public-custody-review.json'
    if fault=='custody-count':custody['publicFiles']=1911
    if fault=='custody-all9':custody['allCurrentDestinationIdentities']='FAIL'
    if fault=='custody-content':custody['currentSourceDestinationFullContent']='FAIL'
    if fault=='custody-manifest':custody['publicSourceManifestSha256']='0'*64
    if fault=='custody-source-only':custody['scope']='TASK03_FIXED_RECIPE_COORDINATOR_SOURCE_ONLY'
    dump(custody_path,custody)
    approval={'verdict':'PASS','independent':True,'scope':'TASK03_FIXED_RECIPE_COORDINATOR_SOURCE_ONLY','coordinatorSha256':hashlib.sha256(files[str(PRIVATE)]).hexdigest(),'freezeSha256':m.FREEZE,'dependencies':{str(p.relative_to(m.R)):digest(p) for p in m.dependencies()}}
    if fault=='dependency-missing':approval['dependencies'].pop(next(iter(approval['dependencies'])))
    if fault=='dependency-extra':approval['dependencies']['EXTRA']='0'*64
    dump(m.APPROVAL,approval)
    if fault=='approval-absent':del files[str(m.APPROVAL)]
    if fault=='custody-absent':del files[str(custody_path)]
    if fault=='dependency-drift':files[str(m.COMMON)]+=b'DRIFT'
    if fault=='target-exists':dump(m.S/'target.json',{'dummy':True})
    events.clear()
    def close(fd):
        events.append('close:'+str(fd))
        if fault=='close' and fd==9101:raise OSError('PUBLIC DUMMY CLOSE FAILURE')
    m.os=types.SimpleNamespace(environ={'PATH':'PUBLIC_DUMMY'},getuid=lambda:501,getgid=lambda:20,close=close)
    m.signal=types.SimpleNamespace(SIGTERM=15,SIGINT=2,SIG_IGN=1,signal=lambda *args:events.append('signal:'+str(args)))
    def clock():clock_calls[0]+=1;return clock_calls[0]*(2500 if fault=='deadline' else .1)
    m.time=types.SimpleNamespace(monotonic=clock,sleep=lambda seconds:events.append('wait'))
    def status(phase,result,**fields):events.append('status:'+phase);statuses.append({'phase':phase,'status':result,**fields})
    m.status=status
    class C:
        @staticmethod
        def durable_json(p,data):
            events.append('durable:'+p.name);dump(p,data)
            if p.name=='host-source-custody.json':dump(m.LOG/'coordinator-finish.json',{'operation':m.OP,'finish':True})
        @staticmethod
        def run(label,argv,directory,timeout,env,input_bytes=None,required=None,progress=None):
            assert required is False and timeout<=190;assert all('/.codex/tmp/' not in str(x) for x in argv)
            events.append('command:'+label);commands.append({'label':label,'argv':[str(x) for x in argv],'timeout':timeout,'stdinBytes':len(input_bytes) if input_bytes is not None else 0})
            row={'terminal':True,'closeErrors':[],'failureClass':None,'exitCode':0};out=err=b''
            if argv[:3]==['docker','ps','--quiet']:pass
            elif argv[:3]==['docker','volume','inspect']:out=json.dumps([{'Name':m.VOLUME,'Labels':{'cortex.operation':m.OP,'cortex.goal':'convex-backend-runtime-2026-10-02'},'Driver':'local','Scope':'local','Options':None}]).encode()
            elif argv[:2]==['docker','create']:
                owned=argv[argv.index('--name')+1];containers[owned]=private_object(m,owned,owned==m.SELECTOR_NAME)
            elif argv[:2]==['docker','inspect']:
                owned=argv[2]
                if owned not in containers:row['exitCode']=1;out=b'[]\n';err=('error: no such object: '+owned+'\n').encode()
                else:
                    obj=copy.deepcopy(containers[owned])
                    if label=='private-receiver-initial-inspect' and fault=='recipe':obj['HostConfig']['Mounts'][1]['VolumeOptions']['NoCopy']=1
                    if label=='private-receiver-terminal-inspect' and fault=='terminal':obj['State']['OOMKilled']=True
                    if label.startswith('final-inspect-') and owned==m.NAME and fault=='foreign-cleanup':obj['Config']['Labels']['cortex.operation']='FOREIGN'
                    out=json.dumps([obj]).encode()
            elif argv[:2]==['docker','start']:
                if progress:progress()
                if label=='private-receiver':
                    out=json.dumps({'status':'PASS','sourceFiles':4,'copiedFiles':3,'nativeAllNineAndFullContents':True,'scope':'PUBLIC_DUMMY_NATIVE_SOURCE_THEN_UNCHANGED_HELPER'}).encode()
                    if fault=='transport-unknown':row['terminal']=False
                else:out=json.dumps({'status':'PASS','historicalCustodyRepaired':False,'targetAbsent':False,'retiredSelectorInvalidated':True}).encode()
            elif argv[:2]==['docker','kill']:
                assert containers[argv[2]]['Config']['Labels']['cortex.operation']==m.OP;containers[argv[2]]['State']['Running']=False
            elif argv[:2]==['docker','rm']:
                assert containers[argv[2]]['Config']['Labels']['cortex.operation']==m.OP;del containers[argv[2]]
            elif argv[-1]=='provision':
                events.append('mock-api:provision');before={'operation':m.OP,'active':True,'retired':False,'deleted':False};dump(m.S/'target.json',before)
                if fault=='provision-unknown':row['terminal']=False
            elif argv[-1]=='retire':
                events.append('mock-api:retire')
                if fault=='retirement':row['exitCode']=1
                else:
                    dump(m.RETIREMENT,{'operation':m.OP,'requestSha256':binding['requestSha256'],'retired':True,'deleted':True,'deletionHttpStatus':200,'verificationHttpStatus':404,'productionMutations':0})
                    before=json.loads((m.S/'target.json').read_bytes());dump(m.S/'target-pre-retirement.json',before);dump(m.S/'target.json',{**before,'retired':True,'deleted':True,'active':False})
            else:raise AssertionError('unmodeled external effect '+str(argv))
            files[str(directory/(label+'.stdout'))]=out;files[str(directory/(label+'.stderr'))]=err
            return row,out,err
    keys=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');ident={k:'0' for k in keys}
    rows=[{'name':'PUBLIC_DUMMY_'+str(i),'fd':9000+i,'identity':ident,'bytes':b'PUBLIC DUMMY','sha256':'0'*64} for i in range(3)]
    class T:
        NAMES=tuple(x['name'] for x in rows)
        @staticmethod
        def open_sources(p,names):events.append('mock-private-open');return p,'DUMMY_DIRECTORY',9099,rows
        @staticmethod
        def copy_private(p,d,binding,stage):
            assert stage is True;events.append('mock-private-stage')
            if fault=='foreign-cleanup':raise ValueError('PUBLIC DUMMY STAGE FAILURE BEFORE FOREIGN CLEANUP')
            return {'status':'PASS','mocked':True}
        @staticmethod
        def verify_sources(*args):
            events.append('verify-source')
            if fault=='late-source' and events.count('verify-source')==3:raise ValueError('PUBLIC DUMMY LATE SOURCE DRIFT')
        @staticmethod
        def identity(x):return ident
    class Producer:
        def __init__(self,p,binding):
            self.before='DUMMY';self.rows=[{**rows[i%3],'fd':9100+i} for i in range(4)];self.root_fd=9199;self.closed=False;events.append('mock-producer-open')
        def frames(self):yield b'PUBLIC DUMMY FRAMES'
        def verify(self):
            events.append('verify-stage')
            if fault=='stage-drift':raise ValueError('PUBLIC DUMMY STAGE DRIFT')
    A=types.SimpleNamespace(T=T,HeldProducer=Producer,MAX_TOTAL=327692,strict_json=m.strict_json)
    def load(name,p):events.append('mock-load:'+str(p));return C if p==m.COMMON else A
    m.load_module=load;exception=None
    try:m.main()
    except BaseException as e:exception=type(e).__name__
    expected=fault is None;assert (exception is None)==expected,(name,exception,events)
    early={'approval-absent','custody-absent','dependency-missing','dependency-extra','dependency-drift','custody-count','custody-all9','custody-content','custody-manifest','custody-source-only','target-exists'}
    if fault in early:
        assert not commands and not any(e.startswith('mock-api:') or e=='mock-private-open' for e in events)
        if fault!='target-exists':assert not any(e.startswith('dummy-exists:'+str(m.S)) or e.startswith('dummy-read:'+str(m.S)) for e in events)
    if fault=='recipe':assert 'mock-api:provision' not in events and 'mock-private-open' not in events
    if 'mock-api:provision' in events:
        assert 'mock-api:retire' in events and events.index('mock-api:retire')>events.index('mock-api:provision')
        for owned in m.OWNED_NAMES:assert any(c['label']=='final-inspect-'+owned for c in commands)
    if fault in ('provision-unknown','transport-unknown'):assert any(r['terminal'] is False for r in m.RECORDS)
    if statuses and not expected:assert statuses[-1]['status']=='FAIL'
    fds=[9100,9101,9102,9103,9199,9000,9001,9002,9099]
    if expected or fault in ('close','late-source','stage-drift','transport-unknown','terminal','deadline','retirement'):
        assert all(events.count('close:'+str(fd))==1 for fd in fds)
    if expected:
        window=events.index('status:ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW');last_verify=max(i for i,e in enumerate(events) if e=='verify-source')
        durable=events.index('durable:host-source-custody.json');assert durable<last_verify<window
        assert all(last_verify<events.index('close:'+str(fd))<window for fd in fds)
        assert not containers and statuses[-1]['status']=='PASS' and events.count('mock-api:retire')==1
    if fault in ('close','late-source','stage-drift','transport-unknown','terminal'):assert not any(s['phase']=='ACTUAL_PRIVATE_TRANSFER_AWAITING_INDEPENDENT_REVIEW' for s in statuses)
    if fault=='foreign-cleanup':assert m.NAME in containers and not any(c['argv'][:3]==['docker','rm',m.NAME] for c in commands if c['label'].startswith('final-'))
    assert not any(c['argv'][-1] in ('deploy','driver') for c in commands)
    record(name,'private-actual-main',events,fault=fault,exception=exception,expectedOutcome='PASS' if expected else 'FAIL',commands=commands,statuses=statuses,remainingMockContainers=sorted(containers),realPrivateReads=0,realPrivateStats=0)

def static_controls():
    old=P/'task03-attempt5-private-source-repair2/task03-attempt5-private-coordinate.py'
    before=ast.parse(old.read_bytes());after=ast.parse(PRIVATE.read_bytes());changed=[]
    for a,b in zip(before.body,after.body):
        if ast.dump(a,include_attributes=False)!=ast.dump(b,include_attributes=False):
            if isinstance(a,ast.FunctionDef):
                assert a.name==b.name=='cleanup_owned';fixed=copy.deepcopy(a);constants=[n for n in ast.walk(fixed) if isinstance(n,ast.Constant) and n.value==b''];assert len(constants)==2
                for n in constants:n.value=b'[]\n'
                assert ast.dump(fixed,include_attributes=False)==ast.dump(b,include_attributes=False);changed.append('cleanup_owned:two-qualified-stdout-literals')
            else:assert isinstance(a,ast.Assign) and a.targets[0].id==b.targets[0].id;changed.append(a.targets[0].id)
    assert len(before.body)==len(after.body) and changed==['B','RECIPE','VOLUME','cleanup_owned:two-qualified-stdout-literals']
    for name in ('task03-attempt5-coordinate-common.py','task03-attempt5-linux-public-transfer.py'):
        assert (Q/'coordinate-source/repair3'/name).read_bytes()==(Q/'coordinate-source/repair2'/name).read_bytes()
    assert (P/'task03-attempt5-private-source-repair3/task03-attempt5-retire-selector.py').read_bytes()==(P/'task03-attempt5-private-source-repair2/task03-attempt5-retire-selector.py').read_bytes()
    m=module(PRIVATE,'judge_preflight');reads=[];original=Path.read_bytes
    def safe_read(p):
        assert not str(p).startswith(str(m.S));reads.append(str(p));return original(p)
    Path.read_bytes=safe_read
    try:
        denied=False
        try:m.preflight()
        except FileNotFoundError as e:denied=e.filename==str(m.APPROVAL)
        assert denied and reads==[str(m.APPROVAL)]
    finally:Path.read_bytes=original
    assert len(m.dependencies())==len(set(m.dependencies()))==12
    record('exact-static-delta-and-real-held-preflight','static',reads,changed=changed,realPrivateReads=0,realPrivateStats=0)

static_controls();public_controls();cleanup_controls()
for fault in [None,'approval-absent','custody-absent','dependency-missing','dependency-extra','dependency-drift','custody-count','custody-all9','custody-content','custody-manifest','custody-source-only','target-exists','recipe','provision-unknown','transport-unknown','terminal','close','late-source','stage-drift','deadline','retirement','foreign-cleanup']:
    main_case('main-'+(fault or 'happy'),fault)
result={'scope':'FRESH_INDEPENDENT_IMPORTED_REPAIR3_CURRENT_SOURCE_CONTROLS_ONLY','status':'PASS','controls':len(RESULTS),
        'sourceHashes':{str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (PUBLIC,PRIVATE)},
        'counts':{k:sum(x['kind']==k for x in RESULTS) for k in sorted(set(x['kind'] for x in RESULTS))},'cases':RESULTS,
        'allExternalEffectsExplicitlyMocked':True,'actualDockerCalls':0,'actualAPICalls':0,'privateScratchReads':0,'privateScratchStats':0,'realApprovalsWritten':False}
out=J/'fresh-imported-controls.json';assert not out.exists();out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='cases'}))
