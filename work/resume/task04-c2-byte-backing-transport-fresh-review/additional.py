import os,sys,stat,json,hashlib,subprocess,datetime,gzip,resource
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c2-byte-backing-transport-fresh-review';T=Path('/tmp/cortex-c2-backing-transport-fresh-review');I=T/'public-input';runs=T/'runs';c=T/'controls'/'small-positive';payload=b'DUMMY_PUBLIC_CONTROL';oh=hashlib.sha256(payload).hexdigest();ip=c/'index.json';pin=hashlib.sha256(ip.read_bytes()).hexdigest();pre=json.loads((W/'sourcePRE-continuation.json').read_text());b=Path(__file__).read_bytes();h=hashlib.sha256(b).hexdigest();a=T/'source-prebytes'/(h+'.gz');a.write_bytes(gzip.compress(b,mtime=0));a.chmod(0o600);assert gzip.decompress(a.read_bytes())==b;pre.append({'path':str(Path(__file__)),'bytes':len(b),'sha256':h});(W/'sourcePRE-additional.json').write_text(json.dumps(pre,indent=2)+'\n');records=[]
def run(name,index,dst,expected=1,cap=False):
 argv=[str(Path(sys.executable).resolve()),str(I/'materialize.py'),'--index',str(index),'--index-sha256',pin,'--destination',str(dst)];start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=R,env={'PATH':'/usr/bin:/bin','TMPDIR':str(T)},capture_output=True,preexec_fn=(lambda:resource.setrlimit(resource.RLIMIT_FSIZE,(1,1))) if cap else None);end=datetime.datetime.now(datetime.timezone.utc).isoformat();d=runs/name;d.mkdir();(d/'stdout').write_bytes(p.stdout);(d/'stderr').write_bytes(p.stderr);rec={'name':name,'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':end,'exit':p.returncode,'expectedExit':expected,'outcomeMatched':p.returncode==expected,'RLIMIT_FSIZE':1 if cap else None};(d/'receipt.json').write_text(json.dumps(rec,indent=2)+'\n');records.append(rec);return p
for name,kind in [('source-index-hardlink-extra','hardlink'),('source-part-directory-extra','dir')]:
 d=T/name;d.mkdir();(d/'index.json').write_bytes(ip.read_bytes());(d/'objects.part-0000').write_bytes((c/'objects.part-0000').read_bytes())
 if kind=='hardlink':os.link(d/'index.json',d/'foreign-index')
 else:(d/'objects.part-0000').unlink();(d/'objects.part-0000').mkdir()
 dst=T/(name+'-dst');r=run(name,d/'index.json',dst);assert r.returncode==1 and not dst.exists()
# Bind required source-ancestry denial to actual outcome: this assertion fails on frozen helper.
r=run('source-ancestor-symlink-required-denial',T/'source-ancestor-link'/'index.json',T/'source-ancestor-required-denial',expected=1);assert r.returncode==0;assert (T/'source-ancestor-required-denial'/'objects'/oh).read_bytes()==payload
for name,kind in [('destination-object-directory-symlink','dirlink'),('destination-object-hardlink','hardlink'),('destination-object-symlink','symlink')]:
 dst=T/name;dst.mkdir(mode=0o700);obj=dst/'objects';foreign=T/(name+'-foreign')
 if kind=='dirlink':foreign.mkdir(mode=0o700);obj.symlink_to(foreign,target_is_directory=True)
 else:
  obj.mkdir(mode=0o700);foreign.write_bytes(payload);foreign.chmod(0o600)
  if kind=='hardlink':os.link(foreign,obj/oh)
  else:(obj/oh).symlink_to(foreign)
 r=run(name,ip,dst);assert r.returncode==1
 if kind=='dirlink':assert list(foreign.iterdir())==[]
 else:assert foreign.read_bytes()==payload
# OS failure after validation: explicit partial object stays; next verification denies it.
dst=T/'late-fsize-partial';r=run('late-os-fsize-partial',ip,dst,cap=True);assert r.returncode==1 and dst.is_dir() and (dst/'objects'/oh).stat().st_size==1
r=run('late-partial-idempotent-denial',ip,dst);assert r.returncode==1 and (dst/'objects'/oh).stat().st_size==1
for row in pre:
 p=Path(row['path']);s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1;fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(fd,'rb') as f:b=f.read()
 assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
(W/'sourcePOST-additional.json').write_text(json.dumps(pre,indent=2)+'\n');(W/'additional-results.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps({'commands':len(records),'requiredDenialFailures':1,'sourcePOST':'UNCHANGED'}))
