import os,stat,hashlib,json,gzip,shutil,sys,subprocess,datetime,io,tarfile
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c2-byte-backing-transport-fresh-review';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-byte-backing-transport-fresh-review';T=Path('/tmp/cortex-c2-backing-transport-fresh-review');T.mkdir(mode=0o700);I=T/'public-input';I.mkdir(mode=0o755);S=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-component-byte-backing';P=Path('/tmp/cortex-root-storage-rescue/c2-component-backing')
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(fd,'rb') as h:
  a=os.fstat(h.fileno());b=h.read();z=os.fstat(h.fileno());assert (a.st_dev,a.st_ino,a.st_mtime_ns,a.st_ctime_ns,a.st_size)==(z.st_dev,z.st_ino,z.st_mtime_ns,z.st_ctime_ns,z.st_size)
 assert (s.st_dev,s.st_ino)==(a.st_dev,a.st_ino);return b
idx=json.loads(read(S/'index.json'));sources=[S/n for n in ['index.json','materialize.py','README.md']]+[P/r['path'] for r in idx['parts']]+[Path(r['path']) for r in idx['references']]+[Path(__file__),Path(sys.executable).resolve(),R/'work/resume/root-c2-component-byte-backing-pack.py']
pre=[];A=T/'source-prebytes';A.mkdir(mode=0o700)
for p in sources:
 b=read(p);h=sha(b);pre.append({'path':str(p),'bytes':len(b),'sha256':h});a=A/(h+'.gz')
 if not a.exists():a.write_bytes(gzip.compress(b,mtime=0));a.chmod(0o600)
 assert gzip.decompress(read(a))==b
(W/'sourcePRE.json').write_text(json.dumps(pre,indent=2)+'\n')
assert sha(read(S/'index.json'))=='cf6314cb96d9b8b74be64839ff971a0e85068dc6a67c5b8bf8433850263b6866';assert sha(read(S/'materialize.py'))=='c40a76aa7dc4e4485b27bda53b6a05630617534e4fe2801c4ad9104ee70ef4ca'
for r in idx['references']:b=read(Path(r['path']));assert len(b)==r['bytes'] and sha(b)==r['sha256']
for p in [S/n for n in ['index.json','materialize.py','README.md']]+[P/r['path'] for r in idx['parts']]:
 b=read(p);(I/p.name).write_bytes(b);(I/p.name).chmod(0o644);assert read(I/p.name)==b
joined=b''.join(read(I/r['path']) for r in idx['parts']);assert len(joined)==idx['archiveBytes'] and sha(joined)==idx['archiveSHA256']
records=[];runs=T/'runs';runs.mkdir(mode=0o700)
def run(name,ip,dest,pin=None,expected=1):
 b=read(ip);argv=[str(Path(sys.executable).resolve()),str(I/'materialize.py'),'--index',str(ip),'--index-sha256',pin or sha(b),'--destination',str(dest)];start=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(argv,cwd=R,env={'PATH':'/usr/bin:/bin','TMPDIR':str(T)},capture_output=True);end=datetime.datetime.now(datetime.timezone.utc).isoformat();f=runs/name;f.mkdir();(f/'stdout').write_bytes(r.stdout);(f/'stderr').write_bytes(r.stderr);rec={'name':name,'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':end,'exit':r.returncode,'expectedExit':expected,'stdoutSHA256':sha(r.stdout),'stderrSHA256':sha(r.stderr)};records.append(rec);(f/'receipt.json').write_text(json.dumps(rec,indent=2)+'\n');assert r.returncode==expected,(name,r.returncode,r.stderr[-500:]);return r
D=T/'genuine';run('genuine-full-materialize',I/'index.json',D,expected=0);run('genuine-idempotent-verify',I/'index.json',D,expected=0)
assert D.stat().st_mode&0o777==0o700 and (D/'objects').stat().st_mode&0o777==0o700
for o in idx['objects']:
 p=D/'objects'/o['sha256'];b=read(p);assert len(b)==o['bytes'] and sha(b)==o['sha256'] and p.stat().st_mode&0o777==0o600
