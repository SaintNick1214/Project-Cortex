import os,sys,json,hashlib,gzip,tarfile,io,shutil,datetime,subprocess,traceback
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex'); QA=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa'; SRC=QA/'task04-catalog-release-c4-fresh-review'; OUT=QA/'task04-evidence-transport-30'; WORK=ROOT/'work/resume/task04-evidence-transport-30'
EXPECTED='0b3f7f43fdfbd1b2e71cb420b7a24d1255773b3ca6973df0775dc4d1c0c5179d'
def sha(b):return hashlib.sha256(b).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def dump(p,o):p.write_text(json.dumps(o,indent=2)+'\n')
def closure():
 raw=(SRC/'qa-manifest.json').read_bytes();assert sha(raw)==EXPECTED
 m=json.loads(raw);assert m['excludesOnly']=='qa-manifest.json'
 rows=m['rows']; expected={r['path'] for r in rows}|{'qa-manifest.json'}; actual=set()
 for base,ds,fs in os.walk(SRC,followlinks=False):
  for n in ds+fs:assert not (Path(base)/n).is_symlink()
  for n in fs:actual.add((Path(base)/n).relative_to(SRC).as_posix())
 assert actual==expected
 files=[];unique={}
 for r in rows+[{'path':'qa-manifest.json','kind':'file','bytes':len(raw),'sha256':sha(raw)}]:
  p=SRC/r['path'];assert r['kind']=='file' and p.is_file();b=p.read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256'],r['path']
  files.append([r['path'],r['sha256'],r['bytes']]);unique.setdefault(r['sha256'],[r['bytes'],r['path']])
 return sorted(files),unique
receipt={'argv':sys.argv,'utcPre':now(),'failures':[]}
try:
 files,unique=closure();receipt['sourceVerifiedBefore']=now();receipt['files']=len(files);receipt['bytes']=sum(r[2] for r in files);receipt['uniqueContents']=len(unique)
 for old in ('28','29'):
  for name in ('materialize.py','transport-map.json','README.md'):
   src=QA/f'task04-evidence-transport-{old}'/name;dst=OUT/'preimages'/f'transport-{old}'/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
 for name in ('qa-manifest.json','report.md'):
  dst=OUT/'preimages'/'source'/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(SRC/name,dst)
 packed=WORK/'unique-content.tar.gz'
 with packed.open('wb') as f,gzip.GzipFile(fileobj=f,mode='wb',mtime=0,filename='',compresslevel=9) as gz,tarfile.open(fileobj=gz,mode='w|',format=tarfile.USTAR_FORMAT) as tar:
  for digest,(size,path) in sorted(unique.items()):
   b=(SRC/path).read_bytes();assert sha(b)==digest and len(b)==size
   t=tarfile.TarInfo(digest);t.size=size;t.mode=0o644;t.uid=t.gid=t.mtime=0;t.uname=t.gname='';tar.addfile(t,io.BytesIO(b))
 chunks=[]; (OUT/'blobs').mkdir()
 with packed.open('rb') as f:
  while b:=f.read(5*1024*1024):
   digest=sha(b);name=f'blobs/{len(chunks):04d}-{digest}.part';(OUT/name).write_bytes(b);chunks.append({'path':name,'sha256':digest,'bytes':len(b)})
 mapping={'format':'cortex-lossless-content-addressed-targzip-v1','originalRoot':str(SRC.relative_to(ROOT)),'manifestSha256':EXPECTED,'directOriginalPaths':['report.md','qa-manifest.json'],'files':files,'contents':{k:v[0] for k,v in sorted(unique.items())},'chunks':chunks,'archiveSha256':sha(packed.read_bytes()),'archiveBytes':packed.stat().st_size,'archiveEntryNames':'sha256; unique regular-file entries only; no directories'}
 raw=json.dumps(mapping,separators=(',',':'),ensure_ascii=True).encode();mapbytes=gzip.compress(raw,compresslevel=9,mtime=0);assert len(mapbytes)<=5*1024*1024;(OUT/'transport-map.json.gz').write_bytes(mapbytes)
 receipt['mapCompressedSha256']=sha(mapbytes);receipt['mapRawSha256']=sha(raw);receipt['blobs']=len(chunks);receipt['compressedBytes']=packed.stat().st_size;receipt['sourceUnchangedAfter']=closure()[0]==files;receipt['utcPost']=now();receipt['exitCode']=0
except BaseException:
 receipt['failures'].append(traceback.format_exc());receipt['utcPost']=now();receipt['exitCode']=1;dump(OUT/'prepare-receipt.json',receipt);raise
dump(OUT/'prepare-receipt.json',receipt);print(json.dumps(receipt))
