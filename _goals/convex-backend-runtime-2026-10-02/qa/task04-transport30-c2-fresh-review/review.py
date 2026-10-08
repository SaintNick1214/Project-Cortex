import sys, os, json, gzip, hashlib, datetime, subprocess, traceback, ast, difflib
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path('/workspace/Project-Cortex')
QA=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa'
OUT=QA/'task04-transport30-c2-fresh-review'
W=ROOT/'work/resume/task04-transport30-c2-fresh-review'
C=QA/'task04-evidence-transport-30-c2'
C1=QA/'task04-evidence-transport-30'
SRC=QA/'task04-catalog-release-c4-fresh-review'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
R={'argv':sys.argv,'utcPre':now(),'failures':[],'checks':[]}
def files(p):
 out=set()
 for base,ds,fs in os.walk(p,followlinks=False):
  for n in ds+fs:assert not (Path(base)/n).is_symlink(),str(Path(base)/n)
  for n in fs:
   q=Path(base)/n;assert q.is_file();out.add(q.relative_to(p).as_posix())
 return out
def closure(p,pin=None):
 raw=(p/'qa-manifest.json').read_bytes()
 if pin:assert sha(raw)==pin
 m=json.loads(raw);rows=m['rows'];assert len(rows)==len({r['path'] for r in rows})
 assert files(p)=={r['path'] for r in rows}|{'qa-manifest.json'}
 for r in rows:
  b=(p/r['path']).read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256'],r['path']
 return {'files':len(rows)+1,'manifestSha256':sha(raw),'bytes':sum(r['bytes'] for r in rows)+len(raw),'utc':now()}
def run(name,cmd):
 pre=now();v=subprocess.run(cmd,cwd=ROOT,capture_output=True)
 (OUT/(name+'.stdout')).write_bytes(v.stdout);(OUT/(name+'.stderr')).write_bytes(v.stderr)
 R['checks'].append({'name':name,'argv':cmd,'utcPre':pre,'utcPost':now(),'exitCode':v.returncode})
 assert v.returncode==0,(name,v.stderr.decode());return v
