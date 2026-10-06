"""Actual changed assert_recipe controls; no external effects or private reads."""
from pathlib import Path
import contextlib, copy, hashlib, importlib.util, io, json, sys
sys.dont_write_bytecode = True
B=Path(__file__).resolve().parent
SOURCE=B/'task03-attempt5-private-coordinate.py'
spec=importlib.util.spec_from_file_location('repair2_actual_guards',SOURCE)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def base(selector=False):
    name=m.SELECTOR_NAME if selector else m.NAME
    host=[{'Type':'volume','Source':m.VOLUME,'Target':'/owned','VolumeOptions':{'NoCopy':True}}]
    view=[{'Type':'volume','Name':m.VOLUME,'Destination':'/owned','RW':True}]
    if not selector:
        host.append({'Type':'volume','Source':m.VOLUME,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}})
        view.append({'Type':'volume','Name':m.VOLUME,'Destination':'/prep','RW':False})
    return {'Name':'/'+name,'Image':m.IMAGE,'Config':{'Labels':{'cortex.operation':m.OP},'User':'501:20'},'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Memory':536870912,'MemorySwap':536870912,'PidsLimit':64,'NanoCpus':2000000000,'Mounts':host},'Mounts':view,'State':{'Running':False}}
def set_at(obj,path,value):
    for key in path[:-1]:obj=obj[key]
    obj[path[-1]]=value
def delete_at(obj,path):
    for key in path[:-1]:obj=obj[key]
    del obj[path[-1]]
rows=[]
def case(name,selector,change=None,reject=True):
    obj=base(selector)
    if change:change(obj)
    out,err=io.StringIO(),io.StringIO();error=None
    with contextlib.redirect_stdout(out),contextlib.redirect_stderr(err):
        try:m.assert_recipe(obj,m.SELECTOR_NAME if selector else m.NAME,selector=selector)
        except (AssertionError,KeyError,TypeError,AttributeError) as exc:error=type(exc).__name__
    row={'name':name,'selector':selector,'expectedRejected':reject,'observedRejected':error is not None,'exception':error,'status':'PASS' if reject==(error is not None) else 'FAIL','exactInput':obj,'stdout':out.getvalue(),'stderr':err.getvalue(),'actualChangedGuardExecuted':True,'actualDockerCalls':0,'actualAPICalls':0,'realPrivateReads':0}
    rows.append(row)
    assert row['status']=='PASS',name
for selector in (False,True):
    prefix='selector-' if selector else 'receiver-'
    case(prefix+'valid',selector,reject=False)
    fields=[('Running',('State','Running'),False),('ReadonlyRootfs',('HostConfig','ReadonlyRootfs'),True),('owned-NoCopy',('HostConfig','Mounts',0,'VolumeOptions','NoCopy'),True),('owned-RW',('Mounts',0,'RW'),True)]
    if not selector:
        fields += [('prep-NoCopy',('HostConfig','Mounts',1,'VolumeOptions','NoCopy'),True),('prep-ReadOnly',('HostConfig','Mounts',1,'ReadOnly'),True),('prep-RW',('Mounts',1,'RW'),False)]
    for field,path,expected in fields:
        for label,value in [('zero',0),('one',1),('float-zero',0.0),('float-one',1.0),('other-int',2),('string','true'),('null',None),('list',[]),('dict',{}),('wrong-bool',not expected)]:
            case(prefix+field+'-'+label,selector,lambda obj,p=path,v=value:set_at(obj,p,v))
        case(prefix+field+'-missing',selector,lambda obj,p=path:delete_at(obj,p))
    invalid=[('foreign-name',('Name',),'/foreign'),('foreign-image',('Image',),'foreign'),('foreign-operation',('Config','Labels','cortex.operation'),'foreign'),('wrong-user',('Config','User'),'0:0'),('wrong-network',('HostConfig','NetworkMode'),'host'),('wrong-memory',('HostConfig','Memory'),1),('wrong-swap',('HostConfig','MemorySwap'),1),('wrong-pids',('HostConfig','PidsLimit'),1),('wrong-cpu',('HostConfig','NanoCpus'),1),('wrong-owned-source',('HostConfig','Mounts',0,'Source'),'foreign'),('wrong-owned-target',('HostConfig','Mounts',0,'Target'),'/foreign'),('wrong-owned-volume',('Mounts',0,'Name'),'foreign'),('wrong-owned-destination',('Mounts',0,'Destination'),'/foreign')]
    if not selector:
        invalid += [('wrong-subpath',('HostConfig','Mounts',1,'VolumeOptions','Subpath'),'foreign'),('wrong-prep-source',('HostConfig','Mounts',1,'Source'),'foreign'),('wrong-prep-target',('HostConfig','Mounts',1,'Target'),'/foreign'),('wrong-prep-volume',('Mounts',1,'Name'),'foreign'),('wrong-prep-destination',('Mounts',1,'Destination'),'/foreign')]
    for label,path,value in invalid:case(prefix+label,selector,lambda obj,p=path,v=value:set_at(obj,p,v))
    case(prefix+'host-extra-mount',selector,lambda obj:obj['HostConfig']['Mounts'].append(copy.deepcopy(obj['HostConfig']['Mounts'][0])))
    case(prefix+'host-missing-mount',selector,lambda obj:obj['HostConfig']['Mounts'].pop())
    case(prefix+'inspection-extra-mount',selector,lambda obj:obj['Mounts'].append(copy.deepcopy(obj['Mounts'][0])))
    case(prefix+'inspection-missing-mount',selector,lambda obj:obj['Mounts'].pop())
    case(prefix+'extra-owned-ReadOnly-numeric',selector,lambda obj:obj['HostConfig']['Mounts'][0].update(ReadOnly=1))
    case(prefix+'extra-owned-ReadOnly-boolean',selector,lambda obj:obj['HostConfig']['Mounts'][0].update(ReadOnly=False))
    case(prefix+'extra-volume-option',selector,lambda obj:obj['HostConfig']['Mounts'][0]['VolumeOptions'].update(Subpath='foreign'))
    if not selector:
        case(prefix+'duplicate-inspection-destination',selector,lambda obj:obj['Mounts'][1].update(Destination='/owned'))
        case(prefix+'reordered-host-mounts',selector,lambda obj:obj['HostConfig']['Mounts'].reverse())
result={'scope':'ACTUAL_REPAIR2_RECIPE_GUARDS_ONLY','status':'PASS','controls':len(rows),'positiveControls':sum(not r['expectedRejected'] for r in rows),'negativeControls':sum(r['expectedRejected'] for r in rows),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'cases':rows,'actualDockerCalls':0,'actualAPICalls':0,'realPrivateReads':0,'independentJudgment':False,'sourceApproved':False}
(B/'guard-controls.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ('scope','status','controls','positiveControls','negativeControls','sourceSha256')}))
