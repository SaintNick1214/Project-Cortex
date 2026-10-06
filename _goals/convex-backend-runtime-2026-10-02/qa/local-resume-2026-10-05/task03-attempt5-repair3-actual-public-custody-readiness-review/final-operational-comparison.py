"""Fresh independent bounded Docker audit; owned containers only, zero volume mutations."""
import base64
import datetime
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import uuid
import zlib

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06'
P=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
HELPERS=Path(__file__).parent
OUT=HELPERS/'final-operational-observation'
RAW=OUT/'raw'
COMMON=Q/'coordinate-source/repair3/task03-attempt5-coordinate-common.py'
IMAGE='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
VOLUME='cortex-task03-attempt5-fixture-20261006-ba2253a8-r3'
DEPS='cortex-task03-deps-20261005-b681774e'
DOCKER='/usr/local/bin/docker'
FREEZE='053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570'
PUBLIC_MF='f8486d1296f696924820c932199fcbf10e1dbf46f84de6162fadb1c2bba3d5cd'
BINDING='531b6ee19136a00f03b560640a0ff6cc341f91ed2921be225bdac56ae9cf7209'
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
BASE_FIELDS={'st_dev':'dev','st_ino':'ino','st_mode':'mode','st_nlink':'nlink','st_uid':'uid','st_gid':'gid','st_size':'size','st_mtime_ns':'mtime_ns','st_ctime_ns':'ctime_ns'}
OP=str(uuid.uuid4())
NAMES={key:'cortex-task03-r3-independent-'+key+'-'+OP[:8] for key in ['collect','custody','dependencies','readiness']}
LABELS={'cortex.operation':OP,'cortex.scope':'independent-public-custody-readiness-only'}
ENV={'HOME':'/Users/SaintNick','PATH':'/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','CORTEX_COORDINATOR_CWD':str(R)}
records=[]; cleanup_errors=[]; ownership={}; recipes={}; results={}

def identity(value):
    return {BASE_FIELDS[k]:str(getattr(value,k)) for k in FIELDS}

def held(path,collect=False):
    path=Path(path); assert path==path.absolute() and R in path.parents
    current=R
    for component in ('.',*path.relative_to(R).parts):
        if component!='.': current/=component
        value=current.lstat(); assert not stat.S_ISLNK(value.st_mode) and current.resolve()==current
        if current!=path: assert stat.S_ISDIR(value.st_mode)
    before=path.lstat(); assert stat.S_ISREG(before.st_mode) and before.st_nlink==1
    assert before.st_uid==501 and before.st_gid==20
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        pin=identity(before); assert identity(os.fstat(fd))==pin
        h=hashlib.sha256(); length=0; chunks=[]
        while True:
            data=os.read(fd,65536)
            if not data: break
            h.update(data);length+=len(data)
            if collect:
                assert length<=4*1024*1024; chunks.append(data)
        assert length==before.st_size and identity(os.fstat(fd))==identity(path.lstat())==pin
        return {'path':str(path.relative_to(R)),'sha256':h.hexdigest(),'bytes':length,'identityDecimal':pin,'fullEOF':True,'allNinePreOpenPostFinal':True},b''.join(chunks)
    finally:os.close(fd)

def command(label,argv,timeout=30,required=True):
    row,out,err=C.run(label,argv,RAW,timeout,ENV,required=False)
    records.append(row)
    assert row['terminal'] is True and row['closeErrors']==[] and row['failureClass'] is None, 'bounded_terminal_unknown:'+label
    assert type(row['exitCode']) is int
    if required: assert row['exitCode']==0, 'command_exit:'+label
    return row,out,err

def inspect(name,label):
    _,raw,err=command(label,[DOCKER,'inspect',name]); assert err==b''
    rows=json.loads(raw);assert type(rows) is list and len(rows)==1
    return rows[0]

def volume(name,label,expected):
    _,raw,err=command(label,[DOCKER,'volume','inspect',name]);assert err==b''
    rows=json.loads(raw);assert type(rows) is list and len(rows)==1
    obj=rows[0]
    assert obj==expected
    return obj

