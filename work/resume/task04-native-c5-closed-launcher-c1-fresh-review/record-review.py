from pathlib import Path
import os,stat,json,hashlib,gzip,datetime,subprocess,importlib.util,sys
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-native-c5-closed-launcher-c1-fresh-review';T=Path('/tmp/cortex-native-c5-closed-launcher-c1-fresh-review');H=lambda b:hashlib.sha256(b).hexdigest();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def put(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def row(p,archive=False):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and p.resolve()==p
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);blocks=[]
  while True:
   x=os.read(fd,1048576)
   if not x:break
   blocks.append(x)
  identity=lambda z:tuple(getattr(z,'st_'+k) for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns']);assert identity(a)==identity(os.fstat(fd))==identity(p.lstat());b=b''.join(blocks)
 finally:os.close(fd)
 d={'path':str(p),'bytes':len(b),'sha256':H(b),'identity':{k:getattr(s,'st_'+k) for k in ['dev','ino','mode','uid','nlink','size','mtime_ns','ctime_ns']}}
 if archive:
  target=T/'prebytes'/(H(b)+'.gz');target.parent.mkdir(exist_ok=True)
  if not target.exists():target.write_bytes(gzip.compress(b,mtime=0))
  encoded=target.read_bytes();assert gzip.decompress(encoded)==b;d.update(beforeByteBacking=str(target),encodedBytes=len(encoded),encodedSHA256=H(encoded),exactDecompressionVerified=True)
 return d
def verify_seal(base,name):
 d=json.loads((base/name).read_bytes());rs=d['files'];actual=set()
 for dp,dn,fn in os.walk(base,followlinks=False):
  for n in fn+[n for n in dn if (Path(dp)/n).is_symlink()]:actual.add(str((Path(dp)/n).relative_to(base)))
 assert actual=={x['path'] for x in rs}|{name}
 for x in rs:
  p=base/x['path'];s=p.lstat()
  if stat.S_ISLNK(s.st_mode):
   b=os.fsencode(os.readlink(p));assert H(b)==x['sha256'];assert b.hex()==x.get('targetHex',b.hex())
  else:
   b=p.read_bytes();assert len(b)==x['bytes'] and H(b)==x['sha256']
 return {'path':str(base/name),'sha256':H((base/name).read_bytes()),'rows':len(rs),'literalSetExact':True}
receipt={'utcPRE':utc(),'scope':'NEW trusted finite component review only; originals HELD','internalEsbuildServiceArgvAndRaw':'NOT_CAPTURED','environmentIntegrity':'toolchain observation plus restricted child env; not whole OS/environment integrity','historicalCustody':'BROKEN; six earlier receipts omitted C4 scratch'}
src=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c1';q=R/'_goals/convex-backend-runtime-2026-10-02/qa';receipt['candidateSeals']=[verify_seal(src,'work-manifest.json'),verify_seal(q/'task04-native-c5-closed-launcher-c1','qa-manifest.json')]
files=set(W.glob('*.mjs'))|set(W.glob('*.py'))|set(src.glob('*.mjs'))|set(src.glob('*.py'))
for name,key in [('runner-dependency-inventory.json','inputs'),('toolchain-evidence.json','files')]:
 for x in json.loads((q/'task04-model-drift-native-extra-preparation-c5'/name).read_bytes())[key]:
  p=R/x['path']
  if p.is_file():files.add(p)
node=Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node');files.add(node)
pre=[row(p,True) for p in sorted(files)];put(W/'sourcePRE.json',pre)
spec=importlib.util.spec_from_file_location('owned_capture',W/'capture-originals-owned.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
try:
 receipt['original8PRE']=module.capture('review-before')
 tmp=T/'child-tmp';tmp.mkdir(exist_ok=True);env={'PATH':str(node.parent)+':/usr/bin:/bin','TMPDIR':str(tmp)};receipt['childEnvironment']=env;receipt['commands']=[]
 for name in ['controls.mjs','extra-controls.mjs']:
  argv=[str(node),'--experimental-vm-modules',str(W/name)];command={'argv':argv,'cwd':str(R),'utcStart':utc()};p=subprocess.run(argv,cwd=R,env=env,capture_output=True,timeout=120);command.update(utcEnd=utc(),exitCode=p.returncode);(W/(name+'.stdout')).write_bytes(p.stdout);(W/(name+'.stderr')).write_bytes(p.stderr);receipt['commands'].append(command)
except BaseException as e:receipt['primaryFailure']={'type':type(e).__name__,'message':str(e)}
finally:
 try:receipt['original8POST']=module.capture('review-after')
 except BaseException as e:receipt['secondaryFailure']={'type':type(e).__name__,'message':str(e)}
 receipt['sourcePOST']=[row(p) for p in sorted(files)];receipt['utcPOST']=utc()
 if 'original8PRE' in receipt and 'original8POST' in receipt:
  a=json.loads(gzip.decompress(Path(receipt['original8PRE']['path']).read_bytes()));b=json.loads(gzip.decompress(Path(receipt['original8POST']['path']).read_bytes()));receipt['original8LiteralRowsAndIdentitiesEqual']=a['files']==b['files']
 receipt['sourceByteHashesEqual']=all(a['sha256']==b['sha256'] and a['bytes']==b['bytes'] for a,b in zip(pre,receipt['sourcePOST']));put(W/'receipt.json',receipt)
print(json.dumps({k:receipt.get(k) for k in ['commands','primaryFailure','secondaryFailure','original8LiteralRowsAndIdentitiesEqual','sourceByteHashesEqual','candidateSeals']}))
