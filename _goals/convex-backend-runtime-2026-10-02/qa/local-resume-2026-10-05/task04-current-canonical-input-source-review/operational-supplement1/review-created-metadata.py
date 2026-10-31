"""Read finite parent receipts; assert six literal daemon coordinates, no Docker."""
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import stat

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
G=R/'_goals/convex-backend-runtime-2026-10-02'
D=Path(__file__).resolve().parent
P=G/'qa/local-resume-2026-10-05/task04-current-producer-linux-public-run-r3'
OLD=D.parent
W=R/'work/resume/task04-c8-current-canonical-input-producers'
OP='9655f70c-0ac7-4d89-9135-3da95e3c6662'
ID='1044af770dbcb88c25b73d2821440075f5024db16f975b07ed3e8b7f64abf56f'
NAME='cortex-task04-current-producer-public-controls-r3'
IMAGE='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
LABELS={'com.cortex.attempt':'linux-public-r3','com.cortex.goal':'convex-backend-runtime-2026-10-02','com.cortex.operation':OP,'com.cortex.owner':'task04-current-canonical-input-producers','com.cortex.scope':'PUBLIC_SOURCE_CONTROLS_ONLY'}
# Enumerated full literals for this ID/OP only. No general path resolver.
PAIRS=[
('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-c8-current-canonical-input-producers/source','/host_mnt/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-c8-current-canonical-input-producers/source','/reviewed-source'),
('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-c8-current-canonical-input-producers/controls/run_controls.py','/host_mnt/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-c8-current-canonical-input-producers/controls/run_controls.py','/reviewed-control.py'),
('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/typescript/lib/typescript.js','/host_mnt/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/typescript/lib/typescript.js','/reviewed-typescript.js'),
('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json','/host_mnt/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json','/reviewed-command.json'),
('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-c8-current-canonical-input-producers/linux-public-control-proposal/input-manifest-r3.json','/host_mnt/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-c8-current-canonical-input-producers/linux-public-control-proposal/input-manifest-r3.json','/reviewed-manifest.json'),
('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-c8-current-canonical-input-producers/linux-public-control-proposal/bootstrap-public-controls-r3.py','/host_mnt/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/work/resume/task04-c8-current-canonical-input-producers/linux-public-control-proposal/bootstrap-public-controls-r3.py','/reviewed-bootstrap-r3.py')]
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
ident=lambda s:{k:str(getattr(s,'st_'+k))for k in FIELDS}
observations=[];descriptors=[];checks=[]
def require(condition,message):
    if not condition:raise ValueError(message)
