import datetime,gzip,hashlib,json,os,stat,subprocess,sys,zlib
from pathlib import Path
R=Path('/workspace/Project-Cortex')
C=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1'
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1-fresh-review'
W=R/'work/resume/task04-evidence-transport-c4-c1-fresh-review'
T=Path('/tmp/cortex-evidence-transport-c4-c1-fresh-review')
M=T/'mirror'
PINS={'materialize.py':'78a512af1a003f3275b66e014a949ac77a5a961df01c9957d04d950b84348067','restore-git-modes.py':'187c3950f02caa16f0671a615faa93d0657377e8b84da95b7ea28e7069da48cf','restore-directory-modes.py':'52fa008a3c6b819fdbc660bb29b378d76ee335ea6071bfef161013afe58ea219','index.json':'a82fb82ad92d4a9753a9c7fe612ba880f82f4893a7a6d3e211dc8ec9a4fad869','report.md':'5cf43284d60e7ccd4b716ad9768ffc733f8315f90d090f6f93f98d7867b56238'}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):
 f=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  a=os.fstat(f);assert stat.S_ISREG(a.st_mode);out=bytearray()
  while len(out)<a.st_size:
   b=os.read(f,min(1048576,a.st_size-len(out)));assert b;out.extend(b)
  assert not os.read(f,1);z=os.fstat(f);assert (a.st_dev,a.st_ino,a.st_size,a.st_mode,a.st_mtime_ns,a.st_ctime_ns)==(z.st_dev,z.st_ino,z.st_size,z.st_mode,z.st_mtime_ns,z.st_ctime_ns)
  return bytes(out),z
 finally:os.close(f)
def meta(p):
 b,s=read(p);return {'path':str(p),'sha256':sha(b),'bytes':len(b),'mode':stat.S_IMODE(s.st_mode),'dev':s.st_dev,'ino':s.st_ino,'nlink':s.st_nlink,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}
def save(p,v):
 with p.open('x') as f:json.dump(v,f,indent=2);f.write('\n')
def module(name):
 b,s=read(C/name);assert sha(b)==PINS[name];e={'__name__':'fresh_authenticated_source','__file__':str(C/name)};exec(compile(b,str(C/name),'exec'),e);return e
def state():return {'candidatePinnedFiles':[meta(C/n) for n in PINS],'mirrorExists':M.exists(),'sourceByteBacking':str(C/'index.json'),'originalEightManifestsBacking':str(C/'summary.json'),'sourceContinuity':False}
def record(tag,argv):
 start=now();pre=state();rawout=T/(tag+'.stdout');rawerr=T/(tag+'.stderr')
 env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1');
 with rawout.open('xb') as out,rawerr.open('xb') as err:r=subprocess.run(argv,cwd=R,env=env,stdout=out,stderr=err,umask=0o022)
 end=now();outputs={}
 for kind,p in [('stdout',rawout),('stderr',rawerr)]:
  b,s=read(p);dest=Q/(tag+'.'+kind+'.gz')
  with dest.open('xb') as f:f.write(gzip.compress(b,mtime=0))
  outputs[kind]={'rawPath':str(p),'rawBytes':len(b),'rawSha256':sha(b),'losslessCompressedBacking':str(dest),'compressed':meta(dest)}
 save(Q/(tag+'.command.json'),{'utcPRE':start,'utcPOST':end,'argv':argv,'cwd':str(R),'actualChildUmask':'022','exit':r.returncode,'pre':pre,'post':state(),'rawOutputs':outputs,'prebyteBacking':'Pinned immutable source archive/map for existing exact files; absent mirror initial state independently recorded; owned scripts retained under work seal; no invented retrospective capture.'})
 print(json.dumps({'tag':tag,'exit':r.returncode,'stdoutBytes':outputs['stdout']['rawBytes']}),flush=True)
 assert r.returncode==0,tag
def load():
 e=module('materialize.py');from types import SimpleNamespace
 h=SimpleNamespace(**e);idx,m,rows,byhash=h.load(C);return h,idx,m,rows