cases=T/'controls';cases.mkdir(mode=0o700);payload=b'DUMMY_PUBLIC_CONTROL';oh=sha(payload)
def tar(entries):
 b=io.BytesIO()
 with tarfile.open(fileobj=b,mode='w') as t:
  for name,data,kind,size in entries:
   v=tarfile.TarInfo(name);v.mode=0o600;v.type=kind;v.size=len(data) if size is None else size
   if kind in [tarfile.SYMTYPE,tarfile.LNKTYPE]:v.linkname='/tmp/DUMMY-NOT-WRITTEN';v.size=0
   t.addfile(v,io.BytesIO(data) if kind==tarfile.REGTYPE else None)
 return b.getvalue()
normal=tar([('objects/'+oh,payload,tarfile.REGTYPE,None)])
def fixture(name,encoded=None,edit=None):
 c=cases/name;c.mkdir();b=gzip.compress(normal,mtime=0) if encoded is None else encoded
 # Pad compressed member with incompressible harmless TAR padding to satisfy object's compressed-size bound when required.
 ix={'schemaVersion':1,'archiveBytes':len(b),'archiveSHA256':sha(b),'objects':[{'sha256':oh,'bytes':len(payload)}],'parts':[{'path':'objects.part-0000','bytes':len(b),'sha256':sha(b)}],'references':[{'path':'/tmp/DO-NOT-RESTORE','sha256':oh,'bytes':len(payload)}]}
 if edit:edit(ix)
 (c/'objects.part-0000').write_bytes(b);(c/'index.json').write_text(json.dumps(ix));return c
run('small-positive',fixture('small-positive')/'index.json',T/'small-positive-dst',expected=0)
def denied(name,encoded=None,edit=None,pin=None):
 c=fixture(name,encoded,edit);dst=T/(name+'-dst');run(name,c/'index.json',dst,pin);assert not dst.exists()
denied('index-pin-mismatch',pin='0'*64)
denied('part-hash-mismatch',edit=lambda x:x['parts'][0].update(sha256='0'*64))
denied('archive-hash-mismatch',edit=lambda x:x.update(archiveSHA256='0'*64))
b=bytearray(gzip.compress(normal,mtime=0));b[-8]^=1;denied('gzip-crc',bytes(b))
denied('gzip-trailing',gzip.compress(normal,mtime=0)+b'EVIL')
denied('gzip-concatenated',gzip.compress(normal,mtime=0)*2)
for n,ents in [('tar-traversal',[('../escape',payload,tarfile.REGTYPE,None)]),('tar-absolute',[('/tmp/DUMMY-NOT-WRITTEN',payload,tarfile.REGTYPE,None)]),('tar-symlink',[('objects/'+oh,b'',tarfile.SYMTYPE,None)]),('tar-hardlink',[('objects/'+oh,b'',tarfile.LNKTYPE,None)]),('tar-duplicate',[('objects/'+oh,payload,tarfile.REGTYPE,None)]*2),('tar-missing',[]),('tar-oversize',[('objects/'+oh,payload+b'!',tarfile.REGTYPE,None)]),('object-hash-mismatch',[('objects/'+oh,b'X'*len(payload),tarfile.REGTYPE,None)]),('tar-mode',None)]:
 raw=tar(ents) if ents is not None else normal
 if ents is None:raw=raw[:100]+b'0000644\0'+raw[108:];v=bytearray(raw);v[148:156]=b'        ';v[148:156]=('%06o\0 ' % sum(v[:512])).encode();raw=bytes(v)
 denied(n,gzip.compress(raw,mtime=0))
