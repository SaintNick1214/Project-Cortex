import io,json,gzip,tarfile,hashlib,sys,datetime
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');OUT=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30';W=ROOT/'work/resume/task04-evidence-transport-30';m=json.loads(gzip.decompress((OUT/'transport-map.json.gz').read_bytes()));SRC=ROOT/m['originalRoot'];unique={}
for path,h,size in m['files']:unique.setdefault(h,(path,size))
r={'argv':sys.argv,'utcPre':datetime.datetime.now(datetime.timezone.utc).isoformat(),'failures':[]}
try:
 p=W/'deterministic-repeat.tar.gz'
 with p.open('wb') as f,gzip.GzipFile(fileobj=f,mode='wb',filename='',mtime=0,compresslevel=9) as gz,tarfile.open(fileobj=gz,mode='w|',format=tarfile.USTAR_FORMAT) as tar:
  for h,(path,size) in sorted(unique.items()):
   b=(SRC/path).read_bytes();assert len(b)==size and hashlib.sha256(b).hexdigest()==h;t=tarfile.TarInfo(h);t.size=size;t.mode=0o644;t.uid=t.gid=t.mtime=0;t.uname=t.gname='';tar.addfile(t,io.BytesIO(b))
 assert p.stat().st_size==m['archiveBytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==m['archiveSha256'];r['byteExactDeterministicRepeat']=True;r['exitCode']=0
except BaseException as e:r['failures'].append(repr(e));r['exitCode']=1
r['utcPost']=datetime.datetime.now(datetime.timezone.utc).isoformat();(OUT/'determinism-receipt.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));sys.exit(r['exitCode'])