def read(path,maximum=65536):
    pre=os.lstat(path);require(stat.S_ISREG(pre.st_mode)and pre.st_nlink==1 and path.resolve()==path,'regular literal single-link')
    require(pre.st_size<=maximum,'finite pre-read bound')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);descriptors.append((path,fd,ident(pre)))
    opened=os.fstat(fd);raw=bytearray()
    while block:=os.read(fd,65536):
        raw.extend(block);require(len(raw)<=maximum,'finite during-read bound')
    post=os.fstat(fd);final=os.lstat(path)
    require(ident(pre)==ident(opened)==ident(post)==ident(final)and len(raw)==pre.st_size,'full EOF/current nine drift')
    observations.append({'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'PRE':ident(pre),'OPEN':ident(opened),'POST':ident(post),'pathPOST':ident(final),'EOF':True})
    return bytes(raw)
def data(path):return json.loads(read(path))
def check(name,action,rejection=None):
    try:value=action();ok=rejection is None;evidence=value
    except BaseException as error:ok=rejection is not None and rejection in str(error);evidence=repr(error)
    checks.append({'name':name,'status':'PASS'if ok else'FAIL','evidence':evidence})
def validate_container(c):
    require(c['Id']==ID and c['Name']=='/'+NAME and c['Image']==IMAGE,'exact own ID/name/image')
    state=c['State'];require(state['Status']=='created'and state['Running']is False and type(state['Pid'])is int and state['Pid']==0 and state['OOMKilled']is False and state['Error']==''and state['StartedAt']==state['FinishedAt']=='0001-01-01T00:00:00Z'and c['RestartCount']==0,'created never-started state')
    config=c['Config'];h=c['HostConfig']
    require(config['Labels']==LABELS and config['User']=='0:0'and config['Image']==IMAGE and config['Entrypoint']==['/usr/local/bin/python3.12']and config['Cmd']==['-B','/reviewed-bootstrap-r3.py'],'exact owner/config')
    require(c['Path']=='/usr/local/bin/python3.12'and c['Args']==config['Cmd'],'actual entrypoint')
    for k,v in {'Memory':1073741824,'MemorySwap':1073741824,'NetworkMode':'none','ReadonlyRootfs':True,'PidMode':'','Privileged':False,'CapDrop':['ALL'],'PidsLimit':128}.items():require(h[k]==v and (type(h[k])is type(v)),'exact resource/namespace:'+k)
    require(h['CapAdd']is None and h['Devices']==[]and h['DeviceRequests']is None and h['AutoRemove']is False and h['Binds']is None and h['VolumesFrom']is None,'no extra capability/device/mount/remove')
    require(h['Tmpfs']=={'/tmp':'rw,nosuid,nodev,size=16777216,mode=1777'},'exact tmpfs')
    expected={(daemon,dest)for _,daemon,dest in PAIRS}
    host=h['Mounts'];actual=c['Mounts']
    require(len(host)==len(actual)==7,'exact seven mounts')
    hb=[x for x in host if x['Type']=='bind'];ab=[x for x in actual if x['Type']=='bind']
    require(len(hb)==len(ab)==6 and {(x['Source'],x['Target'])for x in hb}==expected and {(x['Source'],x['Destination'])for x in ab}==expected,'six exact literal projected bind pairs')
    require(all(x['ReadOnly']is True for x in hb)and all(x['RW']is False and x['Propagation']=='rprivate'for x in ab),'all binds readonly/private')
    hv=[x for x in host if x['Type']=='volume'];av=[x for x in actual if x['Type']=='volume']
    require(hv==[{'Type':'volume','Source':NAME,'Target':'/var/tmp','VolumeOptions':{'NoCopy':True}}],'exact nocopy volume config')
    require(len(av)==1 and av[0]['Name']==NAME and av[0]['Driver']=='local'and av[0]['Destination']=='/var/tmp'and av[0]['Source']=='/var/lib/docker/volumes/'+NAME+'/_data'and av[0]['RW']is True,'one exact owned RW volume')
    env=config['Env'];require(len({x.split('=',1)[0]for x in env})==len(env),'unique environment')
    values=dict(x.split('=',1)for x in env)
    require(values=={'PYTHONDONTWRITEBYTECODE':'1','HOME':'/var/tmp/task04-c8-current-canonical-input-producers/home','PATH':'/usr/local/bin:/usr/bin:/bin','TMPDIR':'/tmp','LANG':'C.UTF-8','GPG_KEY':'7169605F62C751356D054A26A821E680E5FA6305','PYTHON_VERSION':'3.12.15','PYTHON_SHA256':'c2c4321961fab0fb999d66e0cecf521c2ab3994c7992873ea99e306c1094fd5a'},'fixed overrides/public image environment')
    require(config['WorkingDir']=='/var/tmp/cortex-native-c8-prospective-preparation'and config['Volumes']is None,'immutable image default cwd/no extra volumes')
    require(c['ImageManifestDescriptor']['platform']=={'architecture':'amd64','os':'linux'},'public emulated linux amd64')
    require(set(c['NetworkSettings']['Networks'])=={'none'}and c['NetworkSettings']['Ports']=={},'no network or published ports')
    return {'Id':ID,'operationUUID':OP,'exactProjectedBindCount':6,'RWOwnedVolumes':1,'notStarted':True}
def validate_capture(label,expected_argv,expected_exit):
    stdout=read(P/'raw'/(label+'.stdout'));stderr=read(P/'raw'/(label+'.stderr'),8192);receipt=data(P/'raw'/(label+'.receipt.json'))
    require(receipt['label']==label and receipt['argv']==expected_argv and receipt['exitCode']==expected_exit and receipt['terminal']is True and receipt['failureClass']is None and receipt['closeErrors']==[]and receipt['elapsedSeconds']<=30,'bounded exact captured command')
    require(receipt['stdoutSha256']==hashlib.sha256(stdout).hexdigest()and receipt['stderrSha256']==hashlib.sha256(stderr).hexdigest()and receipt['streamByteCounts']=={'stdout':len(stdout),'stderr':len(stderr)}and receipt['stdinBytes']==0 and receipt['ownedGroup']['absenceObserved']is True,'captured bytes and own CLI terminal group')
    return stdout,stderr,receipt

errors=[]
try:
    recipe_raw=read(W/'linux-public-control-proposal/recipe-r3.json');recipe=json.loads(recipe_raw)
    require(hashlib.sha256(recipe_raw).hexdigest()=='b12735095142488744780fa50ef05c8735cca6d941edb593883f36cdd1a801b2','sealed exact r3 recipe')
    require(recipe['operationUUID']==OP and recipe['containerName']==recipe['exclusiveNewVolume']==NAME,'same exact operation')
    mount_strings=[recipe['argv'][i+1]for i,v in enumerate(recipe['argv'])if v=='--mount']
    require(set(mount_strings)=={'type=volume,src='+NAME+',dst=/var/tmp,volume-nocopy'}|{'type=bind,src='+host+',dst='+dest+',readonly'for host,_,dest in PAIRS},'six exact host-coordinate recipe pairs')
    raw,err,inspect_receipt=validate_capture('created-container-inspect1',['docker','container','inspect',ID],0);require(err==b'','inspect stderr empty');parsed=json.loads(raw);require(type(parsed)is list and len(parsed)==1,'one own container record');container=parsed[0]
    check('actual-created-container-exact-guards-and-six-projections',lambda:validate_container(container))
    for label in ['new-volume-absence1','new-container-absence1','new-container-absence2']:
        is_volume=label=='new-volume-absence1';argv=['docker','volume'if is_volume else'container','inspect','--format','{{json .Name}}'if is_volume else'{{json .Id}}',NAME]
        out,err,receipt=validate_capture(label,argv,1)
        expected=('Error response from daemon: get '+NAME+': no such volume\n'if is_volume else'Error response from daemon: No such container: '+NAME+'\n').encode()
        require(out==b'\n'and err==expected,'exact absence outcome without transport failure')
        require(receipt['observedAtUtc']<container['Created'],'absence before exact container creation')
        checks.append({'name':'exact-parent-absence-receipt:'+label,'status':'PASS','evidence':{'exitCode':1,'exactNamedAbsence':True,'terminal':True}})
    out,err,_=validate_capture('volume-create1',recipe['ownershipBeforeEffects']['volumeCreateArgv'],0);require(out==(NAME+'\n').encode()and err==b'','exact volume creation result')
    out,err,_=validate_capture('container-create1',recipe['argv'],0);require(out==(ID+'\n').encode()and err==b'','exact container creation result')
    out,err,_=validate_capture('owned-volume-inspect1',['docker','volume','inspect',NAME],0);require(err==b'','volume inspect stderr empty');volumes=json.loads(out);require(len(volumes)==1,'one volume record');volume=volumes[0]
    require(volume=={'CreatedAt':'2026-10-06T14:21:41Z','Driver':'local','Labels':LABELS,'Mountpoint':'/var/lib/docker/volumes/'+NAME+'/_data','Name':NAME,'Options':None,'Scope':'local'},'exact local operation-owned volume')
    owned=data(P/'owned-volume.json');require(owned['operationUUID']==OP and owned['name']==NAME and owned['labels']==LABELS and owned['CreatedAt']==volume['CreatedAt']and owned['Driver']=='local'and owned['Options']is None and owned['currentInspectReceipt']=='raw/owned-volume-inspect1.receipt.json'and owned['private']is False and owned['native']is False,'volume proof matches raw current metadata')
    checks.append({'name':'actual-exact-new-volume-and-container-create-chain','status':'PASS','evidence':{'operationUUID':OP,'volumeCreatedAt':volume['CreatedAt'],'immutableContainerId':ID}})
    daemon_args=['docker','info','--format','{"MemTotal":{{.MemTotal}},"Architecture":{{json .Architecture}},"OperatingSystem":{{json .OperatingSystem}},"ServerVersion":{{json .ServerVersion}}}']
    out,err,_=validate_capture('daemon-info1',daemon_args,0);daemon=json.loads(out);require(err==b''and daemon=={'MemTotal':8319504384,'Architecture':'aarch64','OperatingSystem':'Docker Desktop','ServerVersion':'29.8.1'},'exact current public daemon snapshot')
    out,err,_=validate_capture('image-info1',['docker','image','inspect','--format','{"Id":{{json .Id}},"Architecture":{{json .Architecture}},"Os":{{json .Os}},"Size":{{.Size}}}',IMAGE],0);image=json.loads(out);require(err==b''and image=={'Id':IMAGE,'Architecture':'amd64','Os':'linux','Size':381656494},'exact immutable emulated public image snapshot')
    out,err,_=validate_capture('running-public-inventory1',['docker','ps','--no-trunc','--format','{{json .}}'],0);inventory=[json.loads(line)for line in out.splitlines()];require(err==b''and len(inventory)==1 and inventory[0]['ID']=='b551bbf5025aba25568eb1bb6fb42009edf15d31e39771fea617d2fbccea034c'and inventory[0]['State']=='running','foreign running snapshot conserved without action')
    checks.append({'name':'public-daemon-image-and-foreign-inventory-snapshots','status':'PASS','evidence':{'daemonMemTotal':daemon['MemTotal'],'daemonArchitecture':daemon['Architecture'],'imageArchitecture':image['Architecture'],'nativeClaims':False,'foreignUntouched':True}})
    for name,mutate,rejection in [
        ('mixed-mac-daemon-alias',lambda c:c['HostConfig']['Mounts'][1].update(Source=PAIRS[0][0]),'six exact literal'),
        ('same-suffix-different-root',lambda c:c['Mounts'][0].update(Source='/elsewhere'+c['Mounts'][0]['Source']),'six exact literal'),
        ('extra-private-bind',lambda c:c['Mounts'].append({'Type':'bind','Source':'/private','Destination':'/private','RW':False}),'exact seven'),
        ('writable-reviewed-bind',lambda c:c['Mounts'][0].update(RW=True),'all binds readonly'),
        ('wrong-operation-uuid',lambda c:c['Config']['Labels'].update({'com.cortex.operation':'other'}),'exact owner/config'),
        ('wrong-container-id',lambda c:c.update(Id='0'*64),'exact own ID'),
        ('wrong-memory',lambda c:c['HostConfig'].update(Memory=2147483648),'exact resource/namespace'),
        ('wrong-volume-name',lambda c:[r.update(Name='foreign')for r in c['Mounts']if r['Type']=='volume'],'one exact owned')]:
        adverse=copy.deepcopy(container);mutate(adverse);check('negative-metadata:'+name,lambda c=adverse:validate_container(c),rejection)
    mf_raw=read(G/'qa/local-resume-2026-10-05/task04-current-canonical-input-producers/closed-source-manifest.json');require(hashlib.sha256(mf_raw).hexdigest()=='afc703999f7779d0621f6a3aedd8ac0792abe633e0b0f0690929c6e069a327ae','sealed source MF unchanged');mf=json.loads(mf_raw)
    for pin in mf['files']:
        source=read(R/pin['path'],16777216);row=observations[-1]
        require(row['bytes']==pin['bytes']and row['sha256']==pin['sha256']and row['PRE']==pin['PRE']['fields'],'original closed source content/current identity unchanged')
    for name,expected in [('source-eligibility-verdict.json','82d2fc3dd2b4d6075ca6e30a36cf6622e560aa91e085e6173a9c2b82d0407264'),('source-eligibility-report.md','c4389a7d67ec1bd50aa1a9f60b6765b590843fb690886f81f296f6799aa9e0e8'),('finite-evidence-manifest.json','2fef9910b60003628667e07b38d14a37742b3e438359321792d28723a5b760d0')]:require(hashlib.sha256(read(OLD/name,262144)).hexdigest()==expected,'sealed earlier source verdict/evidence unchanged')
    checks.append({'name':'all23-original-closed-pins-and-sealed-source-verdict-preserved','status':'PASS','evidence':{'exactSourceFiles':23,'originalSourceVerdict':'UNCHANGED'}})
    for path,fd,pre in descriptors:require(pre==ident(os.fstat(fd))==ident(os.lstat(path)),'final held-FD/path nine-field fence')
except BaseException as error:errors.append(repr(error))
finally:
    for _,fd,_ in descriptors:os.close(fd)
result={'scope':'BOUNDED_PRE_START_OPERATIONAL_METADATA_SUPPLEMENT_ONLY','status':'PASS'if not errors and all(c['status']=='PASS'for c in checks)else'FAIL','operationUUID':OP,'containerId':ID,'containerState':'CREATED_NOT_STARTED','exactLiteralProjectionTable':[{'hostSource':h,'daemonSource':d,'containerDestination':t}for h,d,t in PAIRS],'checks':checks,'errors':errors,'evidence':observations,'sourceVerdict':'PRESERVED_UNCHANGED','DockerActionsByJudge':False,'initialSetupReadError':'Parent text merged fresh with label; freshnew-container-absence2 missing. Corrected exact label new-container-absence2 supplied; no effects or inferred success from failed read.','actualPipelineControls':'48_HELD_UNEXECUTED','historicalCustody':'NOT_ADOPTED','nativeQualification':False,'ROOT':'ABSENT','Task03':'OPEN','Task04':'OPEN','wholeGoal':'OPEN'}
with(D/'metadata-review-results.json').open('x')as f:f.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'checksPassed':sum(c['status']=='PASS'for c in checks),'checksFailed':sum(c['status']=='FAIL'for c in checks),'errors':errors,'finiteEvidenceReads':len(observations)}))
raise SystemExit(result['status']!='PASS')
