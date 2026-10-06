import os,sys,stat,json,hashlib,copy,importlib.util,ast,difflib
from pathlib import Path
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
G=R/'_goals/convex-backend-runtime-2026-10-02';Q=G/'qa/task03-local-native-attempt5-2026-10-06';S=Q/'coordinate-source/repair1';P=Path(__file__).parent
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
rows={}
def identity(s):return {k:str(getattr(s,k)) for k in FIELDS}
def read(p):
 p=Path(p);a=p.lstat();assert stat.S_ISREG(a.st_mode)
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  pre=identity(a);assert pre==identity(os.fstat(fd));chunks=[]
  while True:
   d=os.read(fd,1048576)
   if not d:break
   chunks.append(d)
  raw=b''.join(chunks);assert len(raw)==a.st_size;assert pre==identity(os.fstat(fd))==identity(p.lstat())
 finally:os.close(fd)
 rows[str(p)]={'path':str(p),'identityDecimal':pre,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'EOF':True}
 return raw
def manifest(root,name,count,sha):
 raw=read(root/name);assert hashlib.sha256(raw).hexdigest()==sha;j=json.loads(raw);assert len(j['files'])==count
 for x in j['files']:
  data=read(root/x['path']);assert len(data)==x['bytes'] and hashlib.sha256(data).hexdigest()==x['sha256'],x['path']
 return j
new=manifest(S,'source-receipt-manifest.json',17,'ac534048aabb9920cac771e89f9ad61091f03b58bcc999c2957258298c2086ca')
old=manifest(Q/'coordinate-source','source-receipt-manifest.json',131,'5905b7f6083d255acc1ceb9f86835b37921df89e007c192215e4cad47542b125')
freeze=manifest(Q,'candidate-freeze-attempt5.json',1905,'053e131a8f408031af7ead1e2c8c73f75954ba5acd905eac9e6091a24429e570')
assert {str(p.relative_to(S)) for p in S.rglob('*') if p.is_file()}=={x['path'] for x in new['files']}|{'source-receipt-manifest.json'}
conservation=[]
for name in old['sources']:
 parent=read(Q/'coordinate-source'/name);pre=read(S/'preimages'/name);current=read(S/name);assert parent==pre
 expected=parent.replace(b"P = Q / 'coordinate-source'",b"P = Q / 'coordinate-source/repair1'") if name=='task03-attempt5-public-coordinate.py' else parent
 assert expected==current,name
 conservation.append({'path':name,'exactParentPreimage':True,'delta':'one literal namespace' if parent!=current else 'NONE','currentSha256':hashlib.sha256(current).hexdigest()})
 if name.endswith('.py'):ast.parse(current)
prior=G/'qa/local-resume-2026-10-05/task03-attempt5-public-source-review'
priorbindings=json.loads(read(prior/'source-bindings-final.json'))
for row in priorbindings['files']:
 data=read(Path(row['path']));assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'];assert rows[row['path']]['identityDecimal']==row['identityDecimal']
# Inspect every retained raw control and stream identity; no control is rerun against Docker.
controls=[]
for folder in ['fresh-common-controls','fresh-descendant-controls']:
 root=prior/folder;c=json.loads(read(root/'controls.json'));assert c['status']=='PASS';controls.append(c)
 for f in root.iterdir():
  if f.is_file():read(f)
 for receipt in root.glob('*.receipt.json'):
  j=json.loads(read(receipt));label=j['label']
  for channel in ['stdout','stderr']:
   raw=read(root/(label+'.'+channel));assert hashlib.sha256(raw).hexdigest()==j[channel+'Sha256']
failed=json.loads(read(prior/'recipe-mount-binding-check.json'));assert failed['status']=='FAIL'
for n in ['task03-attempt5-preparation-review','task03-attempt5-management-review']:
 v=json.loads(read(G/'qa/local-resume-2026-10-05'/n/'verdict.json'));assert v['verdict']=='PASS'