def basic_owned(obj,key):
    assert obj['Name']=='/'+NAMES[key] and obj['Config']['Labels']==LABELS
    assert obj['Image']==obj['Config']['Image']==IMAGE
    assert isinstance(obj['Id'],str) and len(obj['Id'])==64 and all(c in '0123456789abcdef' for c in obj['Id'])
    assert obj['Platform']=='linux' and obj['Config']['User']=='501:20'
    assert obj['Config']['Entrypoint'] is None
    assert type(obj['State']['Running']) is bool and obj['State']['OOMKilled'] is False

def recipe(obj,key,argv,mounts,memory,mapping=None,initial_id=None):
    basic_owned(obj,key)
    assert obj['Config']['Cmd']==argv
    assert obj['Config']['WorkingDir']==str(R)
    assert obj['State']['Running'] is False
    if initial_id is not None:assert obj['Id']==initial_id
    host=obj['HostConfig']
    assert host['NetworkMode']=='none' and host['ReadonlyRootfs'] is True
    assert host['Privileged'] is False and host['AutoRemove'] is False
    assert host['PortBindings']=={} and host['PublishAllPorts'] is False
    for field,value in [('Memory',memory),('MemorySwap',memory),('PidsLimit',64),('NanoCpus',2000000000)]:
        assert type(host[field]) is int and host[field]==value
    assert host['Tmpfs']=={'/tmp':'rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20'}
    actual_host=host['Mounts'];assert type(actual_host) is list and len(actual_host)==len(mounts)
    choices=[]
    for name,prefix in [('literal',''),('docker-desktop-host_mnt','/host_mnt')]:
        expected=[]
        for mount in mounts:
            m=dict(mount)
            if m['Type']=='bind':m['Source']=prefix+m['Source']
            expected.append(m)
        if expected==actual_host:choices.append(name)
    assert len(choices)==1,'exact_consistent_mapping_required'
    selected=choices[0]
    if mapping is not None:assert selected==mapping
    actual=obj['Mounts'];assert type(actual) is list and len(actual)==len(mounts)
    by={m['Destination']:m for m in actual};assert len(by)==len(actual)
    assert set(by)=={m['Target'] for m in mounts}
    prefix='' if selected=='literal' else '/host_mnt'
    for m in mounts:
        a=by[m['Target']];assert a['Type']==m['Type'] and a['RW'] is False
        if m['Type']=='bind':assert a['Source']==prefix+m['Source']
        else:
            assert a['Name']==m['Source'] and a['Driver']=='local'
            suffix=m['VolumeOptions'].get('Subpath','')
            assert a['Source']=='/var/lib/docker/volumes/'+m['Source']+'/_data'
            # Docker actual Mounts records volume root; exact Subpath is mandatory above in HostConfig.
    return selected

def execute(key,argv,mounts,memory=536870912,timeout=120):
    name=NAMES[key]
    row,raw,err=command(key+'-absence',[DOCKER,'inspect',name],required=False)
    assert row['exitCode']==1 and raw==b'[]\n' and err.lower().strip()==('error: no such object: '+name).encode()
    args=[DOCKER,'create','--name',name,'--label','cortex.operation='+OP,'--label','cortex.scope='+LABELS['cortex.scope'],
          '--platform','linux/amd64','--network','none','--memory',str(memory),'--memory-swap',str(memory),'--cpus','2','--pids-limit','64',
          '--read-only','--user','501:20','--workdir',str(R),'--tmpfs','/tmp:rw,noexec,nosuid,size=67108864,mode=0700,uid=501,gid=20']
    for m in mounts:
        value='type='+m['Type']+',source='+m['Source']+',target='+m['Target']+',readonly'
        if m['Type']=='volume':
            value+=',volume-nocopy'
            if m['VolumeOptions'].get('Subpath'):value+=',volume-subpath='+m['VolumeOptions']['Subpath']
        args.extend(['--mount',value])
    command(key+'-create',[*args,IMAGE,*argv])
    initial=inspect(name,key+'-initial-inspect');basic_owned(initial,key)
    ownership[key]=initial['Id']
    selected=recipe(initial,key,argv,mounts,memory)
    recipes[key]={'containerId':initial['Id'],'selectedDaemonSourceMapping':selected,'literalRequestedMounts':mounts,
                  'HostConfigMounts':initial['HostConfig']['Mounts'],'actualMounts':initial['Mounts']}
    C.durable_json(OUT/(key+'-initial-recipe.json'),recipes[key])
    row,out,err=command(key+'-run',[DOCKER,'start','--attach',name],timeout,required=False)
    terminal=inspect(name,key+'-terminal-inspect')
    recipe(terminal,key,argv,mounts,memory,mapping=selected,initial_id=initial['Id'])
    assert type(terminal['State']['ExitCode']) is int
    assert row['exitCode']==terminal['State']['ExitCode']==0 and err==b''
    assert terminal['State']['Status']=='exited' and terminal['State']['Error']==''
    command(key+'-remove',[DOCKER,'rm',name])
    row,raw,err=command(key+'-removed-absence',[DOCKER,'inspect',name],required=False)
    assert row['exitCode']==1 and raw==b'[]\n' and err.lower().strip()==('error: no such object: '+name).encode()
    return out

