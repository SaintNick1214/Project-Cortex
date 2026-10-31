"""Actual bootstrap boundary-only controls; no Docker, subprocess, or native claims."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

W=Path(__file__).resolve().parents[1]
ROOT=W/'controls/bootstrap-boundary-run2'

def main():
    ROOT.mkdir(mode=0o700)
    spec=importlib.util.spec_from_file_location('public_bootstrap_reviewed',W/'linux-public-control-proposal/bootstrap-public-controls-r3.py')
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    manifest=json.loads((W/'linux-public-control-proposal/input-manifest-r3.json').read_bytes())
    outcomes=[]
    def case(name,fn,denied=None):
        try:
            actual=fn()
            if denied:raise AssertionError('ADVERSE_ACCEPTED:'+name)
            outcomes.append({'name':name,'status':'PASS','actual':actual})
        except ValueError as error:
            if not denied or denied not in str(error):raise
            outcomes.append({'name':name,'status':'PASS','denied':str(error)})
    case('exact-fourteen-manifest-accepted',lambda:len(m.validate_manifest(copy.deepcopy(manifest))['files']))
    for key in ('fileCount','inputBytes'):
        changed=copy.deepcopy(manifest);changed[key]=float(changed[key])
        case('integer-'+key+'-rejects-decimal-type',lambda x=changed:m.validate_manifest(x),'EXACT_MANIFEST_DEMAND_AND_SCOPE')
    for name,change,token in (
        ('manifest-unknown-field',lambda x:x.update(UNKNOWN=True),'STRICT_MANIFEST_ROOT_SCHEMA'),
        ('manifest-partial-member',lambda x:x['files'][0].pop('sha256'),'STRICT_MANIFEST_RECORD'),
        ('manifest-duplicate-literal-member',lambda x:x['files'].__setitem__(1,copy.deepcopy(x['files'][0])),'EXACT_MANIFEST_LITERAL_MEMBERSHIP'),
        ('manifest-boolean-byte-count',lambda x:x['files'][0].update(bytes=True),'STRICT_MANIFEST_RECORD'),
        ('manifest-nonarray-files',lambda x:x.update(files={}), 'EXACT_MANIFEST_LITERAL_MEMBERSHIP')):
        changed=copy.deepcopy(manifest);change(changed)
        if name=='manifest-duplicate-literal-member':changed['inputBytes']=sum(x['bytes']for x in changed['files'])
        case(name,lambda x=changed:m.validate_manifest(x),token)
    saved_platform,saved_argv=m.sys.platform,m.sys.argv
    try:
        m.sys.platform='linux';m.sys.argv=['PUBLIC_BOUNDARY_ONLY']
        for name,symlink in [('existing-owned-fixture-root',False),('existing-literal-root-symlink',True)]:
            actual=ROOT/(name+'-target');actual.mkdir(mode=0o700)
            sentinel=actual/'only-existing.txt';sentinel.write_bytes(b'PUBLIC_PREEXISTING_ROOT_CONTENT');os.chmod(sentinel,0o600)
            time.sleep(.4)
            root=ROOT/name
            if symlink:root.symlink_to(actual,target_is_directory=True)
            else:root=actual
            m.ROOT=root;m.ROOT_CREATED_BY_THIS_INVOCATION=False
            before=(sentinel.read_bytes(),m.identity(os.lstat(sentinel)),sorted(x.name for x in actual.iterdir()))
            case(name+'-denied',m.entrypoint,'DISTINCT_ISOLATED_PUBLIC_CONTROL_NAMESPACE_REQUIRED')
            after=(sentinel.read_bytes(),m.identity(os.lstat(sentinel)),sorted(x.name for x in actual.iterdir()))
            assert before==after and m.ROOT_CREATED_BY_THIS_INVOCATION is False,'EXISTING_ROOT_MUTATED'
            case(name+'-no-failure-or-export-write',lambda actual=actual:sorted(x.name for x in actual.iterdir()))
    finally:m.sys.platform=saved_platform;m.sys.argv=saved_argv
    result={'scope':'ACTUAL_PUBLIC_HOST_BOOTSTRAP_BOUNDARY_CONTROLS_ONLY','controls':outcomes,'count':len(outcomes),
        'DockerExecuted':False,'nativeClaims':False,'subjects':False,'original122':'HELD','ROOT':'ABSENT'}
    (ROOT/'results.json').write_text(json.dumps(result,sort_keys=True,indent=2)+'\n')
    print(json.dumps({'count':len(outcomes),'scope':result['scope'],'results':str(ROOT/'results.json')}))

if __name__=='__main__':main()
