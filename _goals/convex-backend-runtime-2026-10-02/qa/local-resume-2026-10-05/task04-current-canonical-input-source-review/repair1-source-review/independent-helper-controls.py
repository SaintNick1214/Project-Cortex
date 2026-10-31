"""Independent finite helper and mocked metadata controls; no product execution."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import types

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
B=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
W=R/'work/resume/task04-c8-current-canonical-input-producers/repair1'
D=Path(__file__).resolve().parent
P=B/'task04-current-producer-repair1-parent-preparation'
sys.path.insert(0,str(W/'source'))
from strict_io import Hold
from producers import validate_selector_recipe
checks=[];errors=[]
def yes(name,fn):
    value=fn();checks.append({'name':name,'status':'PASS','observation':value})
def no(name,fn,token,exceptions=(Hold,ValueError)):
    try:fn()
    except exceptions as error:
        assert token in str(error),(name,str(error),token)
        checks.append({'name':name,'status':'PASS','denial':str(error)});return
    raise AssertionError('adverse accepted:'+name)
def selector_controls():
    c=json.loads((W/'source/reference-contract.json').read_bytes())
    own=c['ownSelectorLogicalPaths'][0];marked=c['recipes']['OWN_VM_CONSUMER_CONTROL']['calls'][1]
    assert marked['json']is True and marked['argumentExpression']=='source' and marked['sourceLogicalPaths']==[]
    assert len(c['originalIds'])==122 and len(c['recipes'])==124 and c['selectors']==246
    def validate(row=marked,command='OWN_VM_CONSUMER_CONTROL',selected=(),call=None):
        validate_selector_recipe(command,row,call or {k:row[k]for k in('kind','argumentExpression')},list(selected),own)
        return {'command':command,'argument':row['argumentExpression'],'selected':len(selected),'sourceRecipeOnly':True}
    yes('exact-preserved-own-wrapper-recipe',validate)
    literal=next(x for r in c['recipes'].values()for x in r['calls']if x['json']is True and x['argumentExpression']=="'JSON'")
    yes('closed-reference-literal-JSON-retained',lambda:validate(literal))
    ordinary=c['recipes']['OWN_VM_CONSUMER_CONTROL']['calls'][0]
    yes('closed-own-non-JSON-requires-source',lambda:validate(ordinary,selected=({'path':'MOCK_SOURCE_PIN'},)))
    for name,value in [('producerLogical','/unlisted'),('resolution','unlisted'),('parent',True),('parent',0),('canonical',True),('canonical',0),('kind','SourceTextModule'),('argumentExpression','source.trim()')]:
        row=copy.deepcopy(marked);row[name]=value
        no('own-wrapper-'+name+'-'+repr(value),lambda row=row:validate(row),'FINITE_SELECTOR_RECIPE_EMPTY_OR_JSON')
    for command in ('ORIGINAL_ID','ROOT','OWN_EXTERNAL_REVIEW'):
        no('dynamic-empty-JSON-command-'+command,lambda command=command:validate(command=command),'FINITE_SELECTOR_RECIPE_EMPTY_OR_JSON')
    no('own-JSON-cannot-add-selected-source',lambda:validate(selected=({'path':'MOCK_SOURCE_PIN'},)),'FINITE_SELECTOR_RECIPE_EMPTY_OR_JSON')
    no('literal-JSON-cannot-add-selected-source',lambda:validate(literal,selected=({'path':'MOCK_SOURCE_PIN'},)),'FINITE_SELECTOR_RECIPE_EMPTY_OR_JSON')
    no('non-JSON-cannot-empty-selected-source',lambda:validate(ordinary),'FINITE_SELECTOR_RECIPE_EMPTY_OR_JSON')
    for value in (1,0,None,'true'):
        row=copy.deepcopy(marked);row['json']=value
        no('exact-JSON-boolean-'+repr(value),lambda row=row:validate(row),'FINITE_SELECTOR_JSON_BOOLEAN')
    no('current-call-argument-cannot-alias-literal-JSON',lambda:validate(call={'kind':'runInContext','argumentExpression':"'JSON'"}),'CURRENT_AST_RECIPE_ARGUMENT_DRIFT')
    no('current-call-kind-cannot-drift',lambda:validate(call={'kind':'SourceTextModule','argumentExpression':'source'}),'CURRENT_AST_RECIPE_ARGUMENT_DRIFT')

def resource_controls():
    spec=importlib.util.spec_from_file_location('independent_public_bootstrap',W/'proposal/bootstrap.py')
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    root=D/'resource-owned-fixture';root.mkdir(mode=0o700);m.ROOT=root;m.ROOT_CREATED_BY_THIS_INVOCATION=True
    state={'max':'1073741824','current':'939524096','swap':'0','bytes':1997434880,'inodes':16384,'block':4096}
    prior_read=m.Path.read_text;prior_stat=m.os.statvfs
    def fake_read(path,*a,**kw):
        assert str(path).startswith('/sys/fs/cgroup/'),str(path)
        return state[{'memory.max':'max','memory.current':'current','memory.swap.max':'swap'}[path.name]]
    m.Path.read_text=fake_read
    m.os.statvfs=lambda path:types.SimpleNamespace(f_bavail=state['bytes']//state['block'],f_frsize=state['block'],f_favail=state['inodes'])
    receipt=root/'resource-observations.json'
    def observed():return json.loads(receipt.read_bytes())
    try:
        first=m.resource(initial=True);x=observed()
        assert x['checks']==1 and x['first']==x['last']==first and first['literalReserve']==134217728 and first['initialAvailableBytesRequired']==1997434880 and first['initialAvailableInodesRequired']==16384
        yes('literal-128MiB-and-rounded-initial-boundaries-durable',lambda:{'first':first,'fileBytes':receipt.stat().st_size,'substituted':True})
        state['current']='939524097'
        no('one-byte-below-literal-reserve-durable-failure',m.resource,'PUBLIC_CONTROL_LITERAL_RESOURCE_HOLD')
        x=observed();assert x['checks']==2 and x['firstFailedCheck']['check']==2 and x['last']['literalReserve']==134217727 and x['minimumLiteralReserve']==134217727
        first_failure=copy.deepcopy(x['firstFailedCheck'])
        state['current']='805306368';state['bytes']=1073737728
        no('one-block-below-maintained-disk-floor-durable',m.resource,'PUBLIC_CONTROL_FINITE_DISK_INODE_HOLD')
        x=observed();assert x['checks']==3 and x['last']['availableBytes']==1073737728 and x['minimumAvailableBytes']==1073737728 and x['firstFailedCheck']==first_failure
        state['bytes']=1073741824;state['inodes']=8191
        no('one-inode-below-maintained-floor-durable',m.resource,'PUBLIC_CONTROL_FINITE_DISK_INODE_HOLD')
        x=observed();assert x['checks']==4 and x['minimumAvailableInodes']==8191 and x['last']['availableInodes']==8191
        state['inodes']=8192
        final=m.resource();x=observed();assert x['checks']==5 and x['last']==final and x['firstFailedCheck']==first_failure and x['minimumLiteralReserve']==134217727
        yes('recovery-keeps-first-failure-and-minima',lambda:{'checks':x['checks'],'firstFailedCheck':first_failure,'bytes':receipt.stat().st_size})
        prior=receipt.read_bytes();m.ROOT_CREATED_BY_THIS_INVOCATION=False
        no('preexisting-root-write-refused',lambda:m.record_resource(final,[]),'NO_RESOURCE_WRITE_TO_PREEXISTING_ROOT')
        assert receipt.read_bytes()==prior;m.ROOT_CREATED_BY_THIS_INVOCATION=True
        no('16KiB-bound-before-any-write',lambda:m.record_resource(final|{'oversized':'x'*16384},[]),'FINITE_RESOURCE_RECEIPT_BOUND')
        assert receipt.read_bytes()==prior
        replacement=b'INDEPENDENT_FOREIGN_BYTES\n';receipt.write_bytes(replacement)
        no('foreign-receipt-byte-replacement-refused',m.resource,'FOREIGN_RESOURCE_OUTPUT_REPLACEMENT')
        assert receipt.read_bytes()==replacement
        assert len(m.EXPORT_ALLOWLIST)==len(set(m.EXPORT_ALLOWLIST))==23 and m.EXPORT_ALLOWLIST.count('resource-observations.json')==1 and m.EXPORT_BYTES_MAX==1048576
        yes('exact-23-export-rows-and-unchanged-1MiB-cap',lambda:{'rows':23,'cap':1048576})
    finally:m.Path.read_text=prior_read;m.os.statvfs=prior_stat

def metadata_controls():
    raw=(P/'metadata-module.py').read_bytes();assert hashlib.sha256(raw).hexdigest()=='d757f1524ae22d7f4f40da8fef509e5b080413c769a12e68ad7baab7ee528661'
    m=types.ModuleType('independent_metadata');exec(compile(raw,str(P/'metadata-module.py'),'exec'),m.__dict__)
    recipe=json.loads((W/'proposal/recipe.json').read_bytes());base=json.loads((P/'mocked-fixture.json').read_bytes());cid=base['Id']
    def check(c,created=True):
        value=m.validate(c,recipe,cid,created=created);assert value['containerId']==cid and value['operationUUID']=='f83336fb-794a-4878-87ec-f85612ade6a6' and value['requiredGuards']=='PASS';return value
    for coordinate in ('hostSourceLiteral','desktopSourceLiteral'):
        variant=copy.deepcopy(base)
        for rows,destination in ((variant['HostConfig']['Mounts'],'Target'),(variant['Mounts'],'Destination')):
            for row in rows:
                if row['Type']=='bind':row['Source']=next(x[coordinate]for x in recipe['finiteBindCoordinateTable']if x['destination']==row[destination])
        yes('mock-complete-exact-six-'+coordinate,lambda variant=variant:check(variant))
    variant=copy.deepcopy(base);variant['HostConfig']['OomKillDisable']=None;variant['State'].update(Status='running',Running=True,Pid=321)
    yes('mock-running-unset-OOM-null-raw-retained',lambda:check(variant,False))
    changes=[
        ('foreign-ID',lambda c:c.update(Id='c'*64),'exact owned'),
        ('foreign-UUID',lambda c:c['Config']['Labels'].update({'com.cortex.operation':'foreign'}),'exact owned'),
        ('memory-bool',lambda c:c['HostConfig'].update(Memory=True),'exact required guard'),
        ('memory-float',lambda c:c['HostConfig'].update(Memory=1073741824.0),'exact required guard'),
        ('swap-bool',lambda c:c['HostConfig'].update(MemorySwap=True),'exact required guard'),
        ('extra-label',lambda c:c['Config']['Labels'].update({'extra':'label'}),'exact owned'),
        ('bind-RW',lambda c:next(r for r in c['Mounts']if r['Type']=='bind').update(RW=True),'readonly private binds'),
        ('bind-readonly-int',lambda c:next(r for r in c['HostConfig']['Mounts']if r['Type']=='bind').update(ReadOnly=1),'readonly private binds'),
        ('suffix-alias',lambda c:next(r for r in c['Mounts']if r['Type']=='bind').update(Source='/alias'+next(r for r in c['Mounts']if r['Type']=='bind')['Source']),'one complete'),
        ('extra-mount',lambda c:c['Mounts'].append({'Type':'bind'}),'exact seven mounts'),
        ('extra-capability',lambda c:c['HostConfig'].update(CapAdd=['SYS_ADMIN']),'no extra capability'),
        ('network',lambda c:c['HostConfig'].update(NetworkMode='bridge'),'exact required guard'),
        ('OOM-true',lambda c:c['HostConfig'].update(OomKillDisable=True),'only observed unset'),
        ('OOM-zero',lambda c:c['HostConfig'].update(OomKillDisable=0),'only observed unset'),
        ('PID-bool',lambda c:c['State'].update(Pid=False),'exact state types'),
        ('exit-bool',lambda c:c['State'].update(ExitCode=False),'exact state types'),
        ('OOM-state-int',lambda c:c['State'].update(OOMKilled=0),'exact state types'),
        ('restart-bool',lambda c:c['HostConfig']['RestartPolicy'].update(MaximumRetryCount=False),'no restart'),
        ('duplicate-env',lambda c:c['Config']['Env'].append('HOME=/other'),'unique env'),
        ('extra-env',lambda c:c['Config']['Env'].append('NODE_PATH=/unlisted'),'fixed public env'),
        ('started-as-created',lambda c:c['State'].update(Status='running',Running=True,Pid=123),'never started')]
    for name,mutate,token in changes:
        variant=copy.deepcopy(base);mutate(variant)
        no('mock-'+name,lambda variant=variant:check(variant),token,(ValueError,))
    # Matching mixed sources in both coordinate sets still must fail.
    variant=copy.deepcopy(base);table=recipe['finiteBindCoordinateTable'][0]
    for rows,destination in ((variant['HostConfig']['Mounts'],'Target'),(variant['Mounts'],'Destination')):
        next(r for r in rows if r['Type']=='bind'and r[destination]==table['destination'])['Source']=table['hostSourceLiteral']
    no('mock-consistent-but-mixed-coordinate-vector',lambda:check(variant),'one complete',(ValueError,))
    variant=copy.deepcopy(base);variant['HostConfig']['Memory']=2147483648
    owner=m.own(variant,recipe,cid);assert owner=={'Id':cid,'operationUUID':recipe['operationUUID']}
    yes('mock-own-only-cleanup-guard-after-resource-failure',lambda:owner)
    variant['Config']['Labels']['com.cortex.operation']='foreign'
    no('mock-cleanup-guard-refuses-foreign',lambda:m.own(variant,recipe,cid),'exact owned',(ValueError,))
try:
    selector_controls();resource_controls();metadata_controls()
except BaseException as error:errors.append(repr(error))
result={'scope':'INDEPENDENT_FINITE_SOURCE_FUNCTION_AND_MOCK_CONTROLS_ONLY','status':'PASS'if not errors else'FAIL','checks':checks,'count':len(checks),'errors':errors,'Docker':False,'subjects':False,'actualPipelineExecuted':0,'native':False,'original48':'UNEXECUTED_HELD','Task03':'HELD','Task04':'OPEN','wholeGoal':'OPEN','closureFailure':'PRESERVED_NOT_REFRESHED','resourceInputs':'SUBSTITUTED_CGROUP_AND_STATVFS','metadataInputs':'MOCKED_ONLY'}
with(D/'helper-controls-results.json').open('x')as f:f.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'count':len(checks),'errors':errors}));raise SystemExit(bool(errors))