def compressed(raw):
    assert len(raw)<=262144
    envelope=json.loads(raw);assert envelope['encoding']=='gzip+base64'
    assert type(envelope['decodedBytes']) is int and envelope['decodedBytes']<=4*1024*1024
    zipped=base64.b64decode(envelope['body'],validate=True)
    decoder=zlib.decompressobj(16+zlib.MAX_WBITS)
    body=decoder.decompress(zipped,4*1024*1024+1)
    assert len(body)<=4*1024*1024 and decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    assert len(body)==envelope['decodedBytes'] and hashlib.sha256(body).hexdigest()==envelope['decodedSha256']
    return json.loads(body)

def source_observation(expected_rows):
    observed=[]
    for row in expected_rows:
        meta,_=held(R/row['path'])
        assert meta['sha256']==row['sha256'] and meta['bytes']==row['bytes']
        assert meta['identityDecimal']==row['identityDecimal'],'current_baseline_all9_changed:'+row['path']
        observed.append(meta)
    for row in observed:assert identity((R/row['path']).lstat())==row['identityDecimal']
    return observed

assert os.getuid()==501 and os.getgid()==20
assert hashlib.sha256(COMMON.read_bytes()).hexdigest()=='1f8f6005c668401b63681e28002715d977abcc02312a199a468e32c2505fa0a2'
spec=importlib.util.spec_from_file_location('independent_final_common',COMMON);C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)
OUT.mkdir(mode=0o700);RAW.mkdir(mode=0o700)
C.durable_json(OUT/'operation.json',{'operation':OP,'scope':'FINAL_CURRENT_OPERATIONAL_COMPARISON_ONLY_NOT_QA_SEAL','names':NAMES,'allowedVolumes':[VOLUME,DEPS]})
failure=None
try:
    source=json.loads(held(HELPERS/'operational-r3/current-host-source-final.json',True)[1])
    expected_rows=source['files']
    final=source_observation(expected_rows)
    C.durable_json(OUT/'final-host-source-comparison.json',{'status':'PASS_ALL9_FULL_EOF_HASH_SIZE_CURRENT_PUBLIC_PRODUCT_OPERATIVE','files':final,'matchesSuccessfulOriginalObservation':True,'privateRowsExcluded':True})
    _,raw,_=command('running-container-ids',[DOCKER,'ps','--quiet']);assert raw==b''
    source_mount={'Type':'bind','Source':str(R),'Target':str(R),'ReadOnly':True}
    public_mount={'Type':'volume','Source':VOLUME,'Target':'/owned','ReadOnly':True,'VolumeOptions':{'NoCopy':True}}
    original=json.loads(held(HELPERS/'operational-r3/actual-public-custody.json',True)[1])
    custody=compressed(execute('custody',['/usr/local/bin/python3.12','-B',str(HELPERS/'linux-public-audit.py'),'audit',original['receiptMetadata']['sha256']],[source_mount,public_mount]))
    assert custody['receiptMetadata']==original['receiptMetadata']
    assert custody['allCurrentDestinationIdentities']=='PASS_ALL9' and custody['currentSourceDestinationFullContent']=='PASS_FULL_EOF_HASH_SIZE_ALL1912'
    assert len(custody['observed'])==1912
    C.durable_json(OUT/'final-public-custody-comparison.json',custody);results['custody']='PASS'
    deps_root={'Type':'volume','Source':DEPS,'Target':'/deps','ReadOnly':True,'VolumeOptions':{'NoCopy':True}}
    dependency_mount={'Type':'volume','Source':DEPS,'Target':str(R/'node_modules'),'ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'node_modules'}}
    selected=['/usr/bin/env','-i','PATH='+str(R/'node_modules/.bin')+':/usr/local/bin:/usr/bin:/bin','HOME=/tmp','LANG=C.UTF-8','NO_COLOR=1','CI=1','TMPDIR=/tmp']
    deps=json.loads(execute('dependencies',[*selected,'/usr/local/bin/node',str(HELPERS/'linux-dependencies-readiness.mjs')],[source_mount,deps_root,dependency_mount]))
    assert deps['status']=='PASS'
    previous=json.loads(held(HELPERS/'operational-r3/actual-dependency-readiness.json',True)[1])
    assert deps==previous,'final_dependencies_all9_or_outcomes_changed'
    C.durable_json(OUT/'final-dependency-comparison.json',deps);results['dependencies']='PASS'
    assert source_observation(expected_rows)==final
    C.durable_json(OUT/'final-source-after-docker.json',{'status':'PASS_ALL9_FULL_EOF_HASH_SIZE','rows':len(final),'unchanged':True})
    for volume_name,label,old_label in [(VOLUME,'final-public-volume','public-volume-final'),(DEPS,'final-dependency-volume','dependency-volume-final')]:
        old=json.loads(held(HELPERS/('operational-r3/raw/'+old_label+'.stdout'),True)[1])[0]
        volume(volume_name,label,old)
except BaseException as error:
    failure={'class':type(error).__name__,'reason':str(error)[:400]}
finally:
    for key,name in NAMES.items():
        try:
            row,raw,err=command('final-'+key+'-inspect',[DOCKER,'inspect',name],required=False)
            if row['exitCode']==0:
                objs=json.loads(raw);assert len(objs)==1;obj=objs[0];basic_owned(obj,key)
                assert key in ownership and obj['Id']==ownership[key]
                if obj['State']['Running']:
                    command('final-'+key+'-sigterm',[DOCKER,'kill','--signal','SIGTERM',name]);command('final-'+key+'-wait',[DOCKER,'wait',name],30)
                terminal=inspect(name,'final-'+key+'-terminal');basic_owned(terminal,key)
                assert terminal['Id']==ownership[key] and terminal['State']['Running'] is False and type(terminal['State']['ExitCode']) is int
                command('final-'+key+'-remove',[DOCKER,'rm',name]);row,raw,err=command('final-'+key+'-absence',[DOCKER,'inspect',name],required=False)
            assert row['exitCode']==1 and raw==b'[]\n' and err.lower().strip()==('error: no such object: '+name).encode()
        except BaseException as error:cleanup_errors.append({'key':key,'class':type(error).__name__,'reason':str(error)[:200]})
    try:
        _,raw,_=command('final-owned-containers',[DOCKER,'ps','--all','--quiet','--filter','label=cortex.operation='+OP]);assert raw==b''
    except BaseException as error:cleanup_errors.append({'key':'owned-final','class':type(error).__name__,'reason':str(error)[:200]})
    status='PASS' if failure is None and cleanup_errors==[] and results=={'custody':'PASS','dependencies':'PASS'} else 'FAIL'
    C.durable_json(OUT/'commands.json',{'scope':'FINAL_CURRENT_OPERATIONAL_COMPARISON_ONLY_NOT_QA_SEAL','status':status,'operation':OP,'commands':records,'results':results,'failure':failure,'cleanupErrors':cleanup_errors,'ownedContainersRemoved':cleanup_errors==[],'volumeWrites':0,'privateReads':0,'serviceCalls':0,'nativeAccepted':False,'fullTask03':False})
print(json.dumps({'status':status,'operation':OP,'results':results,'failure':failure,'cleanupErrors':cleanup_errors}))
raise SystemExit(0 if status=='PASS' else 1)
