import pathlib,os,stat,hashlib,json,tarfile,io,gzip,re,datetime
R=pathlib.Path('/workspace/Project-Cortex');S=R/'work/resume/task04-native-admission-fixture-c8-review';F=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c8-review';O=F.with_name(F.name+'-scratch-preservation')
sha=lambda b:hashlib.sha256(b).hexdigest()
frozen=sha((F/'review-manifest.json').read_bytes());assert frozen=='8eeae43def2ba8b7d41b0bc53677d28f6d51b781a3e032549987d3c08466a51c'
coverage={}
for row in json.loads((F/'review-manifest.json').read_bytes())['files']:coverage.setdefault((row['sha256'],row['bytes']),row['path'])
rows=[];chosen={}; links=[]
for base,ds,fs in os.walk(S,followlinks=False):
 for name in list(ds):
  p=pathlib.Path(base)/name
  if p.is_symlink():ds.remove(name);links.append(p)
 for name in fs:
  p=pathlib.Path(base)/name
  if p.is_symlink():links.append(p);continue
  fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
  try:
   st=os.fstat(fd);assert stat.S_ISREG(st.st_mode);b=b''
   while True:
    block=os.read(fd,1048576)
    if not block:break
    b+=block
  finally:os.close(fd)
  rel=str(p.relative_to(S));key=(sha(b),len(b));row={'path':rel,'sha256':key[0],'bytes':key[1],'mode':stat.S_IMODE(st.st_mode)}
  # No actual secrets are read; only this offline review scratch. Dummy key and physical ID-bearing payloads are excluded before archive selection.
  if re.search(rb'(?:synthetic-only-no-credential|dummy.?key|dev:[^\s\x00"\']{1,100}\||CONVEX_DEPLOY_KEY\s*[:=]|[jkn][a-z0-9]{31})',b,re.I):row['category']='excluded-dummykey-or-historical-physical-ID-bearing-payload'
  elif key in coverage:row.update(category='exactbytes-already-covered',reviewPath=coverage[key])
  elif p.suffix not in {'.mjs','.ts','.js','.py','.txt'}:row['category']='excluded-generated-result-not-helper-or-preimage'
  elif key in chosen:row.update(category='duplicate-new-exactbytes',archivePath=chosen[key][0])
  else:row.update(category='archive-nonsecret-helper-or-preimage',archivePath=rel);chosen[key]=(rel,b,row['mode'])
  rows.append(row)
for p in links:
 b=os.readlink(p).encode();rows.append({'path':str(p.relative_to(S)),'category':'excluded-symlink-nofollow','sha256':sha(b),'bytes':len(b),'hashBasis':'link-text-no-target-read'})
rows.sort(key=lambda x:x['path']);buffer=io.BytesIO()
with tarfile.open(fileobj=buffer,mode='w',format=tarfile.USTAR_FORMAT) as t:
 for name,b,mode in sorted(chosen.values()):
  info=tarfile.TarInfo(name);info.size=len(b);info.mode=mode;info.mtime=0;info.uid=info.gid=0;info.uname=info.gname='';t.addfile(info,io.BytesIO(b))
raw=buffer.getvalue();chunks=[]
for i,start in enumerate(range(0,len(raw),700000)):
 b=gzip.compress(raw[start:start+700000],compresslevel=9,mtime=0);assert len(b)<=750000;name=f'helpers-{i:04d}.tar.part.gz';(O/name).write_bytes(b);chunks.append({'path':name,'bytes':len(b),'sha256':sha(b),'rawBytes':len(raw[start:start+700000])})
restored=b''.join(gzip.decompress((O/x['path']).read_bytes()) for x in chunks);assert restored==raw
with tarfile.open(fileobj=io.BytesIO(restored),mode='r:') as t:
 members=t.getmembers();assert len(members)==len(chosen)
 for member in members:
  original=next(v for v in chosen.values() if v[0]==member.name);assert t.extractfile(member).read()==original[1] and member.mode==original[2]
assert sha((F/'review-manifest.json').read_bytes())==frozen
manifest={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'offline unique review scratch only; no new judgment','reviewManifestSHA256':frozen,'sourceRoot':str(S),'inventory':rows,'tarSHA256':sha(raw),'tarBytes':len(raw),'archiveUniqueFiles':len(chosen),'chunks':chunks,'roundtrip':'PASS exact bytes and original mode; no extraction to source','symlinks':'nofollow; link-text hashes only'}
(O/'inventory.json').write_text(json.dumps(manifest,indent=2)+'\n')
from collections import Counter
counts=Counter(row['category'] for row in rows)
(O/'report.md').write_text('# C8 review scratch preservation\n\nArchive-only followup; no new judgment or acceptance claim. Frozen606-row review manifest remains unchanged.\n\nInventoried '+str(len(rows))+' entries without following symlinks. Categories: '+json.dumps(dict(counts),sort_keys=True)+'.\n\nPreserved '+str(len(chosen))+' unique nonsecret helper/preimage byte sequences in '+str(len(chunks))+' deterministic gzip chunks, each <=750000bytes. Exact-byte/original-mode in-memory tar roundtrip PASS. Existing exactbytes coverage avoids duplicate archives. Dummy-key/physical-ID-bearing payloads and generated nonhelper results remain excluded with path/category/hash/bytes. No symlink target read, scratch mutation, actual keys/env/target/network/services/RPC/Git activity.\n\nReassemble by gzip-decompressing chunks in inventory order and concatenating the raw tar parts. inventory.json records every archive and exclusion; final self-excluding preservation-manifest.json binds all deliverables.\n')
print(json.dumps({'entries':len(rows),'categories':dict(counts),'uniqueArchived':len(chosen),'chunks':len(chunks),'roundtrip':'PASS'}))
