import importlib.util,io,tarfile,gzip,hashlib,json,datetime,sys,os,shutil,subprocess
sys.dont_write_bytecode=True
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');OUT=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-transport30-c2-fresh-review';C=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30-c2';W=ROOT/'work/resume/task04-transport30-c2-fresh-review/adverse';W.mkdir()
spec=importlib.util.spec_from_file_location('helper',C/'materialize.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
result={'argv':sys.argv,'utcPre':now(),'expectedRejections':[],'unexpectedFailures':[]}
def rejects(name,fn):
 pre=now()
 try:fn()
 except (ValueError,OSError,tarfile.TarError) as e:result['expectedRejections'].append({'name':name,'utcPre':pre,'utcPost':now(),'type':type(e).__name__,'message':str(e)})
 else:raise AssertionError('unexpected acceptance: '+name)
def archive_test(name,names,body=b'ok',expected_body=b'ok',kind=tarfile.REGTYPE):
 d=W/name;d.mkdir();raw=io.BytesIO()
 with tarfile.open(fileobj=raw,mode='w') as t:
  for n in names:
   m=tarfile.TarInfo(n);m.type=kind;m.size=len(body) if kind==tarfile.REGTYPE else 0;t.addfile(m,io.BytesIO(body) if m.size else None)
 b=gzip.compress(raw.getvalue(),mtime=0);(d/'part').write_bytes(b);digest=hashlib.sha256(expected_body).hexdigest();mapping={'chunks':[{'path':'part','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}],'contents':{digest:len(expected_body)}}
 rejects(name,lambda:list(h.entries(d,mapping)))
try:
 # Two new actual-character controls run before any original test files are created.
 for label,char in [('single-backslash-precreation',chr(92)),('NUL-precreation',chr(0))]:
  path='missing/name'+char+'suffix';pre=now();base=W/'precreation'/label
  try:h.safe(path)
  except ValueError as e:assert str(e)=='unsafe path'
  else:raise AssertionError('unsafe character accepted by safe: '+label)
  try:h.create(base,path,b'forbidden')
  except ValueError as e:assert str(e)=='unsafe path'
  else:raise AssertionError('unsafe character accepted by create: '+label)
  assert not base.exists() and not base.parent.exists()
  result['expectedRejections'].append({'name':label,'inputCodepoints':[ord(c) for c in path],'utcPre':pre,'utcPost':now(),'type':'ValueError','message':'unsafe path','safeDenied':True,'createDeniedBeforeTargetCreation':True})
 for p in ('../outside','/absolute','a/../b','a//b','a\\b','a/./b'):
  rejects('unsafe:'+p,lambda p=p:h.safe(p))
 target=W/'original';target.mkdir();(target/'present').write_bytes(b'ok');row=['present',hashlib.sha256(b'ok').hexdigest(),2]
 assert h.existing(target,row)
 rejects('exclusive-create-existing-same-content',lambda:h.create(target,'present',b'ok'));assert (target/'present').read_bytes()==b'ok'
 rejects('existing-content-mismatch',lambda:h.existing(target,['present','0'*64,2]));assert (target/'present').read_bytes()==b'ok'
 outside=W/'outside';outside.mkdir();(target/'link').symlink_to(outside,target_is_directory=True)
 rejects('symlink-ancestor',lambda:h.create(target,'link/escape',b'ok'));assert not (outside/'escape').exists()
 (target/'filelink').symlink_to(target/'present');rejects('symlink-file',lambda:h.existing(target,['filelink',row[1],2]))
 digest=hashlib.sha256(b'ok').hexdigest()
 archive_test('unknown-entry',['unknown']);archive_test('duplicate-entry',[digest,digest]);archive_test('hash-mismatch',[digest],body=b'NO');archive_test('symlink-entry',[digest],kind=tarfile.SYMTYPE);archive_test('missing-entry',[])
 # Oversized existing original: reject from fstat before buffered read, preserve file.
 bounded=W/'bounded';bounded.mkdir();(bounded/'present').write_bytes(b'XYZ');calls=[];fdopen=h.os.fdopen
 class ReadGuard:
  def __init__(self,fd,mode):self.stream=fdopen(fd,mode)
  def __enter__(self):return self
  def __exit__(self,*args):self.stream.close()
  def fileno(self):return self.stream.fileno()
  def read(self,*args):calls.append(args);raise AssertionError('oversize file buffered before fstat rejection')
 h.os.fdopen=lambda fd,mode:ReadGuard(fd,mode)
 try:rejects('oversize-existing-before-buffer',lambda:h.existing(bounded,['present',hashlib.sha256(b'XY').hexdigest(),2]))
 finally:h.os.fdopen=fdopen
 assert not calls and (bounded/'present').read_bytes()==b'XYZ'
 # Corrupt oversized packet inputs must reject before target root/original creation.
 for label,kind in [('oversize-chunk-precreation','chunk'),('oversize-map-precreation','map')]:
  packet=W/label;packet.mkdir();shutil.copyfile(C/'materialize.py',packet/'materialize.py');shutil.copyfile(C/'transport-map.json.gz',packet/'transport-map.json.gz')
  if kind=='chunk':
   shutil.copytree(C/'blobs',packet/'blobs');mapping=json.loads(gzip.decompress((C/'transport-map.json.gz').read_bytes()));first=packet/mapping['chunks'][0]['path']
   with first.open('ab') as stream:stream.write(b'x')
  else:
   with (packet/'transport-map.json.gz').open('wb') as stream:stream.truncate(h.LIMIT+1)
  target=W/'denied-restore'/label;cmd=[sys.executable,'-B',str(packet/'materialize.py'),'--target',str(target),'--materialize'];pre=now();run=subprocess.run(cmd,capture_output=True);(OUT/(label+'.stdout')).write_bytes(run.stdout);(OUT/(label+'.stderr')).write_bytes(run.stderr)
  assert run.returncode!=0 and b'input exceeds trusted byte bound' in run.stderr and not target.exists() and not target.parent.exists()
  result['expectedRejections'].append({'name':label,'argv':cmd,'utcPre':pre,'utcPost':now(),'exitCode':run.returncode,'message':'input exceeds trusted byte bound','originalRootAbsentAfter':True})
 result['exitCode']=0
except BaseException as e:result['unexpectedFailures'].append(repr(e));result['exitCode']=1
result['utcPost']=now();(OUT/'adverse-receipt.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));sys.exit(result['exitCode'])
