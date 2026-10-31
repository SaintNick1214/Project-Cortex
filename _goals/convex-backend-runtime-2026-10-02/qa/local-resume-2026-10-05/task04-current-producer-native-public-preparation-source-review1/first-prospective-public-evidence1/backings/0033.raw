"""Actual helper outcomes with explicit PUBLIC host-only inputs; no pipeline/Docker."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace

D=Path(__file__).resolve().parents[1];sys.path.insert(0,str(D/'source'))
from native_contract import Held,strict,demand,resource,literal_maps,proc
from host_contract import validate,volume
from native_export import manifest,PUBLIC

RESULTS=[]
def case(name,fn):
    try:fn();RESULTS.append({'name':name,'status':'PASS'})
    except BaseException as error:RESULTS.append({'name':name,'status':'FAIL','error':repr(error)})
def deny(fn,substring):
    try:fn()
    except (ValueError,OSError)as error:
        assert substring in str(error),(substring,str(error));return
    raise AssertionError('EXPECTED_DENIAL_NOT_RAISED:'+substring)
def eq(a,b):assert a==b,(a,b)

for text in (b'{"a":1,"a":2}',b'{"x":{"a":1,"a":2}}'):
    case('strict-duplicate-'+str(len(RESULTS)),lambda t=text:deny(lambda:strict(t),'DUPLICATE_KEY'))
for text in (b'1e309',b'-1e309',b'NaN',b'Infinity'):
    case('strict-nonfinite-'+text.decode(),lambda t=text:deny(lambda:strict(t),'NONFINITE_JSON'))
case('strict-finite-roundtrip',lambda:eq(strict(b'{"a":[1,2.5,false]}'),{'a':[1,2.5,False]}))
case('strict-partial',lambda:deny(lambda:strict(b'{"a":'),'Expecting'))
fs=SimpleNamespace(f_frsize=4096,f_bavail=10**7,f_favail=100000)
def healthy_resource():
    d=demand(4096);row=resource(fs,1073741824,1,0,True,True)
    eq(row['literalReserveRequired'],536870912)
    assert d['initialAvailableBytesRequired']>=d['allocationCeilingBytes']+1073741824
    eq(d['initialAvailableInodesRequired'],8192+4096+128+512+8192)
case('exact-additional-demand-and-maintained-reserve',healthy_resource)
for bad in (True,4096.0,0,1000,2097152):case('strict-block-'+str(bad),lambda b=bad:deny(lambda:demand(b),'ACTUAL_BLOCK_GEOMETRY'))
case('native-node512-floor',lambda:deny(lambda:resource(fs,1073741824,536870913,0,True),'LITERAL_CGROUP_RESERVE'))
case('python128-floor',lambda:deny(lambda:resource(fs,1073741824,939524097,0),'LITERAL_CGROUP_RESERVE'))
case('swap-denial',lambda:deny(lambda:resource(fs,1073741824,1,1),'LITERAL_CGROUP_RESERVE'))
case('strict-float-resource-denial',lambda:deny(lambda:resource(fs,1073741824.0,1,0),'STRICT_RESOURCE_INTEGER'))
case('initial-disk-funded-floor',lambda:deny(lambda:resource(SimpleNamespace(f_frsize=4096,f_bavail=262144,f_favail=100000),1073741824,1,0,initial=True),'DISK_INODE_ADMISSION'))
case('initial-inodes-funded-floor',lambda:deny(lambda:resource(SimpleNamespace(f_frsize=4096,f_bavail=10**7,f_favail=8192),1073741824,1,0,initial=True),'DISK_INODE_ADMISSION'))
case('mapped-path-exact-reading',lambda:eq(literal_maps(b'01-02 r-xp 0 00:00 1 /a/source\n03-04 rw-p 0 00:00 0 [heap]\n'),['/a/source']))
case('deleted-mapped-source-denial',lambda:deny(lambda:literal_maps(b'01-02 r-xp 0 00:00 1 /a/source (deleted)\n'),'DELETED_MAPPED_SOURCE'))
case('map-byte-bound',lambda:deny(lambda:literal_maps(b'x'*1048577),'FINITE_MAP_BYTES'))
case('strict-process-pid-before-proc-access',lambda:deny(lambda:proc(1.0),'STRICT_PID'))

expected={'id':'c'*64,'image':'sha256:'+'a'*64,'name':'public-new-op','labels':{'operation':'PUBLIC_UUID'},
 'env':['PATH=/usr/local/bin:/usr/bin:/bin'],'mounts':[
 {'type':'bind','source':'/host/exact/file','target':'/native-source','rw':False},
 {'type':'volume','source':'/var/lib/docker/volumes/public/_data','name':'public','target':'/var/tmp','rw':True}]}
row={'Id':expected['id'],'Image':expected['image'],'Name':'/'+expected['name'],
 'Config':{'Labels':expected['labels'],'User':'0:0','WorkingDir':'/native-source','Entrypoint':['/usr/local/bin/python3.12'],'Cmd':['-B','/native-source/native-controller.py'],'Env':expected['env']},
 'HostConfig':{'Memory':1073741824,'MemorySwap':1073741824,'ReadonlyRootfs':True,'NetworkMode':'none','PidsLimit':128,'Privileged':False,'AutoRemove':False,'CapDrop':['ALL'],
  'Tmpfs':{'/tmp':'rw,noexec,nosuid,nodev,size=16777216,mode=0700'},'Ulimits':[{'Name':'nofile','Hard':8192,'Soft':8192}],
  'Mounts':[{'Type':'bind','Source':'/host/exact/file','Target':'/native-source','ReadOnly':True},{'Type':'volume','Source':'public','Target':'/var/tmp','ReadOnly':False,'VolumeOptions':{'NoCopy':True}}]},
 'Mounts':[{'Type':'bind','Source':'/host/exact/file','Destination':'/native-source','RW':False},{'Type':'volume','Source':'/var/lib/docker/volumes/public/_data','Destination':'/var/tmp','RW':True}],
 'State':{'OOMKilled':False,'Error':'','Running':False,'Pid':0,'Status':'created'}}
case('exact-complete-native-create-vector',lambda:eq(validate(row,expected)['id'],expected['id']))
for key,value in [('MemorySwap',-1),('Memory',6442450944),('NetworkMode','bridge'),('ReadonlyRootfs',False),('PidsLimit',129)]:
    def altered(k=key,v=value):
        bad=copy.deepcopy(row);bad['HostConfig'][k]=v;deny(lambda:validate(bad,expected),'EXACT_REQUIRED_RESOURCE')
    case('required-binding-'+key,altered)
def mutation(name,change,code):
    def run():
        bad=copy.deepcopy(row);change(bad);deny(lambda:validate(bad,expected),code)
    case(name,run)
mutation('foreign-operation-label',lambda b:b['Config']['Labels'].update(operation='FOREIGN'),'EXACT_OWNER_LABEL')
mutation('mixed-host-mnt-denial',lambda b:b['Mounts'][0].update(Source='/host_mnt/host/exact/file'),'EXACT_FULL_LITERAL_MOUNT')
mutation('missing-readonly-source-bind',lambda b:b['Mounts'].pop(),'EXACT_FULL_LITERAL_MOUNT')
mutation('volume-copy-up-denied',lambda b:b['HostConfig']['Mounts'][1].update(VolumeOptions={'NoCopy':False}),'VOLUME_NOCOPY')
mutation('prestarted-object-denied',lambda b:b['State'].update(Running=True,Pid=123),'INSPECT_BEFORE_START')
mutation('float-pid-denied',lambda b:b['State'].update(Pid=0.0),'STRICT_ACTUAL_PID')
mutation('unreviewed-argv-denied',lambda b:b['Config'].update(Cmd=['/other.py']),'EXACT_NATIVE_KERNEL_LAUNCH_ARGV')
mutation('env-extension-denied',lambda b:b['Config'].update(Env=expected['env']+['NODE_PATH=/whole']),'EXACT_PUBLIC_RUNTIME_ENV')
def daemon_default():
    for value in(False,None):
        b=copy.deepcopy(row);b['HostConfig']['OomKillDisable']=value;eq(validate(b,expected)['id'],expected['id'])
case('dynamic-default-not-original-resource-assertion',daemon_default)
vrow={'Name':'public','Driver':'local','Labels':expected['labels'],'Options':None,'Mountpoint':'/var/lib/docker/volumes/public/_data'}
case('exact-volume-owner',lambda:eq(volume(vrow,'public',expected['labels']),vrow['Mountpoint']))
case('foreign-volume-label',lambda:deny(lambda:volume({**vrow,'Labels':{'operation':'FOREIGN'}},'public',expected['labels']),'EXCLUSIVE_OWNED_LOCAL_VOLUME'))

fixture=D/'controls'/'public-helper-fixtures-run1';fixture.mkdir(mode=0o700)
path=fixture/'regular';raw=b'PUBLIC_SOURCE_ONLY\n'
with open(path,'xb')as f:f.write(raw);f.flush();os.fsync(f.fileno())
def held_positive():
    h=Held(str(path),1024,{'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
    try:eq(h.fence(full=True)['bytes'],len(raw));eq(set(h.pin['fields']),{'dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'})
    finally:eq(h.close()['closed'],True)
case('actual-host-held-full-eof-nine-and-close',held_positive)
case('actual-host-held-byte-bound',lambda:deny(lambda:Held(str(path),1),'FULL_EOF_BOUND'))
case('actual-host-held-content-denial',lambda:deny(lambda:Held(str(path),1024,{'bytes':len(raw),'sha256':'0'*64}),'CURRENT_CONTENT_PIN'))
symlink=fixture/'alias';os.symlink('regular',symlink)
case('actual-host-literal-alias-not-regular',lambda:deny(lambda:Held(str(symlink),1024),'REGULAR_LITERAL_SINGLE_LINK'))
def drift():
    q=fixture/'drift';q.write_bytes(b'BEFORE');h=Held(str(q),1024)
    try:
        with open(q,'ab')as f:f.write(b'AFTER');f.flush();os.fsync(f.fileno())
        deny(lambda:h.fence(full=True),'CURRENT_ALL_NINE_DRIFT')
    finally:h.close()
case('actual-host-after-open-drift-denial',drift)
def finite_export():
    base=fixture/'native';base.mkdir();(base/'python-raw').mkdir();(base/'node-raw').mkdir()
    pub=fixture/'public';pub.mkdir()
    mf=manifest(base,pub,pub/'public-export-manifest.json')
    eq(mf['existingCount'],0);eq(len(mf['files']),23)
    (base/'python-raw'/'UNKNOWN').write_bytes(b'PUBLIC')
    deny(lambda:manifest(base,pub,pub/'public-export-manifest.json'),'UNKNOWN_RAW_EXPORT_MEMBER')
case('finite-export-absent-and-unknown-denial',finite_export)
output={'scope':'PUBLIC_HOST_PURE_HELPER_OUTCOMES_ONLY','results':RESULTS,'count':len(RESULTS),
 'passes':sum(r['status']=='PASS'for r in RESULTS),'failures':sum(r['status']=='FAIL'for r in RESULTS),
 'nativeControlsExecuted':0,'producer48Executed':0,'original122':'HELD','ROOT':'ABSENT',
 'skips':['Linux pidfd/signal/poll','O_PATH','native maps/imports/cgroup','Docker bindings','originalC7 own20','unchanged48 public pipeline','all original qualification gates']}
with open(D/'controls'/'pure-control-results-run1.json','x')as f:json.dump(output,f,sort_keys=True);f.write('\n');f.flush();os.fsync(f.fileno())
print(json.dumps({k:v for k,v in output.items()if k!='results'}))
if output['failures']:sys.exit(1)
