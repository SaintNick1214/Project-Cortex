"""Freeze exact installed finite package closure referenced by these fixed sources; no imports or execution."""
from pathlib import Path
import os,stat,json,hashlib,gzip,re
R=Path('/workspace/Project-Cortex');W=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c3';T=Path('/tmp/cortex-native-c5-closed-launcher-c3');H=lambda b:hashlib.sha256(b).hexdigest();expected={};packages={'convex','esbuild','@esbuild/linux-x64','typescript','zod','semver'}
for k in ['extension','regression','extra']:
 q=R/'_goals/convex-backend-runtime-2026-10-02/qa'/('task04-model-drift-native-'+k+'-preparation-c5')
 for name,key in [('runner-dependency-inventory.json','inputs'),('toolchain-evidence.json','files'),('source-inventory.json','files'),('source-inventory.json','acceptedGateHashes')]:
  for x in json.loads((q/name).read_bytes())[key]:
   p=R/x.get('path',x.get('source',''));expected[str(p)]=x['sha256']
   rel=str(p.relative_to(R))
   if rel.startswith('node_modules/'):
    bits=rel.split('/');packages.add('/'.join(bits[1:3])if bits[1].startswith('@')else bits[1])
lineage=json.loads((W/'mirror-source-transform-map.json').read_bytes())
for x in lineage['inputs']:
 if not x['source'].endswith('.mjs'):continue
 text=Path(x['source']).read_text()
 for m in re.finditer(r"(?:from\s*|import\s*\(|require\s*\(|localRequire\s*\()\s*['\"]([^'\"]+)['\"]",text):
  name=m.group(1)
  if name.startswith(('.', '/', 'node:')):continue
  bits=name.split('/');p='/'.join(bits[:2])if bits[0].startswith('@')else bits[0]
  if (R/'node_modules'/p/'package.json').is_file():packages.add(p)
paths={Path(p)for p in expected if Path(p).is_file()}
for name in sorted(packages):
 root=R/'node_modules'/name;assert root.is_dir()and not root.is_symlink(),'INSTALLED_PACKAGE_ROOT'
 for dp,dn,fn in os.walk(root,followlinks=False):
  assert all(not(Path(dp)/n).is_symlink()for n in dn),'PACKAGE_DIRECTORY_LINK'
  for n in fn:
   p=Path(dp)/n;assert not p.is_symlink(),'PACKAGE_LITERAL_LINK';paths.add(p)
rows=[];archives=T/'package-prebytes';archives.mkdir(exist_ok=True)
for p in sorted(paths):
 s=p.lstat();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and p.resolve()==p;fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  before=os.fstat(fd);data=b''
  while True:
   b=os.read(fd,1048576)
   if not b:break
   data+=b
  after=os.fstat(fd);identity=lambda x:(x.st_dev,x.st_ino,x.st_size,x.st_mtime_ns,x.st_ctime_ns,x.st_nlink);assert identity(before)==identity(after)==identity(p.lstat())
 finally:os.close(fd)
 digest=H(data)
 if str(p)in expected:assert digest==expected[str(p)],'ORIGINAL_PUBLIC_INPUT_PIN_DRIFT'
 archive=archives/(digest+'.gz')
 if not archive.exists():archive.write_bytes(gzip.compress(data,mtime=0))
 encoded=archive.read_bytes();assert gzip.decompress(encoded)==data
 rows.append({'path':str(p),'bytes':len(data),'sha256':digest,'beforeByteBacking':str(archive),'encodedSHA256':H(encoded),'originalPartialPin':expected.get(str(p)),'kind':'FULL_INSTALLED_PACKAGE_AND_DECLARED_PUBLIC_SOURCE_CLOSURE'})
out=T/'package-graph.json';out.write_text(json.dumps({'packages':sorted(packages),'files':rows,'sourceTiers':'ORIGINAL_FULL_RPC_PLACEMENT_UNCHANGED_NO_COMPILER_REASSIGNMENT','acceptance':'CANDIDATE_BEFORE_BYTE_GRAPH_NOT_SOURCE_GATE_PASS'},indent=2)+'\n');print(json.dumps({'rows':len(rows),'bytes':sum(x['bytes']for x in rows),'path':str(out),'sha256':H(out.read_bytes())}))
