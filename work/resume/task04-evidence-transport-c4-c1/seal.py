import datetime,hashlib,json,os,stat,subprocess,sys
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1')
S=Path('work/resume/task04-evidence-transport-c4-c1')
T=Path('/tmp/cortex-evidence-transport-c4-c1')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def info(p):
 st=p.lstat()
 if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1:raise RuntimeError('seal requires unique regular file '+str(p))
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);digest=hashlib.sha256();count=0
  while count<a.st_size:
   b=os.read(fd,min(1048576,a.st_size-count))
   if not b:raise RuntimeError('short seal read')
   count+=len(b);digest.update(b)
  if os.read(fd,1):raise RuntimeError('seal growth')
  z=os.fstat(fd)
  if (a.st_dev,a.st_ino,a.st_size,a.st_mode,a.st_mtime_ns,a.st_ctime_ns)!=(z.st_dev,z.st_ino,z.st_size,z.st_mode,z.st_mtime_ns,z.st_ctime_ns):raise RuntimeError('seal changed')
  return {'path':str(p),'kind':'file','bytes':count,'sha256':digest.hexdigest(),'mode':stat.S_IMODE(z.st_mode),'nlink':z.st_nlink}
 finally:os.close(fd)
def entries(root,excluded):
 out=[]
 def walk(d):
  for p in sorted(d.iterdir()):
   st=p.lstat()
   if stat.S_ISDIR(st.st_mode):walk(p)
   elif p!=excluded:out.append(info(p))
 walk(root)
 return out
def seal(root,name):
 p=root/name
 if p.exists():raise RuntimeError('no existing seal overwrite')
 rows=entries(root,p)
 for row in rows:row['path']=str(Path(row['path']).relative_to(root))
 body={'root':str(root),'excludeOnlySelf':name,'files':rows}
 with p.open('x') as f:f.write(json.dumps(body,indent=2)+'\n');f.flush();os.fsync(f.fileno())
 return {'manifest':info(p),'rows':len(rows)}
if len(sys.argv)>1 and sys.argv[1]=='--qa':
 print(json.dumps(seal(Q,'qa-manifest.json')))
else:
 pre=entries(Q,Q/'qa-manifest.json')+entries(S,S/'work-manifest.json');start=now()
 argv=[sys.executable,str(S/'seal.py'),'--qa']
 with (S/'qa-seal.stdout').open('xb') as out,(S/'qa-seal.stderr').open('xb') as err:r=subprocess.run(argv,stdout=out,stderr=err)
 receipt={'utcPRE':start,'utcPOST':now(),'argv':argv,'cwd':os.getcwd(),'exit':r.returncode,'pre':pre,'postQA':entries(Q,Q/'qa-manifest.json'),'qaManifest':info(Q/'qa-manifest.json') if (Q/'qa-manifest.json').exists() else None,'prebyteBacking':'All exact current bytes retained; finalization previous script versions retained in execution-inputs/history. No retrospective source continuity claim.'}
 with (S/'qa-seal.command.json').open('x') as f:f.write(json.dumps(receipt,indent=2)+'\n')
 if r.returncode:sys.exit(r.returncode)
 work=seal(S,'work-manifest.json');qa=json.loads((S/'qa-seal.stdout').read_bytes())
 final={'utcPRE':start,'utcPOST':now(),'argv':sys.argv,'exit':0,'qa':qa,'work':work,'qaPostHash':info(Q/'qa-manifest.json'),'workPostHash':info(S/'work-manifest.json'),'noFurtherOwnQAOrScratchWrites':True}
 with (T/'final-seal.command.json').open('x') as f:f.write(json.dumps(final,indent=2)+'\n')
 print(json.dumps(final))
