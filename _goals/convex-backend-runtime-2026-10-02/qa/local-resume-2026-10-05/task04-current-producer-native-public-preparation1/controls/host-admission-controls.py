"""Pure arithmetic and actual guard functions with explicit public substitutions."""
import importlib.util,json
from pathlib import Path
from types import SimpleNamespace
import sys
D=Path(__file__).resolve().parents[1];sys.path.insert(0,str(D/'source'))
from native_contract import demand,host_demand
spec=importlib.util.spec_from_file_location('host_ci_guard',D/'source/ci-run.py');ci=importlib.util.module_from_spec(spec);spec.loader.exec_module(ci)
ci.RUN=D;ci.WHOLE_END=None
real_fs=ci.os.statvfs;real_read=ci.Path.read_text
available=[0];free_inodes=[0];block=4096
ci.os.statvfs=lambda _:SimpleNamespace(f_bavail=available[0]//block,f_frsize=block,f_favail=free_inodes[0])
ci.Path.read_text=lambda self,*args,**kw:'MemAvailable: 2097152 kB\n'if str(self)=='/proc/meminfo'else real_read(self,*args,**kw)
required=host_demand(block);rows=[]

def check(name,body):
    try:body();rows.append({'name':name,'status':'PASS'})
    except BaseException as error:rows.append({'name':name,'status':'FAIL','error':repr(error)})

def deny(function):
    try:function()
    except ValueError:pass
    else:raise AssertionError('UNDERFUNDED_HOST_ACCEPTED')

def healthy():
    available[0]=required['initialAvailableBytesRequired'];free_inodes[0]=required['initialAvailableInodesRequired']
    assert ci.host_resources(initial=True)['initial']is True
    assert required['initialAvailableBytesRequired']>=required['writeAllocationCeilingBytes']+8589934592
    assert required['initialAvailableInodesRequired']==required['writeInodeCeiling']+32768
    assert demand(4096)['initialAvailableBytesRequired']==2604023808

check('complete-prewrite-ceiling-plus-maintained-floor-positive',healthy)
check('initial-byte-shortfall-denied',lambda:(available.__setitem__(0,required['initialAvailableBytesRequired']-block),deny(lambda:ci.host_resources(initial=True))))
check('initial-inode-shortfall-denied',lambda:(available.__setitem__(0,required['initialAvailableBytesRequired']),free_inodes.__setitem__(0,required['initialAvailableInodesRequired']-1),deny(lambda:ci.host_resources(initial=True))))

def maintained():
    available[0]=8589934592;free_inodes[0]=32768;assert ci.host_resources()['initial']is False
    available[0]-=block;deny(ci.host_resources)

check('maintained-floor-preserved-exact-and-underflow-denied',maintained)

def build_overflow():
    available[0]=required['initialAvailableBytesRequired'];free_inodes[0]=required['initialAvailableInodesRequired']
    ci.BUILD_BASELINE={'availableBytes':available[0]+required['buildFootprintBytesMax']+block,'availableInodes':free_inodes[0]}
    deny(ci.host_resources)
    ci.BUILD_BASELINE={'availableBytes':available[0],'availableInodes':free_inodes[0]+required['buildFootprintInodesMax']+1};deny(ci.host_resources)
    ci.BUILD_BASELINE=None

check('measured-build-bytes-and-inodes-overflow-denied',build_overflow)
ci.os.statvfs=real_fs;ci.Path.read_text=real_read
value={'scope':'PUBLIC_EFFECT_SUBSTITUTED_HOST_ADMISSION_GUARDS_ONLY','count':len(rows),'rows':rows,
       'requiredAt4096':required,'DockerExecuted':False,'nativeQualification':False,'observedCapacityRelease':False}
(D/'controls/host-admission-results-run1.json').write_text(json.dumps(value)+'\n');print(json.dumps(value))
assert all(r['status']=='PASS'for r in rows)
