import os,stat,hashlib,json,gzip,sys,subprocess,datetime,io,tarfile
from pathlib import Path
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-c2-byte-backing-transport-fresh-review';T=Path('/tmp/cortex-c2-backing-transport-fresh-review');I=T/'public-input';runs=T/'runs';cases=T/'controls'
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(fd,'rb') as h:
  a=os.fstat(h.fileno());b=h.read();z=os.fstat(h.fileno());assert (a.st_dev,a.st_ino,a.st_mtime_ns,a.st_ctime_ns,a.st_size)==(z.st_dev,z.st_ino,z.st_mtime_ns,z.st_ctime_ns,z.st_size)
 assert (s.st_dev,s.st_ino)==(a.st_dev,a.st_ino);return b
idx=json.loads(read(I/'index.json'));pre=json.loads((W/'sourcePRE.json').read_text());records=[json.loads(p.read_text()) for p in sorted(runs.glob('*/receipt.json'))];payload=b'DUMMY_PUBLIC_CONTROL';oh=sha(payload);normal=gzip.decompress(read(cases/'small-positive'/'objects.part-0000'))
def run(name,ip,dest,pin=None,expected=1):
 b=read(ip);argv=[str(Path(sys.executable).resolve()),str(I/'materialize.py'),'--index',str(ip),'--index-sha256',pin or sha(b),'--destination',str(dest)];start=datetime.datetime.now(datetime.timezone.utc).isoformat();r=subprocess.run(argv,cwd=R,env={'PATH':'/usr/bin:/bin','TMPDIR':str(T)},capture_output=True);end=datetime.datetime.now(datetime.timezone.utc).isoformat();f=runs/name;f.mkdir();(f/'stdout').write_bytes(r.stdout);(f/'stderr').write_bytes(r.stderr);rec={'name':name,'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':end,'exit':r.returncode,'expectedExit':expected,'stdoutSHA256':sha(r.stdout),'stderrSHA256':sha(r.stderr)};records.append(rec);(f/'receipt.json').write_text(json.dumps(rec,indent=2)+'\n');assert r.returncode==expected,(name,r.returncode,r.stderr[-500:]);return r
def fixture(name,encoded=None,edit=None):
 c=cases/name;c.mkdir();b=gzip.compress(normal,mtime=0) if encoded is None else encoded
 # Pad compressed member with incompressible harmless TAR padding to satisfy object's compressed-size bound when required.
 ix={'schemaVersion':1,'archiveBytes':len(b),'archiveSHA256':sha(b),'objects':[{'sha256':oh,'bytes':len(payload)}],'parts':[{'path':'objects.part-0000','bytes':len(b),'sha256':sha(b)}],'references':[{'path':'/tmp/DO-NOT-RESTORE','sha256':oh,'bytes':len(payload)}]}
 if edit:edit(ix)
 (c/'objects.part-0000').write_bytes(b);(c/'index.json').write_text(json.dumps(ix));return c
b=read(Path(__file__));h=sha(b);a=T/'source-prebytes'/(h+'.gz');a.write_bytes(gzip.compress(b,mtime=0));a.chmod(0o600);assert gzip.decompress(read(a))==b;pre.append({'path':str(Path(__file__)),'bytes':len(b),'sha256':h});(W/'sourcePRE-continuation.json').write_text(json.dumps(pre,indent=2)+'\n')
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
