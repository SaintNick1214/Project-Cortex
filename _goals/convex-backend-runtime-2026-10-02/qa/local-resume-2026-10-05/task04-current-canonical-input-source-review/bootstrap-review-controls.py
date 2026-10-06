"""Reviewer-only bootstrap schema/refusal/resource effects; no Docker/pipeline."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch

D = Path(__file__).resolve().parent
R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = R / 'work/resume/task04-c8-current-canonical-input-producers/linux-public-control-proposal'
SOURCE = P / 'bootstrap-public-controls-r3.py'
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
ident = lambda p: {k:str(getattr(os.lstat(p),'st_'+k))for k in FIELDS}
before = ident(SOURCE)
source_raw = SOURCE.read_bytes()
spec = importlib.util.spec_from_file_location('reviewed_bootstrap_helper_only', SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
manifest = json.loads((P/'input-manifest-r3.json').read_text())
checks = []

def check(name, action, expected=None):
    try:
        value=action()
        ok=expected is None
        evidence=repr(value)
    except BaseException as error:
        evidence=repr(error)
        ok=expected is not None and expected in str(error)
    checks.append({'name':name,'status':'PASS'if ok else'FAIL','evidence':evidence})

def exact_manifest_positive():
    validated=module.validate_manifest(manifest)
    assert validated==manifest and len(validated['files'])==14 and validated['inputBytes']==10822332
    return {'fileCount':validated['fileCount'],'inputBytes':validated['inputBytes']}
check('exact-fourteen-manifest-positive',exact_manifest_positive)
for key in ('fileCount','inputBytes'):
    altered=copy.deepcopy(manifest);altered[key]=float(altered[key])
    check('floating-integer-alias-denied:'+key,lambda m=altered:module.validate_manifest(m),'EXACT_MANIFEST_DEMAND_AND_SCOPE')
altered=copy.deepcopy(manifest);altered['fileCount']=True
check('boolean-count-denied',lambda:module.validate_manifest(altered),'EXACT_MANIFEST_DEMAND_AND_SCOPE')
altered=copy.deepcopy(manifest);altered['files'][-1]=copy.deepcopy(altered['files'][0]);altered['inputBytes']=sum(r['bytes']for r in altered['files'])
check('duplicate-pair-with-valid-byte-sum-denied',lambda:module.validate_manifest(altered),'EXACT_MANIFEST_LITERAL_MEMBERSHIP')
for destination in ('../source/escape','/tmp/escape'):
    altered=copy.deepcopy(manifest);altered['files'][0]['destination']=destination
    check('nonliteral-destination-denied:'+destination,lambda m=altered:module.validate_manifest(m),'EXACT_MANIFEST_LITERAL_MEMBERSHIP')

# Enter only the preexisting-root refusal path. Every downstream effect is a trap.
mock_root=D/'reviewer-unowned-root-final'
mock_root.mkdir(mode=0o700)
marker=mock_root/'local-work';marker.write_bytes(b'preserve existing work\n')
marker_before=ident(marker);root_before=ident(mock_root);marker_raw=marker.read_bytes()
effect_calls=[]
def forbidden(*args,**kwargs):
    effect_calls.append(repr(args));raise AssertionError('downstream effect reached')
old_mask=os.umask(0o077);os.umask(old_mask)
try:
    with patch.object(module,'ROOT',mock_root),patch.object(module,'ROOT_CREATED_BY_THIS_INVOCATION',False),patch.object(sys,'platform','linux'),patch.object(sys,'argv',['reviewer-refusal']),patch.object(module,'current_regular',forbidden),patch.object(module,'resource',forbidden),patch.object(module,'copy_content',forbidden),patch.object(module,'call',forbidden),patch.object(module,'export_manifest',forbidden):
        check('preexisting-directory-refuses-before-all-effects',module.entrypoint,'DISTINCT_ISOLATED_PUBLIC_CONTROL_NAMESPACE_REQUIRED')
    checks.append({'name':'preexisting-directory-content-members-and-nine-fields-preserved','status':'PASS'if marker.read_bytes()==marker_raw and ident(marker)==marker_before and ident(mock_root)==root_before and sorted(p.name for p in mock_root.iterdir())==['local-work'] and not effect_calls else'FAIL','evidence':{'downstreamEffectCalls':effect_calls}})
    alias=D/'reviewer-unowned-root-alias-final';alias.symlink_to(mock_root)
    alias_before=ident(alias);alias_target=os.readlink(alias)
    with patch.object(module,'ROOT',alias),patch.object(module,'ROOT_CREATED_BY_THIS_INVOCATION',False),patch.object(sys,'platform','linux'),patch.object(sys,'argv',['reviewer-refusal']),patch.object(module,'current_regular',forbidden),patch.object(module,'resource',forbidden),patch.object(module,'export_manifest',forbidden):
        check('preexisting-symlink-refuses-before-all-effects',module.entrypoint,'DISTINCT_ISOLATED_PUBLIC_CONTROL_NAMESPACE_REQUIRED')
    checks.append({'name':'preexisting-symlink-nine-fields-target-and-work-preserved','status':'PASS'if ident(alias)==alias_before and os.readlink(alias)==alias_target and marker.read_bytes()==marker_raw and ident(marker)==marker_before and not effect_calls else'FAIL','evidence':{'downstreamEffectCalls':effect_calls}})
finally:os.umask(old_mask)

# Use a different allocation geometry from executor mocks; no actual Linux resources.
block=8192
required=((module.PUBLIC_WRITE_BYTE_CEILING+module.PUBLIC_DISK_ADMISSION+block-1)//block)*block
def resource_case(available, inodes, current, initial):
    contents={'/sys/fs/cgroup/memory.max':'1073741824','/sys/fs/cgroup/memory.swap.max':'0','/sys/fs/cgroup/memory.current':str(current)}
    def read_text(path,*args,**kwargs):
        if str(path)not in contents:raise AssertionError('unexpected resource path')
        return contents[str(path)]
    assert available%block==0
    fs=SimpleNamespace(f_bavail=available//block,f_frsize=block,f_favail=inodes)
    with patch.object(Path,'read_text',read_text),patch.object(os,'statvfs',lambda path:fs):
        value=module.resource(initial=initial)
    assert value['availableBytes']==available and value['availableInodes']==inodes and value['allocationBlockBytes']==block and value['literalReserve']==1073741824-current
    if initial:assert value['initialAvailableBytesRequired']==required and value['initialAvailableInodesRequired']==16384
    return value
current=1073741824-134217728
check('initial-exact-rounded-write-plus-reserve-at-8192-blocks',lambda:resource_case(required,16384,current,True))
check('initial-one-allocation-block-short-denied',lambda:resource_case(required-block,16384,current,True),'PUBLIC_CONTROL_INITIAL_WRITE_PLUS_MAINTAINED_RESERVE_HOLD')
check('initial-one-inode-short-denied',lambda:resource_case(required,16383,current,True),'PUBLIC_CONTROL_INITIAL_WRITE_PLUS_MAINTAINED_RESERVE_HOLD')
check('maintained-exact-reserve-floor-positive',lambda:resource_case(1073741824,8192,current,False))
check('maintained-one-block-short-denied',lambda:resource_case(1073741824-block,8192,current,False),'PUBLIC_CONTROL_FINITE_DISK_INODE_HOLD')
check('literal-memory-reserve-one-byte-short-denied',lambda:resource_case(required,16384,current+1,True),'PUBLIC_CONTROL_LITERAL_RESOURCE_HOLD')
checks.append({'name':'reviewed-helper-content-and-nine-fields-unchanged','status':'PASS'if ident(SOURCE)==before and SOURCE.read_bytes()==source_raw else'FAIL','evidence':{'sha256':hashlib.sha256(source_raw).hexdigest(),'PRE':before,'POST':ident(SOURCE)}})
result={'scope':'INDEPENDENT_HELPER_MOCK_AND_REFUSAL_ONLY_NOT_LINUX_PIPELINE_OR_NATIVE_CAPACITY','source':str(SOURCE),'checks':checks,'resourceEffects':'SUBSTITUTED_CGROUP_AND_STATVFS','actualDocker':False,'actualControlPipeline':False,'nativeQualification':False,'historicalCustody':'NOT_ADOPTED','ROOT':'ABSENT','original122':'HELD'}
target=D/'bootstrap-review-results-final-r3.json'
with target.open('x')as f:f.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':sum(c['status']=='PASS'for c in checks),'failed':sum(c['status']=='FAIL'for c in checks),'report':str(target)}))
raise SystemExit(1 if any(c['status']=='FAIL'for c in checks)else 0)
