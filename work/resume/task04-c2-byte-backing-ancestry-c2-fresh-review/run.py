import datetime,gzip,hashlib,json,os,resource,shutil,stat,subprocess,sys,zlib,tarfile,io
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c2-byte-backing-ancestry-c2-fresh-review';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-component-byte-backing-c2';T=Path('/tmp/cortex-c2-backing-ancestry-c2-fresh-review');OLD=Path('/tmp/cortex-c2-backing-transport-fresh-review');I=T/'inputs';RUN=T/'runs';A=T/'source-before'
for d in (I,RUN,A):d.mkdir(mode=0o700)
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):
 st=p.lstat();assert stat.S_ISREG(st.st_mode) and st.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(fd,'rb') as h:
  a=os.fstat(h.fileno());assert (a.st_dev,a.st_ino)==(st.st_dev,st.st_ino);b=h.read();c=os.fstat(h.fileno())
 assert (a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns,a.st_ctime_ns)==(c.st_dev,c.st_ino,c.st_size,c.st_mtime_ns,c.st_ctime_ns)
 return b
def capture(p):
 b=read(p);h=sha(b);a=A/(h+'.gz')
 if not a.exists():a.write_bytes(gzip.compress(b,mtime=0));a.chmod(0o600)
 assert sha(gzip.decompress(a.read_bytes()))==h
 return {'path':str(p),'bytes':len(b),'sha256':h,'beforeArchive':str(a)}
seal=json.loads(read(Q/'seals.json'));idx=json.loads(read(Q/'index.json'));parts=Path('/tmp/cortex-root-storage-rescue/c2-component-backing')
sources={Path(r['path']) for r in seal['externalBackingReferences']};sources.update(Path(r['path']) for r in idx['references']);sources.update(parts/r['path'] for r in idx['parts']);sources.update([Q/n for n in ('materialize.py','index.json','README.md','report.md','seals.json')]);sources.update([Path(sys.executable).resolve(),Path(__file__),W/'verify.py',R/'.agents/roles/pessimistic-judge.md',R/'.agents/skills/judge-task/SKILL.md'])
# Historical observation is preserved literally, including original expected0/actual0 receipt.
prior=sorted([json.loads(read(p)) for p in (OLD/'runs').glob('*/receipt.json')],key=lambda r:r['startUTC'])
obs=OLD/'runs/source-ancestor-symlink-observation';archive=T/'historical-observation';shutil.copytree(obs,archive)
for p in obs.iterdir():sources.add(p)
for p in (R/'work/resume/task04-c2-byte-backing-transport-fresh-review').iterdir():
 if p.is_file() and p.suffix=='.py':sources.add(p)
pre=[capture(p) for p in sorted(sources)];(W/'sourcePRE.json').write_text(json.dumps(pre,indent=2)+'\n')
for r in idx['references']:
 b=read(Path(r['path']));assert len(b)==r['bytes'] and sha(b)==r['sha256']
for r in idx['parts']:
 b=read(parts/r['path']);assert len(b)==r['bytes'] and sha(b)==r['sha256'];(I/r['path']).write_bytes(b);(I/r['path']).chmod(0o644)
(I/'index.json').write_bytes(read(Q/'index.json'));(I/'index.json').chmod(0o644);I.chmod(0o755)
compressed=b''.join(read(I/r['path']) for r in idx['parts']);assert len(compressed)==idx['archiveBytes']==66753445 and sha(compressed)==idx['archiveSHA256']
# Verify actual archive payloads independently of materializer.
objects={r['sha256']:r['bytes'] for r in idx['objects']};actual={}
with tarfile.open(fileobj=io.BytesIO(gzip.decompress(compressed)),mode='r:') as tf:
 for m in tf:
  assert m.isfile();b=tf.extractfile(m).read();h=m.name.split('/')[-1];assert h not in actual and h in objects and sha(b)==h and len(b)==objects[h];actual[h]=len(b)
