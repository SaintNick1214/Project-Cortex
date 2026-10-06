"""Independent current historical content reads only; no imports or materialization."""
import hashlib,json,os,platform,stat,sys,time
from pathlib import Path
ROOT=Path('/repair');REPO=Path('/inputs/Project-Cortex');F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in F}}
def capture(p,body=False):
 p=Path(p);before=os.lstat(p);assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and p.resolve()==p;fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);h=hashlib.sha256();n=0;blocks=[]
 try:
  pre=ident(os.fstat(fd));assert pre==ident(before)
  while b:=os.read(fd,1048576):h.update(b);n+=len(b);blocks.append(b) if body else None
  post=ident(os.fstat(fd));pp=ident(os.lstat(p));assert pre==post==pp and n==before.st_size;r={'path':str(p),'bytes':n,'sha256':h.hexdigest(),'PRE':pre,'POST':post,'pathPOST':pp};return (r,b''.join(blocks)) if body else r
 finally:os.close(fd)
def resource():
 raw={n:Path('/sys/fs/cgroup',n).read_text() for n in ('memory.max','memory.current','memory.stat','memory.events')};mx=raw['memory.max'].strip();cu=raw['memory.current'].strip();assert mx.isdecimal() and cu.isdecimal() and int(mx)-int(cu)>=134217728;assert platform.system()=='Linux' and platform.machine()=='x86_64' and sys.version_info[:2]==(3,12);v=os.statvfs(ROOT);return {'memory':raw,'reserveBytes':int(mx)-int(cu),'diskAvailableBytes':v.f_bavail*v.f_frsize}
begin=time.monotonic();pre=resource();tool=capture(Path(__file__).resolve());python=capture(Path(sys.executable).resolve());sp,sraw=capture(ROOT/'final-linux-packet-manifest.json',True);assert sp['sha256']=='2e55621b73fed30c608559d76f215b1f5ccf8cda72857d5122acb4ea9d7f79c6' and sp['bytes']==1031477;m=json.loads(sraw);row=next(r for r in m['files'] if r['path']=='/repair/attempt2/report/historical70020-coverage.json');cp,craw=capture(row['path'],True);assert cp==row and cp['bytes']==128914214;coverage=json.loads(craw);c=json.load(open(ROOT/'attempt2/report/acquisition-contract.json'));available={h:n for r in c['routes'] for h,n in r['members'].items()};actual=missing=bytecount=0;rolled=hashlib.sha256()
for r in coverage['members']:
 expected=r['declared'];p=REPO/expected['path']
 if p.is_file() and not p.is_symlink():
  proof=capture(p);assert proof['bytes']==expected['bytes'] and proof['sha256']==expected['sha256'];actual+=1;bytecount+=proof['bytes'];rolled.update((json.dumps(proof,sort_keys=True,separators=(',',':'))+'\n').encode())
 else:missing+=1;assert available.get(expected['sha256'])==expected['bytes']
assert actual==59756 and missing==10264 and actual+missing==70020;assert cp==capture(row['path']) and sp==capture(ROOT/'final-linux-packet-manifest.json') and tool==capture(Path(__file__).resolve()) and python==capture(Path(sys.executable).resolve());post=resource()
print(json.dumps({'status':'PASS_INDEPENDENT_CURRENT_HISTORICAL_CONTENT_READS','scope':'CONTENT_AVAILABILITY_ONLY_NEW_TRANSPORT_OBSERVATION_NOT_CANONICAL_SOURCE_BINDING_OR_HISTORICAL_CUSTODY','seal':sp,'coverageSource':cp,'declaredRows':70020,'declaredPathBytes':3001521619,'currentlyActualFullByteValidRows':actual,'currentActualBytesRead':bytecount,'missingPhysicalRowsWithVerifiedBacking':missing,'missingContent':0,'freshHeldAll9StableDuringEachActualRead':True,'currentTransportObservationRollingSHA256':rolled.hexdigest(),'fullPhysicalRowsOrCanonicalBindingsCreated':False,'resourcePRE':pre,'resourcePOST':post,'tool':tool,'currentReviewContainerPython':python,'elapsedSeconds':time.monotonic()-begin,'subjectImportedOrEvaluated':False,'volumeWrites':False,'ROOT':'ABSENT'}))
