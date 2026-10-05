import datetime,gzip,hashlib,json,os,shutil,stat,subprocess,sys,resource
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c2-component-byte-backing-c2';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-component-byte-backing-c2';T=Path('/tmp/cortex-c2-component-byte-backing-c2');OLD=Path('/tmp/cortex-c2-backing-transport-fresh-review');J=R/'work/resume/task04-c2-byte-backing-transport-fresh-review';I=T/'inputs';RUN=T/'runs';RUN.mkdir(mode=0o700)
def sha(b):return hashlib.sha256(b).hexdigest()
def row(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1;b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
sources={Path(r['path']) for r in json.loads((J/'sourcePRE-additional.json').read_text())};sources.update([Q/'materialize.py',Q/'index.json',Path(__file__)])
for name in ('report.md','qa-manifest.json'):
 p=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-byte-backing-transport-fresh-review'/name;shutil.copyfile(p,W/('prior-judge-'+name));sources.add(p)
pre=[row(p) for p in sorted(sources)];A=T/'source-before';A.mkdir(mode=0o700)
for r in pre:
 p=Path(r['path']);a=A/(r['sha256']+'.gz')
 if not a.exists():a.write_bytes(gzip.compress(p.read_bytes(),mtime=0));a.chmod(0o600)
 assert sha(gzip.decompress(a.read_bytes()))==r['sha256']
(W/'sourcePRE.json').write_text(json.dumps(pre,indent=2)+'\n')
# Clone previously observed controls, retaining their bytes and link topology in an owned tree.
C=T/'prior-controls';shutil.copytree(OLD,C,symlinks=True,ignore=shutil.ignore_patterns('runs','source-prebytes','public-input','genuine'))
for p in C.rglob('*'):
 if p.is_symlink():
  target=os.readlink(p)
  if target.startswith(str(OLD)+'/'):p.unlink();p.symlink_to(target.replace(str(OLD),str(C),1))
# Recreate state in original observed command order instead of reusing final outputs.
for name in ('small-positive-dst','source-ancestor-observed','source-ancestor-required-denial','late-fsize-partial'):
 p=C/name
 if p.exists():shutil.rmtree(p)
records=[]
def run(name,ip,dst,pin,expected=1,cap=False,wrapper=None):
 argv=[str(Path(sys.executable).resolve()),str(wrapper or Q/'materialize.py'),'--index',str(ip),'--index-sha256',pin,'--destination',str(dst)]
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=R,env={'PATH':'/usr/bin:/bin','TMPDIR':str(T)},capture_output=True,timeout=60,preexec_fn=(lambda:resource.setrlimit(resource.RLIMIT_FSIZE,(1,1))) if cap else None);d=RUN/name;d.mkdir();(d/'stdout').write_bytes(p.stdout);(d/'stderr').write_bytes(p.stderr)
 rec={'name':name,'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':p.returncode,'expectedExit':expected,'stdoutSHA256':sha(p.stdout),'stderrSHA256':sha(p.stderr),'RLIMIT_FSIZE':1 if cap else None};(d/'receipt.json').write_text(json.dumps(rec,indent=2)+'\n');records.append(rec);assert p.returncode==expected,(name,p.returncode,p.stderr[-1000:]);return p
idx=json.loads((I/'index.json').read_bytes());pin=sha((I/'index.json').read_bytes());D=T/'genuine'
for name in ('genuine-full-materialize','genuine-idempotent-verify'):run(name,I/'index.json',D,pin,0)
assert stat.S_IMODE(D.stat().st_mode)==0o700 and stat.S_IMODE((D/'objects').stat().st_mode)==0o700
for o in idx['objects']:
 p=D/'objects'/o['sha256'];assert row(p)['sha256']==o['sha256'] and p.stat().st_size==o['bytes'] and stat.S_IMODE(p.stat().st_mode)==0o600