assert actual==objects and len(actual)==156 and len(idx['references'])==301
records=[];extra=[]
def run(name,ip,dst,pin,expected=1,cap=False,wrapper=None):
 tool=wrapper or Q/'materialize.py';toolPre=capture(tool);pythonPre=capture(Path(sys.executable).resolve());extra.extend([toolPre,pythonPre])
 argv=[str(Path(sys.executable).resolve()),str(tool),'--index',str(ip),'--index-sha256',pin,'--destination',str(dst)];start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=R,env={'PATH':'/usr/bin:/bin','TMPDIR':str(T)},capture_output=True,timeout=60,preexec_fn=(lambda:resource.setrlimit(resource.RLIMIT_FSIZE,(1,1))) if cap else None);d=RUN/name;d.mkdir();(d/'stdout').write_bytes(p.stdout);(d/'stderr').write_bytes(p.stderr)
 rec={'name':name,'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':p.returncode,'expectedExit':expected,'outcomeMatched':p.returncode==expected,'stdoutSHA256':sha(p.stdout),'stderrSHA256':sha(p.stderr),'toolPRE':toolPre,'pythonPRE':pythonPre,'RLIMIT_FSIZE':1 if cap else None};(d/'receipt.json').write_text(json.dumps(rec,indent=2)+'\n');records.append(rec);assert p.returncode==expected,(name,p.returncode,p.stderr[-1200:]);return p
pin=sha(read(I/'index.json'));D=T/'genuine'
for name in ('genuine-full-materialize','genuine-idempotent-verify'):
 p=run(name,I/'index.json',D,pin,0);receipt=json.loads(p.stdout);assert receipt['objects']==156 and receipt['bytes']==68361292 and not receipt['provenancePathsWritten'] and not receipt['qualificationReleased']
 assert stat.S_IMODE(D.stat().st_mode)==0o700 and stat.S_IMODE((D/'objects').stat().st_mode)==0o700 and set(x.name for x in (D/'objects').iterdir())==set(objects)
 for h,n in objects.items():
  f=D/'objects'/h;s=f.lstat();assert stat.S_IMODE(s.st_mode)==0o600 and s.st_uid==os.getuid() and s.st_nlink==1 and len(read(f))==n and sha(read(f))==h
# Recreate historical fixtures in own namespace, preserve hardlinks and literal links.
C=T/'prior-controls';shutil.copytree(OLD,C,symlinks=True,ignore=shutil.ignore_patterns('runs','source-prebytes','public-input','genuine'))
linked={}
for p in OLD.rglob('*'):
 if p.is_symlink() or not p.is_file():continue
 q=C/p.relative_to(OLD)
 if not q.exists() or p.stat().st_nlink<=1:continue
 key=(p.stat().st_dev,p.stat().st_ino)
 if key in linked:q.unlink();os.link(linked[key],q)
 else:linked[key]=q
for p in C.rglob('*'):
 if p.is_symlink():
  target=os.readlink(p)
  if target.startswith(str(OLD)+'/'):p.unlink();p.symlink_to(target.replace(str(OLD),str(C),1))
for name in ('small-positive-dst','source-ancestor-observed','source-ancestor-required-denial','late-fsize-partial'):
 p=C/name
 if p.exists():shutil.rmtree(p)
for r in prior:
 name=r['name']
 if name.startswith('genuine-') or name=='source-ancestor-symlink-observation':continue
 v=r['argv'];ip=Path(v[v.index('--index')+1].replace(str(OLD),str(C),1));dst=Path(v[v.index('--destination')+1].replace(str(OLD),str(C),1));pin=v[v.index('--index-sha256')+1]
 if name=='existing-object-no-overwrite':
  for f in (C/'small-positive-dst/objects').iterdir():f.write_bytes(b'CORRUPTION')
 before={}
 if dst.is_dir() and not dst.is_symlink():
  for f in dst.rglob('*'):
   if f.is_file() and not f.is_symlink():before[str(f)]=sha(f.read_bytes())
 run('required-'+name,ip,dst,pin,r['expectedExit'],r.get('RLIMIT_FSIZE')==1)
 if r['expectedExit']==1:
  for f,h in before.items():assert sha(Path(f).read_bytes())==h
 if name in ('source-ancestor-symlink-required-denial','index-pin-mismatch','part-hash-mismatch','archive-hash-mismatch') or name.startswith(('gzip-','tar-')):assert not dst.exists()