# Import only guarded public module. Calls and inspect outputs are explicit blocked seams.
spec=importlib.util.spec_from_file_location('judge_public',S/'task03-attempt5-public-coordinate.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
b=json.loads(read(S/'public-recipe-binding.json'));assert b['ownedSourceMounts']=={'candidate':'/host_mnt'+str(m.Q),'helper':'/host_mnt'+str(m.P)};assert m.P==S and m.Q==Q and b['preparationFreezeSha256']==m.FREEZE
assert b['publicCopiedFiles']==1912 and b['preparationMembers']==1905
base={'Image':m.IMAGE,'Config':{'User':'501:20','Labels':{'cortex.operation':m.OP}},'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'Memory':536870912,'MemorySwap':536870912},'State':{'Running':False,'OOMKilled':False,'ExitCode':0},'Mounts':[{'Type':'volume','Name':m.VOLUME,'Destination':'/owned','RW':True},{'Type':'bind','Source':b['ownedSourceMounts']['candidate'],'Destination':'/input','RW':False},{'Type':'bind','Source':b['ownedSourceMounts']['helper'],'Destination':'/helper','RW':False}]}
cases=[('exact',None,False),('original-malformed',lambda o:o['Mounts'][1].update(Source=failed['actualBinding']['candidate']),True),('wrong-helper',lambda o:o['Mounts'][2].update(Source='/host_mnt'+str(S.parent)),True),('wrong-candidate',lambda o:o['Mounts'][1].update(Source='/host_mnt'+str(Q.parent)),True),('writable-helper',lambda o:o['Mounts'][2].update(RW=True),True),('writable-candidate',lambda o:o['Mounts'][1].update(RW=True),True),('extra-bind',lambda o:o['Mounts'].append(copy.deepcopy(o['Mounts'][1])),True),('wrong-volume',lambda o:o['Mounts'][0].update(Name='foreign'),True),('wrong-user',lambda o:o['Config'].update(User='0:0'),True),('wrong-label',lambda o:o['Config']['Labels'].update({'cortex.operation':'foreign'}),True),('network',lambda o:o['HostConfig'].update(NetworkMode='bridge'),True),('writable-root',lambda o:o['HostConfig'].update(ReadonlyRootfs=False),True),('wrong-swap',lambda o:o['HostConfig'].update(MemorySwap=0),True),('oom',lambda o:o['State'].update(OOMKilled=True),True),('running',lambda o:o['State'].update(Running=True),True),('exit',lambda o:o['State'].update(ExitCode=1),True)]
result=[]
class Blocked:
 def __init__(self,obj):self.obj=obj;self.calls=[]
 def run(self,label,argv,*args,**kwargs):
  self.calls.append({'label':label,'argv':argv,'effectsBlocked':True});return {'terminal':True,'closeErrors':[],'exitCode':0,'failureClass':None},json.dumps([self.obj]).encode() if 'inspect' in argv else b'PUBLIC_MOCK_ONLY',b''
for name,change,reject in cases:
 obj=copy.deepcopy(base)
 if change:change(obj)
 c=Blocked(obj);m.C=c;m.records=[];error=None
 try:m.execute('copy','501:20',[],['PUBLIC_MOCK_ONLY'],30)
 except AssertionError as e:error=type(e).__name__
 assert (error is not None)==reject,name
 result.append({'name':name,'rejected':reject,'error':error,'calls':c.calls})
# Nonterminal command cannot proceed even when a synthetic inspect would be valid.
class Unknown(Blocked):
 def run(self,*args,**kwargs):
  row,raw,stderr=super().run(*args,**kwargs);row['terminal']=False;return row,raw,stderr
m.C=Unknown(base);error=None
try:m.execute('copy','501:20',[],['PUBLIC_MOCK_ONLY'],30)
except AssertionError as e:error=type(e).__name__
assert error is not None;result.append({'name':'nonterminal-command','rejected':True,'error':error,'calls':m.C.calls})
(P/'fresh-binding-guards.json').write_text(json.dumps({'status':'PASS','checks':len(result),'rows':result,'actualDocker':False,'actualCustody':False,'actualTerminalObservation':False},indent=2)+'\n')
(P/'audit.json').write_text(json.dumps({'status':'PASS','newManifestMembers':17,'originalManifestMembers':131,'preparationMembers':1905,'publicCopiedFiles':1912,'conservation':conservation,'priorMountFailurePreserved':failed,'retainedRawControls':controls,'allNineFullBytesEOFReread':True,'sources':list(rows.values()),'actualDockerAndServices':0,'privateDraftRead':False},indent=2)+'\n')
print(json.dumps({'status':'PASS','manifestMembers':[17,131,1905],'stableFiles':len(rows),'newSourceGuards':len(result),'Docker':0,'services':0}))
