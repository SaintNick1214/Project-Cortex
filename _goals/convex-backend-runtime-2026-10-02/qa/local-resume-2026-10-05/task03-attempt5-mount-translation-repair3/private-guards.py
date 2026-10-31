"""Independent exact boolean recipe negatives on the actual imported private source."""
import contextlib,copy,hashlib,importlib.util,io,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
OUT=Path(__file__).resolve().parent
SOURCE=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt5-private-source-repair3/task03-attempt5-private-coordinate.py'
spec=importlib.util.spec_from_file_location('fresh_independent_recipe_source',SOURCE);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def base(selector):
 name=m.SELECTOR_NAME if selector else m.NAME
 host=[{'Type':'volume','Source':m.VOLUME,'Target':'/owned','VolumeOptions':{'NoCopy':True}}]
 mounts=[{'Type':'volume','Name':m.VOLUME,'Destination':'/owned','RW':True}]
 if not selector:
  host.append({'Type':'volume','Source':m.VOLUME,'Target':'/prep','ReadOnly':True,'VolumeOptions':{'NoCopy':True,'Subpath':'candidate'}})
  mounts.append({'Type':'volume','Name':m.VOLUME,'Destination':'/prep','RW':False})
 return {'Name':'/'+name,'Image':m.IMAGE,'Config':{'User':'501:20','Labels':{'cortex.operation':m.OP}},'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Memory':536870912,'MemorySwap':536870912,'PidsLimit':64,'NanoCpus':2000000000,'Mounts':host},'Mounts':mounts,'State':{'Running':False,'ExitCode':0,'OOMKilled':False}}
def put(obj,path,value):
 for k in path[:-1]:obj=obj[k]
 obj[path[-1]]=value
rows=[]
def check(selector,name,path=None,value=None):
 obj=base(selector)
 if path:put(obj,path,value)
 failure=None;stdout=io.StringIO();stderr=io.StringIO()
 with contextlib.redirect_stdout(stdout),contextlib.redirect_stderr(stderr):
  try:m.assert_recipe(obj,m.SELECTOR_NAME if selector else m.NAME,selector=selector)
  except BaseException as e:failure={'class':type(e).__name__,'message':str(e)}
 reject=path is not None
 assert (failure is not None)==reject,(name,obj,failure)
 rows.append({'name':name,'selector':selector,'changedPath':list(path) if path else None,'value':value,'expectedReject':reject,'observedReject':failure is not None,'exception':failure,'status':'PASS','stdout':stdout.getvalue(),'stderr':stderr.getvalue()})
for selector in (False,True):
 prefix='selector' if selector else 'receiver'
 check(selector,prefix+'-valid')
 paths=[('State','Running'),('HostConfig','ReadonlyRootfs'),('HostConfig','Mounts',0,'VolumeOptions','NoCopy'),('Mounts',0,'RW')]
 if not selector:paths += [('HostConfig','Mounts',1,'VolumeOptions','NoCopy'),('HostConfig','Mounts',1,'ReadOnly'),('Mounts',1,'RW')]
 for path in paths:
  for value in (0,1,0.0,1.0,None,'true','false'):
   check(selector,prefix+'-'+'.'.join(map(str,path))+'-'+repr(value),path,value)
result={'scope':'IMPORTED_REPAIR3_PRIVATE_RECIPE_STRICT_BOOLEAN_SOURCE_ONLY','status':'PASS','controls':len(rows),'positiveControls':sum(not r['expectedReject'] for r in rows),'negativeControls':sum(r['expectedReject'] for r in rows),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'cases':rows,'realPrivateReads':0,'DockerCalls':0,'APICalls':0}
(OUT/'raw/private-guards.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='cases'}))