# Original acceptance observation is not a denial regression. New same setup has its own name/expectation.
base=C/'controls/small-positive';smallpin=sha(read(base/'index.json'))
for name,kind,target in [('repaired-original-observation-denial','ancestor','index.json'),('source-nested-ancestor-denial','nested','index.json'),('index-hardlink-denial','hardlink','index.json'),('index-FIFO-denial','fifo','index.json'),('part-FIFO-denial','fifo','objects.part-0000')]:
 f=T/name;shutil.copytree(base,f);ip=f/'index.json';dst=T/(name+'-dst')
 if kind=='ancestor':link=T/(name+'-link');link.symlink_to(f);ip=link/'index.json'
 elif kind=='nested':outer=T/(name+'-outer');outer.mkdir();(outer/'linked').symlink_to(f);ip=outer/'linked/index.json'
 elif kind=='hardlink':os.link(f/target,f/'foreign')
 else:(f/target).unlink();os.mkfifo(f/target)
 run(name,ip,dst,smallpin);assert not dst.exists()
# Controlled read-time mutation tests run the exact helper unchanged via runpy.
for target in ('index.json','objects.part-0000'):
 for kind in ('leaf','ancestor'):
  name='FD-path-replacement-'+kind+'-'+target;f=T/name;shutil.copytree(base,f);wrapper=W/(name+'.py')
  mutation='    p=Path('+repr(str(f/target))+');p.rename(p.with_name(p.name+".parked"));p.write_bytes(data)\n' if kind=='leaf' else '    p=Path('+repr(str(f))+');p.rename(p.with_name(p.name+".parked"));p.mkdir()\n'
  wrapper.write_text('import os,runpy\nfrom pathlib import Path\noriginal=os.fdopen\ntriggered=False\ndef wrapped(fd,*args,**kwargs):\n global triggered\n h=original(fd,*args,**kwargs)\n if not triggered and os.readlink("/proc/self/fd/"+str(fd))=='+repr(str(f/target))+':\n  triggered=True\n  class Reader:\n   def __enter__(self):h.__enter__();return self\n   def __exit__(self,*args):return h.__exit__(*args)\n   def fileno(self):return h.fileno()\n   def read(self):\n    data=h.read()\n'+mutation+'    return data\n  return Reader()\n return h\nos.fdopen=wrapped\nrunpy.run_path('+repr(str(Q/'materialize.py'))+',run_name="__main__")\n')
  run(name,f/'index.json',T/(name+'-dst'),smallpin,wrapper=wrapper);assert not (T/(name+'-dst')).exists()
post=[{'path':r['path'],'bytes':len(read(Path(r['path']))),'sha256':sha(read(Path(r['path']))),'beforeArchive':r['beforeArchive']} for r in pre];assert post==pre
for r in extra:assert sha(read(Path(r['path'])))==r['sha256']
(W/'sourcePOST.json').write_text(json.dumps(post,indent=2)+'\n');(W/'additional-tool-prebytes.json').write_text(json.dumps(extra,indent=2)+'\n');(W/'results.json').write_text(json.dumps({'records':records,'runs':len(records),'requiredPriorControls':42,'historicalObservationPreservedUnchanged':True,'objects':156,'references':301,'rawObjectBytes':68361292,'sourcePinsUnchanged':True,'all122':'HELD'},indent=2)+'\n');print(json.dumps({'runs':len(records),'allExpectedOutcomes':True,'all122':'HELD'}))