denied('tar-trailing-nonzero',gzip.compress(normal+b'EVIL',mtime=0))
denied('gzip-decompression-cap',gzip.compress(normal+b'\0'*1000000,mtime=0))
for n,edit in [('unsafe-part-path',lambda x:x['parts'][0].update(path='../objects.part-0000')),('part-bool-size',lambda x:x['parts'][0].update(bytes=True)),('object-bool-size',lambda x:x['objects'][0].update(bytes=True)),('archive-byte-cap',lambda x:x.update(archiveBytes=256*1024*1024+1)),('part-byte-cap',lambda x:x['parts'][0].update(bytes=5*1024*1024+1)),('duplicate-object',lambda x:x['objects'].append(dict(x['objects'][0]))),('missing-late-part',lambda x:x['parts'].append({'path':'objects.part-0001','bytes':1,'sha256':'0'*64}))]:denied(n,edit=edit)
for name,target in [('source-part-symlink','objects.part-0000'),('source-index-symlink','index.json'),('source-part-hardlink','objects.part-0000'),('source-index-hardlink','index.json'),('source-part-directory','objects.part-0000')]:
 c=fixture(name);f=c/target;b=read(f);pin=sha(read(c/'index.json'));f.unlink();foreign=c/'foreign';foreign.write_bytes(b)
 if 'symlink' in name:f.symlink_to(foreign)
 elif 'hardlink' in name:os.link(foreign,f)
 else:f.mkdir()
 dst=T/(name+'-dst');
 # Index symlink/hardlink run bypasses judge read() with explicit captured pin.
 argv=[str(Path(sys.executable).resolve()),str(I/'materialize.py'),'--index',str(c/'index.json'),'--index-sha256',pin,'--destination',str(dst)]
 if target=='index.json':
  start=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(argv,cwd=R,env={'PATH':'/usr/bin:/bin','TMPDIR':str(T)},capture_output=True);fout=runs/name;fout.mkdir();(fout/'stdout').write_bytes(r.stdout);(fout/'stderr').write_bytes(r.stderr);rec={'name':name,'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':r.returncode,'expectedExit':1};records.append(rec);(fout/'receipt.json').write_text(json.dumps(rec,indent=2)+'\n');assert r.returncode==1
 else:run(name,c/'index.json',dst,pin)
 assert not dst.exists() and read(foreign)==b
# Existing destination denies overwrite and leaves sentinels untouched.
c=fixture('destination-controls');ip=c/'index.json'
for name,mode in [('destination-public',0o755),('destination-existing-empty',0o700),('destination-existing-sentinel',0o700)]:
 dst=T/name;dst.mkdir(mode=mode)
 if 'sentinel' in name:(dst/'sentinel').write_bytes(payload)
 before=sorted(dst.iterdir());run(name,ip,dst);assert sorted(dst.iterdir())==before
 if 'sentinel' in name:assert read(dst/'sentinel')==payload
foreign=T/'destination-foreign';foreign.mkdir();(foreign/'sentinel').write_bytes(payload);link=T/'destination-symlink';link.symlink_to(foreign,target_is_directory=True);run('destination-symlink',ip,link);assert read(foreign/'sentinel')==payload
ancestor=T/'ancestor-link';ancestor.symlink_to(foreign,target_is_directory=True);run('destination-ancestor-symlink',ip,ancestor/'new');assert not (foreign/'new').exists()
# Existing restored object corruption must be detected, never repaired/overwritten.
sd=T/'small-positive-dst';op=sd/'objects'/oh;op.write_bytes(b'CORRUPTION');op.chmod(0o600);run('existing-object-no-overwrite',ip,sd);assert read(op)==b'CORRUPTION'
# The source ancestor symlink is permitted: record limit honestly, no writes through provenance labels.
sl=T/'source-ancestor-link';sl.symlink_to(c,target_is_directory=True);run('source-ancestor-symlink-observation',sl/'index.json',T/'source-ancestor-observed',expected=0);assert not Path('/tmp/DO-NOT-RESTORE').exists()
post=[]
for r in pre:
 b=read(Path(r['path']));assert len(b)==r['bytes'] and sha(b)==r['sha256'];post.append({'path':r['path'],'bytes':len(b),'sha256':sha(b)})
(W/'sourcePOST.json').write_text(json.dumps(post,indent=2)+'\n');(W/'results.json').write_text(json.dumps({'records':records,'references':len(idx['references']),'objects':len(idx['objects']),'rawObjectBytes':sum(o['bytes'] for o in idx['objects']),'sourcePinsUnchanged':pre==post,'sourceAncestorSymlinkAccepted':True},indent=2)+'\n');print(json.dumps({'commands':len(records),'sourcePinsUnchanged':pre==post,'objects':len(idx['objects']),'references':len(idx['references'])}))