try:
 R['candidateBefore']=closure(C,'72585a1ecf6eeeb6adb619470c2e2a988e7c8e228a0f6f6b8e50b52bbb39009d')
 assert R['candidateBefore']['files']==93
 assert sha((C/'report.md').read_bytes())=='a7040b4d4010889e547ee19d5a21b3e19244f76a64873898924d630b4f4f1022'
 assert sha((C/'materialize.py').read_bytes())=='52127a96ba92de55b1b91996688ba77dd6add3ffa202c6fd6ba80861dcbd761d'
 R['c1Before']=closure(C1);R['lineage']=closure(C/'lineage/c1');assert R['lineage']['files']==53
 assert files(C1)==files(C/'lineage/c1')
 for f in files(C1):assert (C1/f).read_bytes()==(C/'lineage/c1'/f).read_bytes()
 for f in ['transport-map.json.gz',*sorted(files(C/'blobs'))]:
  f=f if f=='transport-map.json.gz' else 'blobs/'+f
  assert (C/f).read_bytes()==(C1/f).read_bytes()
 old=(C1/'materialize.py').read_text();new=(C/'materialize.py').read_text()
 diff=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='lineage/c1/materialize.py',tofile='materialize.py'))
 assert diff==(C/'helper-change.diff').read_text();(OUT/'verified-helper.diff').write_text(diff)
 oa=ast.parse(old);na=ast.parse(new)
 of={n.name:n for n in oa.body if isinstance(n,ast.FunctionDef)};nf={n.name:n for n in na.body if isinstance(n,ast.FunctionDef)}
 assert ast.dump(of['safe'])==ast.dump(nf['safe'])
 R['safeLiteralCodepoints']=[[ord(c) for c in n.value] for n in ast.walk(nf['safe']) if isinstance(n,ast.Constant) and isinstance(n.value,str) and n.value in ('\\','\x00')]
 assert sorted(R['safeLiteralCodepoints'])==[[0],[92]]
 R['originalBefore']=closure(SRC,'0b3f7f43fdfbd1b2e71cb420b7a24d1255773b3ca6973df0775dc4d1c0c5179d')
 mapping=json.loads(gzip.decompress((C/'transport-map.json.gz').read_bytes()))
 original=json.loads((SRC/'qa-manifest.json').read_bytes());expected={r['path']:(r['sha256'],r['bytes']) for r in original['rows']}
 raw=(SRC/'qa-manifest.json').read_bytes();expected['qa-manifest.json']=(sha(raw),len(raw))
 assert {p:(h,s) for p,h,s in mapping['files']}==expected
 assert len(mapping['files'])==63544 and sum(s for p,h,s in mapping['files'])==2296620105
 h={};exec(compile(new,str(C/'materialize.py'),'exec'),h)
 contents=dict(h['entries'](C,mapping));assert set(contents)==set(mapping['contents']) and len(contents)==436
 assert contents[sha(raw)]==raw
 R['exactMapAndArchive']=True
 assert not (W/'replica').exists()
 for name,args in [('clean',['--materialize']),('idempotence',['--materialize']),('readonly',[])]:
  v=run(name,[sys.executable,'-B',str(C/'materialize.py'),'--target',str(W/'replica'),*args]);result=json.loads(v.stdout)
  assert result['filesVerified']==63544 and result['created']==(63544 if name=='clean' else 0)
  assert result['existingVerified']==(0 if name=='clean' else 63544)
 R['replicaClosure']=closure(W/'replica',sha(raw))
 adverse=(C/'adverse-c2.py').read_text()
 adverse=adverse.replace("OUT=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30-c2';W=ROOT/'work/resume/task04-evidence-transport-30-c2/adverse'", "OUT=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-transport30-c2-fresh-review';C=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30-c2';W=ROOT/'work/resume/task04-transport30-c2-fresh-review/adverse'")
 adverse=adverse.replace("OUT/'materialize.py'","C/'materialize.py'").replace("OUT/'transport-map.json.gz'","C/'transport-map.json.gz'").replace("OUT/'blobs'","C/'blobs'")
 (OUT/'adverse-independent.py').write_text(adverse)
 run('adverse',[sys.executable,'-B',str(OUT/'adverse-independent.py')])
 ar=json.loads((OUT/'adverse-receipt.json').read_text());assert len(ar['expectedRejections'])==20 and not ar['unexpectedFailures']
 # An instrumented opened regular file models growth after fstat. Assert the read
 # request remains max+1 and the extra byte produces rejection, not clipping.
 fixture=W/'bounded';fixture.mkdir();(fixture/'x').write_bytes(b'ab')
 calls=[];saved=h['os'].fdopen
 class Guard:
  def __init__(self,fd,mode):self.f=saved(fd,mode)
  def __enter__(self):return self
  def __exit__(self,*a):self.f.close()
  def fileno(self):return self.f.fileno()
  def read(self,n):calls.append(n);return b'abc'
 h['os'].fdopen=lambda fd,mode:Guard(fd,mode)
 try:
  try:h['read_at'](fixture,'x',2)
  except ValueError as e:assert str(e)=='input exceeds trusted byte bound'
  else:raise AssertionError('growth accepted')
 finally:h['os'].fdopen=saved
 assert calls==[3] and (fixture/'x').read_bytes()==b'ab'
 assert h['read_at'](fixture,'x',2)==b'ab'
 try:h['existing'](fixture,['x',sha(b'abc'),3])
 except ValueError as e:assert str(e).startswith('existing original mismatch')
 else:raise AssertionError('short existing accepted')
 R['boundGrowthReadRequests']=calls;R['exactBoundaryAndShortReject']=True
 R['candidateAfter']=closure(C,R['candidateBefore']['manifestSha256'])
 R['c1After']=closure(C1,R['c1Before']['manifestSha256'])
 R['originalAfter']=closure(SRC,sha(raw));R['exitCode']=0
except BaseException:
 R['failures'].append(traceback.format_exc());R['exitCode']=1
finally:
 R['utcPost']=now();(OUT/'review-receipt.json').write_text(json.dumps(R,indent=2)+'\n')
print(json.dumps(R));sys.exit(R['exitCode'])