prior=sorted([json.loads(p.read_text()) for p in (OLD/'runs').glob('*/receipt.json')],key=lambda r:r['startUTC'])
for r in prior:
 name=r['name']
 if name.startswith('genuine-'):continue
 argv=r['argv'];ip=Path(argv[argv.index('--index')+1].replace(str(OLD),str(C),1));dst=Path(argv[argv.index('--destination')+1].replace(str(OLD),str(C),1));pin=argv[argv.index('--index-sha256')+1];expected=1 if 'source-ancestor' in name else r['expectedExit']
 # Original corruption occurred after small-positive; reproduce it at that point.
 if name=='existing-object-no-overwrite':
  for p in (C/'small-positive-dst/objects').iterdir():p.write_bytes(b'CORRUPTION')
 run('prior-'+name,ip,dst,pin,expected,r.get('RLIMIT_FSIZE')==1)
 if name.startswith('source-ancestor'):assert not dst.exists()
# New ancestor/leaf tests use unmodified small fixture bytes.
base=C/'controls/small-positive';smallpin=sha((base/'index.json').read_bytes())
for name,kind,target in [('ancestor-index','ancestor','index.json'),('ancestor-part','partancestor','objects.part-0000'),('leaf-index-hardlink','hardlink','index.json'),('leaf-index-fifo','fifo','index.json'),('leaf-part-fifo','fifo','objects.part-0000')]:
 f=T/name;shutil.copytree(base,f);ip=f/'index.json';dst=T/(name+'-dst')
 if kind=='ancestor':link=T/(name+'-link');link.symlink_to(f);ip=link/'index.json'
 elif kind=='partancestor':
  # Nested symlink ancestor for part and index via the CLI input directory.
  nested=T/(name+'-outer');nested.mkdir();(nested/'linked').symlink_to(f);ip=nested/'linked/index.json'
 elif kind=='hardlink':os.link(f/target,f/'foreign')
 else:(f/target).unlink();os.mkfifo(f/target)
 run(name,ip,dst,smallpin);assert not dst.exists()
# Deterministic mutation during descriptor read proves FD/path identity revalidation.
for target in ('index.json','objects.part-0000'):
 for kind in ('leaf','ancestor'):
  name='during-read-'+kind+'-'+target;f=T/name;shutil.copytree(base,f);wrapper=W/(name+'.py')
  wrapper.write_text('import os,runpy\nfrom pathlib import Path\noriginal=os.fdopen\ntriggered=False\ndef wrapped(fd,*args,**kwargs):\n global triggered\n h=original(fd,*args,**kwargs)\n if not triggered and os.readlink("/proc/self/fd/"+str(fd))=='+repr(str(f/target))+':\n  triggered=True\n  class Reader:\n   def __enter__(self):h.__enter__();return self\n   def __exit__(self,*args):return h.__exit__(*args)\n   def fileno(self):return h.fileno()\n   def read(self):\n    data=h.read()\n'+ ('    p=Path('+repr(str(f/target))+');p.rename(p.with_name(p.name+".parked"));p.write_bytes(data)\n' if kind=='leaf' else '    p=Path('+repr(str(f))+');p.rename(p.with_name(p.name+".parked"));p.mkdir();\n')+'    return data\n  return Reader()\n return h\nos.fdopen=wrapped\nrunpy.run_path('+repr(str(Q/'materialize.py'))+',run_name="__main__")\n')
  run(name,f/'index.json',T/(name+'-dst'),smallpin,wrapper=wrapper);assert not (T/(name+'-dst')).exists()
post=[row(Path(r['path'])) for r in pre];assert pre==post;(W/'sourcePOST.json').write_text(json.dumps(post,indent=2)+'\n')
(W/'results.json').write_text(json.dumps({'records':records,'priorControls':len(prior)-2,'objects':len(idx['objects']),'references':len(idx['references']),'rawObjectBytes':sum(o['bytes'] for o in idx['objects']),'sourcePinsUnchanged':True,'all122':'HELD'},indent=2)+'\n');print(json.dumps({'runs':len(records),'sourcePinsUnchanged':True}))
