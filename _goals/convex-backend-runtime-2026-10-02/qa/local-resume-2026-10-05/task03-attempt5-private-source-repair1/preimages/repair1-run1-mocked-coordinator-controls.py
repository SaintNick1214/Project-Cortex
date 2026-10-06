"""Actual candidate main/preflight flow; ALL external effects explicitly fake.

Synthetic approval/source hashes exist only in per-case public fixture roots.
No production attestation is written, no Docker subprocess or API is invoked,
and no path in the real private scratch/config directory is read or inspected.
"""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import os
import types

B = Path(__file__).resolve().parent
SOURCE = B/'task03-attempt5-private-coordinate.py'
RESULTS = []


def load_candidate():
    spec = importlib.util.spec_from_file_location('private_candidate_mock', SOURCE)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2)+'\n')


def scenario(name, mutation=None, fault=None, expected='FAIL', no_provision=False):
    m = load_candidate(); root = B/'fixtures'/name
    root.mkdir(mode=0o700)
    events = []; commands = []; containers = {}; statuses = []; calls = {'clock': 0}
    m.R=root; m.P=root/'public'; m.Q=root/'preparation'; m.B=root/'source-bundle'
    m.RECIPE=m.Q/'coordinate-source/repair2'; m.COMMON=m.RECIPE/'task03-attempt5-coordinate-common.py'
    m.SELECTOR=m.B/'selector.py'; m.APPROVAL=m.B/'independent-source-review.json'
    m.S=root/'PUBLIC_DUMMY_PRIVATE_SHAPE'; m.S.mkdir(mode=0o700)
    m.EXPORT=m.S/('export-'+m.OP); m.LOG=m.S/'coordination'; m.PUBLIC=m.B/'status.json'
    m.MGMT=m.P/'management.mjs'; m.RETIREMENT=m.P/'retirement.json'; m.RECORDS=[]
    m.os=types.SimpleNamespace(**{key:getattr(os,key) for key in dir(os) if not key.startswith('__')})
    m.os.getuid=lambda:501; m.os.getgid=lambda:20
    m.os.close=lambda fd: (events.append('fake-source-close:'+str(fd)), (_ for _ in ()).throw(OSError('MOCK_CLOSE_FAILURE')) if fault=='descriptor-close' and fd==9001 else None)[1]
    m.signal=types.SimpleNamespace(SIGTERM=15,SIGINT=2,SIG_IGN=1,
        signal=lambda *args: (events.append('fake-signal:'+str(args[0])), (_ for _ in ()).throw(OSError('MOCK_SIGNAL_FAILURE')) if fault=='signal-cleanup' and args[1]==1 else None)[1])
    def clock():
        calls['clock']+=1
        return calls['clock']*(2500 if fault=='wait-deadline' else 0.1)
    m.time=types.SimpleNamespace(monotonic=clock,sleep=lambda seconds:events.append('fake-wait'))
    def status(phase,result,**fields):
        events.append('fake-status:'+phase); statuses.append({'phase':phase,'status':result,**fields})
        if fault=='failure-status' and phase=='COORDINATOR_FAILURE_RETIREMENT_REQUIRED':
            raise OSError('MOCK_STATUS_FAILURE')
    m.status=status
    binding={'operation':m.OP,'privateEnvironmentFile':str(m.S/'deploy.env'),'requestSha256':'d'*64}
    prep={'verdict':'PASS','independent':True,'scope':'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION',
          'candidateSha256':m.FREEZE,'candidateMembers':1905}
    management={'verdict':'PASS','independent':True,'scope':'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY',
                'managementSourceSha256':m.MANAGEMENT_SHA,'requestSha256':binding['requestSha256']}
    public={'scope':'PUBLIC_RECIPE_BINDING_ONLY_NOT_ACCEPTANCE','preparationFreezeSha256':m.FREEZE,
            'preparationMembers':1905,'publicCopiedFiles':1912,'sourceBundleExcludedFromPreparationMembership':True,
            'recipeNamespace':str(m.RECIPE.relative_to(m.R)),
            'ownedSourceMounts':{'candidate':str(m.Q),'helper':str(m.RECIPE)}}
    documents={m.Q/'independent-preparation-review.json':prep,m.P/'task03-attempt5-management-review.json':management,
               m.RECIPE/'public-recipe-binding.json':public,m.Q/'transport-prep/transport-binding.json':binding}
    for path in m.dependencies():
        dump(path,documents.get(path,{'mockedPublicSource':str(path.relative_to(root))}))
    original_digest=m.digest
    hard={m.Q/'candidate-freeze-attempt5.json':m.FREEZE,m.MGMT:m.MANAGEMENT_SHA,
          m.Q/'transport-prep/private-transport.py':m.PRIVATE_HELPER_SHA,m.SELECTOR:m.SELECTOR_SHA}
    def digest(path):
        events.append('mock-source-hash:'+str(path.relative_to(root)) if path.is_relative_to(root) else 'actual-candidate-hash')
        return hard.get(path,original_digest(path))
    m.digest=digest
    custody={'verdict':'PASS','independent':True,'scope':'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY',
             'candidateSha256':m.FREEZE,'operation':m.OP,'volume':m.VOLUME,'publicFiles':1912,
             'publicSourceManifestSha256':digest(m.RECIPE/'source-receipt-manifest.json'),
             'publicRecipeBindingSha256':digest(m.RECIPE/'public-recipe-binding.json'),
             'allCurrentDestinationIdentities':'PASS_ALL9','currentSourceDestinationFullContent':'PASS'}
    dump(m.P/'task03-attempt5-linux-public-custody-review.json',custody)
    approval={'verdict':'PASS','independent':True,'scope':'TASK03_FIXED_RECIPE_COORDINATOR_SOURCE_ONLY',
              'coordinatorSha256':original_digest(SOURCE),'freezeSha256':m.FREEZE,
              'dependencies':{str(path.relative_to(root)):digest(path) for path in m.dependencies()}}
    if mutation:
        mutation(m,approval,prep,management,custody,public,binding)
        for path,value in [(m.Q/'independent-preparation-review.json',prep),(m.P/'task03-attempt5-management-review.json',management),
                           (m.P/'task03-attempt5-linux-public-custody-review.json',custody),
                           (m.RECIPE/'public-recipe-binding.json',public),(m.Q/'transport-prep/transport-binding.json',binding)]:
            dump(path,value)
        # Model separately approved but semantically wrong review/binding hashes:
        # only semantic-guard cases update these hashes; hash-drift does not.
        if name != 'dependency-hash-drift':
            for path in m.dependencies():
                key=str(path.relative_to(root))
                if key in approval['dependencies']:
                    approval['dependencies'][key]=digest(path)
    dump(m.APPROVAL,approval)
    if fault=='approval-absent': m.APPROVAL.unlink()
    if fault=='target-exists': dump(m.S/'target.json',{'publicDummy':True})
    if fault=='retirement-exists': dump(m.RETIREMENT,{'publicDummy':True})
    events.clear()

    def object_for(container_name,selector=False):
        mounts=[{'Type':'volume','Source':m.VOLUME,'Target':'/owned','VolumeOptions':{'NoCopy':True}}]
        view=[{'Type':'volume','Name':m.VOLUME,'Destination':'/owned','RW':True}]
        if not selector:
            mounts.append({'Type':'volume','Source':m.VOLUME,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}})
            view.append({'Type':'volume','Name':m.VOLUME,'Destination':'/prep','RW':False})
        return {'Name':'/'+container_name,'Image':m.IMAGE,
                'Config':{'Labels':{'cortex.operation':m.OP},'User':'501:20'},
                'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Memory':536870912,'MemorySwap':536870912,
                              'PidsLimit':64,'NanoCpus':2000000000,'Mounts':mounts},'Mounts':view,
                'State':{'Running':False,'ExitCode':0,'OOMKilled':False}}

    class FakeCommon:
        @staticmethod
        def durable_json(path,value):
            events.append('fake-durable:'+path.name)
            if fault=='terminal-receipt' and path.name=='coordinator-terminal.json': raise OSError('MOCK_DURABLE_FAILURE')
            if fault=='stage-receipt' and path.name=='host-stage-custody.json': raise OSError('MOCK_DURABLE_FAILURE')
            if fault=='custody-receipt' and path.name=='host-source-custody.json': raise OSError('MOCK_DURABLE_FAILURE')
            dump(path,value)
        @staticmethod
        def run(label,argv,directory,timeout,env,input_bytes=None,required=None,progress=None):
            events.append('fake-command:'+label);commands.append({'label':label,'argv':argv,'timeout':timeout,'required':required,
                            'stdinBytes':len(input_bytes) if input_bytes is not None else None,'mocked':True})
            assert required is False and timeout<=190
            out=b'';err=b'';code=0;terminal=True;close=[];failure=None
            if argv[:3]==['docker','ps','--quiet']:
                if fault=='foreign-running': out=b'FOREIGN_DUMMY_ID\n'
            elif argv[:2]==['docker','create']:
                container_name=argv[argv.index('--name')+1]
                assert '--label' in argv and argv[argv.index('--label')+1]=='cortex.operation='+m.OP
                assert '--network' in argv and argv[argv.index('--network')+1]=='none'
                assert m.IMAGE in argv and all('/Users/' not in item for item in argv)
                containers[container_name]=object_for(container_name,container_name==m.SELECTOR_NAME)
                if fault=='create-failure' and container_name==m.NAME: code=1
                out=b'MOCK_OWNED_CONTAINER\n'
            elif argv[:2]==['docker','inspect']:
                container_name=argv[2]
                obj=copy.deepcopy(containers.get(container_name))
                if obj is None:
                    code=1;err=('Error: No such object: '+container_name+'\n').encode()
                else:
                    if label=='private-receiver-initial-inspect' and fault and fault.startswith('recipe-'):
                        if fault=='recipe-label':obj['Config']['Labels']['cortex.operation']='FOREIGN'
                        if fault=='recipe-image':obj['Image']='FOREIGN'
                        if fault=='recipe-running':obj['State']['Running']=True
                        if fault=='recipe-mount':obj['Mounts'][0]['Name']='FOREIGN'
                        if fault=='recipe-subpath':obj['HostConfig']['Mounts'][1]['VolumeOptions']['Subpath']='other'
                        if fault=='recipe-memory':obj['HostConfig']['MemorySwap']=1073741824
                        if fault=='recipe-cpu':obj['HostConfig']['NanoCpus']=4000000000
                        if fault=='recipe-user':obj['Config']['User']='0:0'
                    if label.startswith('final-inspect-') and container_name==m.NAME:
                        if fault=='cleanup-foreign':obj['Config']['Labels']['cortex.operation']='FOREIGN'
                        if fault=='cleanup-foreign-image':obj['Image']='FOREIGN'
                        if fault=='cleanup-running':obj['State']['Running']=True
                    if label.startswith('final-inspect-') and container_name==m.NAME and fault=='cleanup-unknown':terminal=False
                    if label=='private-receiver-terminal-inspect':
                        if fault=='receiver-oom':obj['State']['OOMKilled']=True
                        if fault=='receiver-still-running':obj['State']['Running']=True
                        if fault=='receiver-exit':obj['State']['ExitCode']=1
                    out=json.dumps([obj]).encode()
                if label.startswith('final-inspect-') and container_name==m.NAME and fault=='cleanup-false-absence':
                    code=2;out=b'';err=('Error: No such object: '+container_name+'\n').encode()
            elif argv[:2]==['docker','start']:
                if progress: progress()
                obj=containers[argv[-1]];obj['State']['Running']=False
                if label=='private-receiver':
                    result={'status':'PASS','sourceFiles':4,'copiedFiles':3,'nativeAllNineAndFullContents':True,
                            'scope':'PUBLIC_DUMMY_NATIVE_SOURCE_THEN_UNCHANGED_HELPER'}
                    if fault=='transport-failure':code=1
                    if fault=='transport-unknown':terminal=False
                    if fault=='transport-close-error':close=['MOCK_CLOSE']
                    if fault=='transport-failure-class':failure='MOCK_TIMEOUT'
                    if fault=='receiver-count':result['copiedFiles']=2
                    out=json.dumps(result).encode()
                else:
                    out=json.dumps({'status':'PASS','historicalCustodyRepaired':False,'targetAbsent':False,'retiredSelectorInvalidated':True}).encode()
                    if fault=='selector-command-failure':code=1
                    if fault=='selector-terminal-unknown':terminal=False
            elif argv[:2]==['docker','kill']:
                assert containers[argv[2]]['Config']['Labels']['cortex.operation']==m.OP
                assert containers[argv[2]]['Image']==m.IMAGE
                containers[argv[2]]['State']['Running']=False
            elif argv[:2]==['docker','rm']:
                assert containers[argv[2]]['Config']['Labels']['cortex.operation']==m.OP
                assert containers[argv[2]]['State']['Running'] is False
                del containers[argv[2]]
            elif argv[-1]=='provision':
                events.append('fake-api:provision')
                if fault!='provision-no-ownership': dump(m.S/'created-project.json',{'publicDummyExclusiveOwner':True})
                before={'operation':m.OP,'active':True,'retired':False,'deleted':False,'publicDummyProject':1}
                if fault not in ('provision-no-ownership','provision-partial'):dump(m.S/'target.json',before)
                if fault in ('provision-failure','provision-partial','provision-no-ownership'):code=1
                if fault=='provision-unknown':terminal=False
            elif argv[-1]=='retire':
                events.append('fake-retire-attempt')
                if not (m.S/'created-project.json').exists():
                    code=1;events.append('fake-ownership-rejected-before-api')
                elif fault=='retirement-command-failure':code=1
                else:
                    events.append('fake-api:exclusive-retirement')
                    receipt={'operation':m.OP,'requestSha256':binding['requestSha256'],'retired':True,'deleted':True,
                             'deletionHttpStatus':200,'verificationHttpStatus':404,'productionMutations':0}
                    if fault=='retirement-invalid-receipt':receipt['verificationHttpStatus']=200
                    dump(m.RETIREMENT,receipt)
                    if (m.S/'target.json').exists():
                        before=json.loads((m.S/'target.json').read_bytes());dump(m.S/'target-pre-retirement.json',before)
                        dump(m.S/'target.json',{**before,'active':False,'retired':True,'deleted':True})
            else:raise AssertionError('unmodeled effect '+repr(argv))
            if fault=='failure-status' and label=='private-receiver':code=1
            row={'label':label,'exitCode':code,'terminal':terminal,'closeErrors':close,'failureClass':failure}
            directory.mkdir(exist_ok=True)
            (directory/(label+'.stdout')).write_bytes(out);(directory/(label+'.stderr')).write_bytes(err)
            dump(directory/(label+'.receipt.json'),row)
            return row,out,err

    rows=[{'name':'public-dummy-'+str(i),'fd':9000+i,'bytes':b'PUBLIC DUMMY',
           'identity':{key:'0' for key in ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')},'sha256':'0'*64} for i in range(3)]
    class FakeTransport:
        NAMES=tuple(row['name'] for row in rows)
        @staticmethod
        def open_sources(root,names):
            assert root==m.S;events.append('fake-secret-read:open-sources')
            if fault=='open-sources':raise ValueError('MOCK_CUSTODY_FAIL')
            return (root,'fake-all-nine-directory',9099,rows)
        @staticmethod
        def copy_private(root,destination,binding,stage):
            events.append('fake-secret-read:stage-copy');assert stage is True
            if fault=='stage-copy' or (fault and fault.startswith('cleanup-')):raise ValueError('MOCK_CUSTODY_FAIL')
            return {'status':'PASS','mocked':True}
        @staticmethod
        def verify_sources(*args):
            events.append('fake-all-nine-source-verify')
            if fault=='source-drift':raise ValueError('MOCK_CUSTODY_DRIFT')
        @staticmethod
        def identity(value):return {key:'0' for key in ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')}
    class FakeProducer:
        def __init__(self,path,binding):self.before='mock';self.rows=rows;events.append('fake-producer-open')
        def frames(self):
            events.append('fake-producer-frames')
            yield b'' if fault=='empty-frames' else b'x'*327693 if fault=='oversize-frames' else b'PUBLIC DUMMY FRAMES'
        def verify(self):
            events.append('fake-all-nine-stage-verify')
            if fault=='stage-drift':raise ValueError('MOCK_CUSTODY_DRIFT')
        def close(self):
            events.append('fake-producer-close')
            if fault=='producer-close':raise OSError('MOCK_CLOSE_FAIL')
    acquisition=types.SimpleNamespace(T=FakeTransport,HeldProducer=FakeProducer,MAX_TOTAL=327692,strict_json=m.strict_json)
    def fake_load(name,path):
        events.append('fake-import:'+name)
        return FakeCommon if path==m.COMMON else acquisition
    m.load_module=fake_load
    # Immediate explicit mocked completion; the production wait is still 2400s.
    real_durable=FakeCommon.durable_json
    def durable(path,value):
        real_durable(path,value)
        if path.name=='host-source-custody.json' and fault not in ('wait-deadline','wrong-completion'):
            dump(m.LOG/'coordinator-finish.json',{'operation':m.OP,'finish':True})
        if path.name=='host-source-custody.json' and fault=='wrong-completion':
            dump(m.LOG/'coordinator-finish.json',{'operation':'FOREIGN','finish':True})
    FakeCommon.durable_json=staticmethod(durable)
    failure=None
    try:
        m.main();actual='PASS'
    except BaseException as error:
        actual='FAIL';failure=type(error).__name__
    assert actual==expected,(name,actual,expected,events)
    provision=any(event=='fake-api:provision' for event in events)
    reads=[index for index,event in enumerate(events) if event.startswith('fake-secret-read')]
    if no_provision:
        assert not provision and not reads and not any(event.startswith('fake-api:') for event in events)
    if provision:
        assert 'fake-retire-attempt' in events
        assert events.index('fake-retire-attempt')>events.index('fake-api:provision')
        for owned in m.OWNED_NAMES:
            assert any(command['label']=='final-inspect-'+owned for command in commands)
    for index in reads:
        assert events.index('fake-api:provision')<index
        assert events.index('fake-command:private-receiver-initial-inspect')<index
    if commands:
        first=next(index for index,event in enumerate(events) if event.startswith('fake-command:'))
        assert all(index<first for index,event in enumerate(events) if event.startswith('mock-source-hash:') or event=='actual-candidate-hash')
    if expected=='FAIL' and statuses:
        assert statuses[-1]['status']=='FAIL'
    if fault in ('cleanup-foreign','cleanup-foreign-image'):
        assert not any(command['argv'][:2] in (['docker','kill'],['docker','rm']) and command['argv'][2]==m.NAME for command in commands if command['label'].startswith('final-'))
    if fault=='provision-no-ownership':assert 'fake-api:exclusive-retirement' not in events
    if expected=='PASS':
        assert not containers and statuses[-1]['status']=='PASS'
        assert len([event for event in events if event=='fake-api:exclusive-retirement'])==1
        custody_receipt=json.loads((m.LOG/'host-source-custody.json').read_bytes())
        assert custody_receipt['hostDescriptorsHeldThroughTerminalAndDurableReceipt'] is True
        assert custody_receipt['actualPrivateCryptographicAcceptance'] is False
    assert not any('convex' in str(command['argv'][0]).lower() or command['argv'][-1] in ('deploy','driver') for command in commands)
    result={'name':name,'status':'PASS','expectedCandidateOutcome':expected,'observedCandidateOutcome':actual,
            'candidateException':failure,'allExternalEffectsMocked':True,'actualDockerCalls':0,'actualAPICalls':0,
            'realPrivateReads':0,'events':events,'commands':commands,'statuses':statuses,
            'remainingMockOwnedNames':sorted(containers)}
    dump(B/'raw'/(name+'.json'),result);RESULTS.append(result)


scenario('happy-flow',expected='PASS')
for name,key,value in [('approval-verdict','verdict','REJECT'),('approval-independent','independent',False),
                       ('approval-scope','scope','SOURCE_ONLY_WRONG'),('approval-self-hash','coordinatorSha256','0'*64),
                       ('approval-freeze','freezeSha256','0'*64)]:
    scenario(name,lambda m,a,*rest,k=key,v=value:a.__setitem__(k,v),no_provision=True)
scenario('approval-absent',fault='approval-absent',no_provision=True)
scenario('dependency-missing',lambda m,a,*rest:a['dependencies'].pop(next(iter(a['dependencies']))),no_provision=True)
scenario('dependency-extra',lambda m,a,*rest:a['dependencies'].__setitem__('foreign','0'*64),no_provision=True)
scenario('dependency-hash-drift',lambda m,a,*rest:(m.COMMON).write_text('DRIFT'),no_provision=True)
for name,index,key,value in [
    ('prep-scope',0,'scope','SOURCE_ONLY'),('prep-verdict',0,'verdict','REJECT'),('prep-freeze',0,'candidateSha256','0'*64),
    ('prep-count',0,'candidateMembers',1904),('management-scope',1,'scope','TASK03_DISPOSABLE_TARGET_MANAGEMENT_SOURCE_ONLY'),
    ('management-source',1,'managementSourceSha256','0'*64),('management-request',1,'requestSha256','0'*64),
    ('custody-scope',2,'scope','TASK03_ATTEMPT5_PUBLIC_BINDING_REPAIR2_SOURCE_ONLY'),
    ('custody-operation',2,'operation','FOREIGN'),('custody-volume',2,'volume','FOREIGN'),('custody-count',2,'publicFiles',1911),
    ('custody-manifest',2,'publicSourceManifestSha256','0'*64),('custody-recipe',2,'publicRecipeBindingSha256','0'*64),
    ('custody-all-nine',2,'allCurrentDestinationIdentities','UNKNOWN'),('custody-full-content',2,'currentSourceDestinationFullContent','UNKNOWN'),
    ('public-freeze',3,'preparationFreezeSha256','0'*64),('public-count',3,'publicCopiedFiles',1911),
    ('public-scope',3,'scope','ACCEPTANCE'),('public-namespace',3,'recipeNamespace','FOREIGN'),
    ('public-mount-prefix',3,'ownedSourceMounts',{'candidate':'/host_mnt/foreign','helper':'/host_mnt/foreign'}),
    ('binding-operation',4,'operation','FOREIGN'),('binding-private-path',4,'privateEnvironmentFile','/FOREIGN')]:
    scenario(name,lambda m,a,*docs,i=index,k=key,v=value:docs[i].__setitem__(k,v),no_provision=True)
for fault in ['target-exists','retirement-exists','foreign-running','create-failure','recipe-label','recipe-image','recipe-running',
              'recipe-mount','recipe-subpath','recipe-memory','recipe-cpu','recipe-user']:
    scenario(fault,fault=fault,no_provision=True)
for fault in ['provision-failure','provision-partial','provision-no-ownership','provision-unknown','open-sources','stage-copy',
              'stage-receipt','empty-frames','oversize-frames','source-drift','stage-drift','transport-failure','transport-unknown',
              'transport-close-error','transport-failure-class','receiver-count','receiver-oom','receiver-still-running','receiver-exit',
              'custody-receipt','wait-deadline','wrong-completion','producer-close','descriptor-close','signal-cleanup','failure-status',
              'retirement-command-failure','retirement-invalid-receipt','selector-command-failure','selector-terminal-unknown',
              'terminal-receipt']:
    scenario(fault,fault=fault)
# Force main failure while a created receiver remains, to exercise independent
# final cleanup, exact ownership refusal, and known-owner kill/absence proof.
for fault in ['cleanup-foreign','cleanup-foreign-image','cleanup-running','cleanup-unknown','cleanup-false-absence']:
    original=scenario
    # use one modeled main-stage failure as well as the cleanup-specific seam
    # (the receiver will stay live until finally, rather than received cleanup).
    # The FakeTransport stage is overridden through this dedicated fault name.
    scenario(fault,fault=fault,expected='FAIL')
dump(B/'mocked-coordinator-controls.json',{'scope':'MOCKED_ACTUAL_PRIVATE_COORDINATOR_CONTROL_FLOW_ONLY',
     'status':'PASS','controls':len(RESULTS),'actualDockerCalls':0,'actualAPICalls':0,'realPrivateReads':0,
     'sourceApproved':False,'nativeFoundationAccepted':False,'cases':[{key:r[key] for key in ('name','status','expectedCandidateOutcome','observedCandidateOutcome')} for r in RESULTS]})
print(json.dumps({'scope':'MOCKED_ACTUAL_PRIVATE_COORDINATOR_CONTROL_FLOW_ONLY','status':'PASS','controls':len(RESULTS)}))
