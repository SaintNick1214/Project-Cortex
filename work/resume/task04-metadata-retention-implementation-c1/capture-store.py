from pathlib import Path
import hashlib,json,datetime,subprocess,sys,gzip,os,fcntl
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c1'
tag=sys.argv[1];listArg=sys.argv[2];files=json.loads((r/listArg[1:]).read_text()) if listArg.startswith('@') else json.loads(listArg);files=([listArg[1:]]+files) if listArg.startswith('@') else files;argv=sys.argv[3:]
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
pool=q/'source-byte-store';pool.mkdir(exist_ok=True)
def capturedUnlocked(phase):
 rows={}
 for name in files:
  p=r/name;b=p.read_bytes();h=hashlib.sha256(b).hexdigest()
  objectPath=pool/(h+'.gz')
  if objectPath.is_symlink():raise RuntimeError('OBJECT_LINK')
  if objectPath.exists():
   if objectPath.stat().st_nlink!=1:raise RuntimeError('OBJECT_NLINK')
   if gzip.decompress(objectPath.read_bytes())!=b:raise RuntimeError('OBJECT_BYTES')
  else:
   encoded=gzip.compress(b,mtime=0)
   with objectPath.open('xb') as f:f.write(encoded)
   if objectPath.stat().st_nlink!=1 or gzip.decompress(objectPath.read_bytes())!=b:raise RuntimeError('OBJECT_VERIFY')
  rows[name]={'sha256':h,'bytes':len(b),'beforeByteObject':str(objectPath.relative_to(q)),'encoding':'gzip, original bytes independently decompressed/equal before command','objectSha256':hashlib.sha256(objectPath.read_bytes()).hexdigest()}
 (q/(tag+'-'+phase+'.json')).write_text(json.dumps({'utc':now(),'files':rows,'layout':'normal nlink1 lossless exact-hash byte store; no hardlinks or caller assertions'},indent=2)+'\n')
def captured(phase):
 with (pool/'.writer-lock').open('a+b') as lock:
  fcntl.flock(lock.fileno(),fcntl.LOCK_EX)
  try:capturedUnlocked(phase)
  finally:fcntl.flock(lock.fileno(),fcntl.LOCK_UN)
captured('pre');start=now();x=subprocess.run(argv,cwd=r,capture_output=True)
(q/(tag+'.stdout')).write_bytes(x.stdout);(q/(tag+'.stderr')).write_bytes(x.stderr)
(q/(tag+'-receipt.json')).write_text(json.dumps({'argv':argv,'cwd':str(r),'startUtc':start,'endUtc':now(),'exit':x.returncode,'recorderSourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},indent=2)+'\n')
captured('post')
print(x.stdout.decode());print(x.stderr.decode(),file=sys.stderr);sys.exit(x.returncode)
