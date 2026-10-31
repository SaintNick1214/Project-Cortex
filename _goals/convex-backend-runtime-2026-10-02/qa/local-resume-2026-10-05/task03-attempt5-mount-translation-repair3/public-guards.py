"""Imported actual repair3 guards. Every container/process effect is mocked."""
import copy,hashlib,importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA=Path(__file__).absolute().parent
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt5-2026-10-06'
SRC=Q/'coordinate-source/repair3/task03-attempt5-public-coordinate.py'
spec=importlib.util.spec_from_file_location('actual_repair3_public_guard',SRC);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
argv=['PUBLIC_DUMMY_HELPER_NO_EXECUTION']
def base(mapping='literal',label='copy'):
 source=Q/'coordinate-source/repair2/task03-attempt5-public-acquisition'/((label+'-initial-inspect.stdout'))
 obj=json.loads(source.read_bytes())[0]
 obj['Name']='/'+m.NAMES[label];obj['Config']['Cmd']=['/usr/local/bin/python3.12','-B',*argv]
 obj['HostConfig']['Mounts'][0]['Source']=m.VOLUME
 for mount in obj['Mounts']:
  if mount['Type']=='volume':
   mount['Name']=m.VOLUME;mount['Source']='/var/lib/docker/volumes/'+m.VOLUME+'/_data'
 if label=='copy':
  prefix=m.SOURCE_MAPPINGS[mapping]
  for mount in obj['HostConfig']['Mounts'][1:]:mount['Source']=prefix+str(m.Q if mount['Target']=='/input' else m.P)
  for mount in obj['Mounts']:
   if mount['Type']=='bind':mount['Source']=prefix+str(m.Q if mount['Destination']=='/input' else m.P)
 return obj
results=[]
def put(obj,path,value):
 for key in path[:-1]:obj=obj[key]
 obj[path[-1]]=value

def check(name,mutation=None,mapping='literal',label='copy',row_mutation=None,terminal_mutation=None):
 initial=base(mapping,label);terminal=copy.deepcopy(initial)
 if mutation:mutation(initial)
 if terminal_mutation:terminal_mutation(terminal)
 events=[];receipts=[]
 class Fake:
  @staticmethod
  def run(command_label,command,out,timeout,env,required):
   assert required is False and timeout<=120
   events.append({'label':command_label,'argv':command,'timeout':timeout})
   row={'terminal':True,'closeErrors':[],'failureClass':None,'exitCode':0}
   if row_mutation and command_label==label+'-initial-inspect':row_mutation(row)
   stdout=json.dumps([terminal if command_label==label+'-terminal-inspect' else initial]).encode() if 'inspect' in command_label else b'PUBLIC_MOCK_RESULT'
   return row,stdout,b''
  @staticmethod
  def durable_json(path,data):receipts.append(data)
 m.C=Fake;m.records=[]
 failure=None
 try:m.execute(label,'0:0' if label=='init' else '501:20',[],argv,30 if label=='init' else 120)
 except BaseException as e:failure=type(e).__name__
 negative=mutation is not None or row_mutation is not None or terminal_mutation is not None
 assert (failure is not None)==negative,(name,failure)
 starts=[row for row in events if row['argv'][1]=='start']
 if mutation or row_mutation:assert not starts,(name,events)
 if terminal_mutation:assert len(starts)==1 and not any(row['argv'][1]=='rm' for row in events)
 if not negative:
  assert len(starts)==1 and receipts[0]['selectedDaemonSourceMapping']==('volume-only' if label=='init' else mapping)
  assert events[-1]['argv']==[m.DOCKER,'rm',m.NAMES[label]]
 results.append({'name':name,'status':'PASS','expectedReject':negative,'observedException':failure,'deniedBeforeStart':not starts if negative and terminal_mutation is None else None,'allEffectsMocked':True,'events':events,'selectedMappingReceipts':receipts})
check('valid-literal')
check('valid-desktop-host_mnt',mapping='docker-desktop-host_mnt')
check('valid-init-volume-only',label='init')
bools=[('HostConfig','ReadonlyRootfs'),('State','Running'),('State','OOMKilled'),('HostConfig','Mounts',0,'VolumeOptions','NoCopy'),('HostConfig','Mounts',1,'ReadOnly'),('HostConfig','Mounts',2,'ReadOnly'),('Mounts',0,'RW'),('Mounts',1,'RW'),('Mounts',2,'RW')]
for path in bools:
 for value in (0,1,0.0,1.0,None,'true','false'):
  check('strict-bool-'+'.'.join(map(str,path))+'-'+repr(value),lambda obj,p=path,v=value:put(obj,p,v))
