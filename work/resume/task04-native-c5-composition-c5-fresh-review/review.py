import os,stat,json,gzip,hashlib,time,subprocess,signal,datetime,pathlib
R=pathlib.Path('/workspace/Project-Cortex');W=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c5';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-closed-launcher-c5';T=pathlib.Path('/tmp/cortex-native-c5-closed-launcher-c5');OWN=pathlib.Path((R/'work/resume/task04-native-c5-composition-c5-fresh-review/own-root.txt').read_text().strip());E=pathlib.Path('/tmp/cortex-native-c5-independent-review-c5-15b2ef7a-3243-4271-a78d-bf819fdf7393');B=OWN/'reviewer-backing';B.mkdir(exist_ok=True)
H=lambda b:hashlib.sha256(b).hexdigest()
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def ident(s):return {k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']}
def held(p,back=False):
 p=pathlib.Path(p);s=p.lstat();assert stat.S_ISREG(s.st_mode);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert ident(os.fstat(fd))==ident(s);data=[]
  while True:
   b=os.read(fd,1048576)
   if not b:break
   data.append(b)
  b=b''.join(data);assert ident(os.fstat(fd))==ident(s)==ident(p.lstat())
 finally:os.close(fd)
 row={'path':str(p),'bytes':len(b),'sha256':H(b),'identity':ident(s)}
 if back:
  bp=B/(H(b)+'.gz')
  if not bp.exists():bp.write_bytes(gzip.compress(b,mtime=0))
  bb=bp.read_bytes();assert gzip.decompress(bb)==b;row['backing']={'path':str(bp),'bytes':len(bb),'sha256':H(bb),'decodedSHA256':H(b),'decodedBytes':len(b)}
 return row,b

def load(p):
 b=held(p)[1];return json.loads(gzip.decompress(b) if str(p).endswith('.gz') else b)
def save(n,d):
 b=json.dumps(d,separators=(',',':')).encode()+b'\n';p=OWN/(n+'.json.gz');p.write_bytes(gzip.compress(b,mtime=0));return held(p)[0]
def seals():
 results=[]
 for root,name in [(Q,'selfseal.json'),(W,'selfseal.json'),(T,'selfseal.json.gz'),(E,'selfseal.json.gz')]:
  d=load(root/name);errs=[];actual=set()
  for dp,dn,fn in os.walk(root,followlinks=False):
   actual.add(str(pathlib.Path(dp).relative_to(root)));actual.update(str((pathlib.Path(dp)/n).relative_to(root)) for n in fn+ [n for n in dn if (pathlib.Path(dp)/n).is_symlink()])
  assert actual-{name}=={r['path'] for r in d['rows']}
  for row in d['rows']:
   p=root/row['path'];s=p.lstat()
   if ident(s)!=row['identity']:errs.append({'path':str(p),'error':'IDENTITY'})
   if row['kind']=='file':
    rr,b=held(p)
    if rr['sha256']!=row['sha256'] or rr['bytes']!=row['bytes']:errs.append({'path':str(p),'error':'BYTES'})
   elif row['kind']=='directory':
    if sorted(os.listdir(p))!=row['members']:errs.append({'path':str(p),'error':'MEMBERS'})
   else:
    b=os.fsencode(os.readlink(p));assert os.readlink(p)==row['target']
  results.append({'root':str(root),'seal':held(root/name)[0],'rows':len(d['rows']),'errors':errs,'utc':utc()})
 return results

def sources():
 paths=set()
 for row in load(Q/'sourcepins.json')['rows']:paths.add(row['path'])
 for p in T.iterdir():
  if p.is_file() and p.suffix=='.json':paths.add(str(p))
 for row in load(T/'package-graph.json')['files']:paths.add(row['path'])
 for row in load(W/'mirror-source-transform-map.json')['inputs']:paths.add(row['source']);paths.add(row['destination'] if 'destination' in row else row.get('mirror',row['source']))
 for row in load(W/'prepared-source-inputs.json')['files']:paths.add(row['path'])
 paths.update(str(p) for p in W.iterdir() if p.is_file());paths.add('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node');paths.add(str(OWN/'control.mjs'));paths.add(__file__)
 return [held(p,True)[0] for p in sorted(paths)]

def originals(label):
 # byte-exact original recorder logic, only output destination and label constraints adapted to reviewer OWN.
 src=(W/'capture-originals.py').read_text();src=src[:src.index("if __name__")];src=src.replace("Path('/tmp/cortex-native-c5-closed-launcher-c5/captures')","Path("+repr(str(OWN/'original-captures'))+")")
 p=OWN/'original-recorder.py';p.write_text(src);held(p,True);ns={};exec(compile(src,str(p),'exec'),ns);return ns['capture'](label)

def run(label):
 pre={'utc':utc(),'subjects':seals(),'sources':sources(),'original8':originals(label+'-PRE')};save(label+'-PRE',pre)
 env={'PATH':'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin','TMPDIR':str(OWN/'tmp')};(OWN/'tmp').mkdir(exist_ok=True)
 argv=['/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node','--experimental-vm-modules',str(OWN/'control.mjs')];start=utc();t=time.monotonic();out=open(OWN/(label+'.stdout.raw'),'wb');err=open(OWN/(label+'.stderr.raw'),'wb');p=subprocess.Popen(argv,cwd=str(R),env=env,start_new_session=True,stdout=out,stderr=err);timed=False
 try:code=p.wait(timeout=120)
 except subprocess.TimeoutExpired:
  timed=True;os.killpg(p.pid,signal.SIGTERM)
  try:code=p.wait(timeout=2)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);code=p.wait()
 out.close();err.close();obs=[]
 for proc in pathlib.Path('/proc').iterdir():
  if proc.name.isdigit():
   try:
    st=(proc/'stat').read_text();rest=st[st.rindex(')')+2:].split()
    if int(rest[2])==p.pid:obs.append({'pid':int(proc.name),'state':rest[0]})
   except (FileNotFoundError,PermissionError,ProcessLookupError):pass
 receipt={'argv':argv,'cwd':str(R),'env':env,'utcStart':start,'utcEnd':utc(),'elapsed':time.monotonic()-t,'pid':p.pid,'exit':code,'timeout':timed,'processGroupMembers':obs,'quiescent':not obs,'stdout':held(OWN/(label+'.stdout.raw'))[0],'stderr':held(OWN/(label+'.stderr.raw'))[0]};save(label+'-execution',receipt);print(json.dumps(receipt),flush=True)
 post={'utc':utc(),'subjects':seals(),'sources':sources(),'original8':originals(label+'-POST')};save(label+'-POST',post)
 assert all(not x['errors'] for x in pre['subjects']+post['subjects']);assert load(pre['original8']['path'])['files']==load(post['original8']['path'])['files'];assert [(x['path'],x['bytes'],x['sha256'],x['identity']) for x in pre['sources']]==[(x['path'],x['bytes'],x['sha256'],x['identity']) for x in post['sources']]
 return receipt
if __name__=='__main__':
 (OWN/'control.mjs').write_bytes((E/'control.mjs').read_bytes());print(json.dumps(run('exact-seam')),flush=True)