def closure(base,rows,source):
 roots=json.loads(read(C/'summary.json')[0])['originalManifests'];expected={r['path'] for r in rows};found=set();dirs={};topology=[];records=[]
 for info in roots:
  root=base/info['root'];mp=root/info['manifest'];b,s=read(mp);assert len(b)==info['manifestBytes'] and sha(b)==info['sha256'];mf=json.loads(b);assert len(mf['files'])==info['rows']
  if 'root' in mf:assert mf['root'] in (info['root'],str(R/info['root']))
  if 'excludeOnlySelf' in mf:assert mf['excludeOnlySelf']==info['manifest']
  if 'excludeONLY' in mf:assert mf['excludeONLY']==info['manifest']
  member={info['root']+'/'+r['path'] for r in mf['files']};mapped={r['path'] for r in rows if r['path'].startswith(info['root']+'/')};assert member|{str(mp.relative_to(base))}==mapped
  stack=[root]
  while stack:
   d=stack.pop();s=d.lstat();assert stat.S_ISDIR(s.st_mode);dirs[str(d.relative_to(base))]=stat.S_IMODE(s.st_mode)
   for p in d.iterdir():
    s=p.lstat()
    if stat.S_ISDIR(s.st_mode):stack.append(p)
    else:found.add(str(p.relative_to(base)))
 assert found==expected
 links=0;regular=0
 for r in rows:
  p=base/r['path'];s=p.lstat();assert stat.S_IMODE(s.st_mode)==r['mode']
  if r['kind']=='literal-symlink':assert stat.S_ISLNK(s.st_mode);b=os.readlink(os.fsencode(p));assert b.hex()==r['targetHex'];links+=1
  else:
   b,s=read(p);regular+=1
   if not source:assert s.st_nlink==1
   elif s.st_nlink!=1:assert s.st_nlink==2;topology.append({'path':r['path'],'dev':s.st_dev,'ino':s.st_ino,'nlink':s.st_nlink,'mode':stat.S_IMODE(s.st_mode),'sha256':sha(b)})
  assert len(b)==r['bytes'] and sha(b)==r['sha256']
  records.append([r['path'],r['kind'],len(b),sha(b),stat.S_IMODE(s.st_mode),s.st_dev,s.st_ino,s.st_nlink,s.st_mtime_ns,s.st_ctime_ns])
 side=json.loads(zlib.decompress(read(C/'directory-modes.json.gz')[0],31));assert dirs=={r['path']:r['mode'] for r in side['directories']}
 if source:
  assert len(topology)==32;groups={}
  for r in topology:groups.setdefault((r['dev'],r['ino']),[]).append(r['path'])
  assert len(groups)==16 and all(len(v)==2 for v in groups.values())
 result={'rows':len(rows),'regular':regular,'links':links,'directories':len(dirs),'originalManifestRows':sum(i['rows'] for i in roots),'originalManifestBodies':len(roots),'negativeHardlinkTopology':topology,'allRegularRestoredNlink1':not source,'recordMetadataSha256':sha(json.dumps(records,separators=(',',':')).encode()),'exactMembership':True,'everyByteSizeModeLiteral':True}
 return result,records
def audit(tag,source):
 h,idx,m,rows=load();result,records=closure(R if source else M,rows,source)
 dest=Q/(tag+'-all-rows.json.gz')
 with dest.open('xb') as f:f.write(gzip.compress(json.dumps(records,separators=(',',':')).encode(),mtime=0))
 result['completeRowBacking']=meta(dest)
 if tag=='source-after':
  before=json.loads(read(Q/'source-before-results.json')[0]);assert result['recordMetadataSha256']==before['recordMetadataSha256'];assert result['negativeHardlinkTopology']==before['negativeHardlinkTopology'];result['unchangedSinceActualFreshPRE']=True
 save(Q/(tag+'-results.json'),result);print(json.dumps(result),flush=True)
def seed():
 assert not M.exists();M.mkdir(mode=0o755);assert stat.S_IMODE(M.stat().st_mode)==0o755;h,idx,m,rows=load();root=h.ROOTS[4];seed=[r for r in rows if r['path'].startswith(root+'/') and r['path']!=root+'/qa-manifest.json'];assert len(seed)==17
 proof=[]
 for r in seed:
  b,s=read(R/r['path']);assert sha(b)==r['sha256'];p=M/r['path'];p.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
  with p.open('xb') as f:f.write(b)
  os.chmod(p,0o644);proof.append(meta(p));assert stat.S_IMODE(p.stat().st_mode)==0o644 and p.stat().st_nlink==1
 for d,sub,files in os.walk(M):assert stat.S_IMODE(Path(d).stat().st_mode)==0o755
 save(Q/'git-seed-results.json',{'seed':proof,'files':17,'allAncestryActualMode':'0755','umask':oct(os.umask(0o022)),'target':str(M),'createdFromExactOriginalSourceBytes':True});print(json.dumps({'seeded':17,'actualUmask':'022'}))
if __name__=='__main__':
 os.umask(0o022);verb=sys.argv[1]
 if verb=='record':record(sys.argv[2],sys.argv[3:])
 elif verb=='seed':seed()
 elif verb=='audit':audit(sys.argv[2],sys.argv[3]=='source')