mutations={
 'mixed-host-mapping':lambda o:put(o,('HostConfig','Mounts',1,'Source'),'/host_mnt'+str(m.Q)),
 'mixed-actual-mapping':lambda o:put(o,('Mounts',0,'Source'),'/host_mnt'+str(m.P)),
 'foreign-prefix':lambda o:put(o,('HostConfig','Mounts',1,'Source'),'/Volumes'+str(m.Q)),
 'wrong-old-helper-alias':lambda o:put(o,('HostConfig','Mounts',2,'Source'),'/host_mnt'+str(m.P.parent/'repair2')),
 'host-parent-root':lambda o:put(o,('HostConfig','Mounts',1,'Source'),str(m.Q.parent)),
 'actual-parent-root':lambda o:put(o,('Mounts',1,'Source'),str(m.Q.parent)),
 'host-traversal':lambda o:put(o,('HostConfig','Mounts',1,'Source'),str(m.Q)+'/../'+m.Q.name),
 'actual-traversal':lambda o:put(o,('Mounts',1,'Source'),str(m.Q)+'/../'+m.Q.name),
 'crossmount-source':lambda o:put(o,('Mounts',0,'Source'),str(m.Q)),
 'duplicate-target':lambda o:put(o,('Mounts',0,'Destination'),'/input'),
 'host-cardinality':lambda o:o['HostConfig']['Mounts'].pop(),
 'actual-cardinality':lambda o:o['Mounts'].pop(),
 'host-extra-option':lambda o:o['HostConfig']['Mounts'][1].update(BindOptions={'Propagation':'rshared'}),
 'host-volume-source':lambda o:put(o,('HostConfig','Mounts',0,'Source'),'FOREIGN'),
 'actual-volume-source':lambda o:put(o,('Mounts',2,'Source'),'/var/lib/docker/volumes/FOREIGN/_data'),
 'actual-volume-name':lambda o:put(o,('Mounts',2,'Name'),'FOREIGN'),
 'actual-volume-driver':lambda o:put(o,('Mounts',2,'Driver'),'foreign'),
 'volume-extra-readonly':lambda o:o['HostConfig']['Mounts'][0].update(ReadOnly=False),
 'foreign-operation':lambda o:put(o,('Config','Labels','cortex.operation'),'FOREIGN'),
 'foreign-scope':lambda o:put(o,('Config','Labels','cortex.scope'),'FOREIGN'),
 'extra-label':lambda o:o['Config']['Labels'].update(FOREIGN='foreign'),
 'foreign-image':lambda o:o.update(Image='sha256:'+'0'*64),
 'foreign-config-image':lambda o:put(o,('Config','Image'),'sha256:'+'0'*64),
 'foreign-name':lambda o:o.update(Name='/FOREIGN'),
 'bad-container-id':lambda o:o.update(Id='ID'),
 'wrong-platform':lambda o:o.update(Platform='windows'),
 'wrong-user':lambda o:put(o,('Config','User'),'0:0'),
 'wrong-command':lambda o:put(o,('Config','Cmd'),['SHOULD_NOT_EXECUTE']),
 'wrong-entrypoint':lambda o:put(o,('Config','Entrypoint'),['foreign']),
 'host-network':lambda o:put(o,('HostConfig','NetworkMode'),'host'),
 'root-writable':lambda o:put(o,('HostConfig','ReadonlyRootfs'),False),
 'memory-wrong':lambda o:put(o,('HostConfig','Memory'),1073741824),
 'swap-wrong':lambda o:put(o,('HostConfig','MemorySwap'),-1),
 'cpu-wrong':lambda o:put(o,('HostConfig','NanoCpus'),1000000000),
 'pids-wrong':lambda o:put(o,('HostConfig','PidsLimit'),32),
 'float-resource':lambda o:put(o,('HostConfig','PidsLimit'),64.0),
 'running-true':lambda o:put(o,('State','Running'),True),
 'OOM-true':lambda o:put(o,('State','OOMKilled'),True),
}
for name,mutation in mutations.items():check(name,mutation)
for name,mutation in [('nonterminal',lambda r:r.update(terminal=False)),('numeric-terminal',lambda r:r.update(terminal=1)),('close-error',lambda r:r.update(closeErrors=['MOCK_CLOSE_ERROR'])),('failure-unknown',lambda r:r.update(failureClass='OwnedGroupUnknown')),('numeric-exit-bool',lambda r:r.update(exitCode=False))]:check(name,row_mutation=mutation)
check('terminal-id-drift',terminal_mutation=lambda o:o.update(Id='1'*64))
def translate_terminal(o):
 for item in o['HostConfig']['Mounts'][1:]:item['Source']='/host_mnt'+item['Source']
 for item in o['Mounts']:
  if item['Type']=='bind':item['Source']='/host_mnt'+item['Source']
check('terminal-consistent-but-changed-mapping',terminal_mutation=translate_terminal)
result={'scope':'IMPORTED_ACTUAL_PUBLIC_REPAIR3_SOURCE_GUARDS_ONLY','status':'PASS','controls':len(results),'positive':sum(not r['expectedReject'] for r in results),'initialNegativesBeforeStart':sum(r['deniedBeforeStart'] is True for r in results),'terminalNegativesAfterMockStart':2,'sourceSha256':hashlib.sha256(SRC.read_bytes()).hexdigest(),'allEffectsMocked':True,'actualDockerCalls':0,'privateReads':0,'cases':results}
(QA/'raw/public-guards.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='cases'}))
