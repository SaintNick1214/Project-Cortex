import datetime,json,subprocess,sys,hashlib,traceback,os
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');OUT=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30';W=ROOT/'work/resume/task04-evidence-transport-30';SRC=OUT.parent/'task04-catalog-release-c4-fresh-review'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt={'argv':sys.argv,'utcPre':now(),'failures':[],'checks':[]}
try:
 for name,args in [('clean-materialize',['--materialize']),('idempotence',['--materialize']),('readonly',[])]:
  cmd=[sys.executable,str(OUT/'materialize.py'),'--target',str(W/'replica'),*args];pre=now();r=subprocess.run(cmd,cwd=ROOT,capture_output=True);(OUT/(name+'.stdout')).write_bytes(r.stdout);(OUT/(name+'.stderr')).write_bytes(r.stderr);receipt['checks'].append({'name':name,'argv':cmd,'utcPre':pre,'utcPost':now(),'exitCode':r.returncode});assert r.returncode==0,(name,r.stderr.decode())
 # Independent closure verification against original frozen manifest, exact-self excluded.
 raw=(SRC/'qa-manifest.json').read_bytes();m=json.loads(raw);rows=m['rows'];rep=W/'replica';actual=set()
 for base,ds,fs in os.walk(rep,followlinks=False):
  for n in ds+fs:assert not (Path(base)/n).is_symlink()
  for n in fs:actual.add((Path(base)/n).relative_to(rep).as_posix())
 assert actual=={r['path'] for r in rows}|{'qa-manifest.json'};assert len(rows)==len({r['path'] for r in rows})
 assert (rep/'qa-manifest.json').read_bytes()==raw
 for row in rows:
  b=(rep/row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
 receipt['fullReplicaExactClosure']=True;receipt['originalManifestSha256']=hashlib.sha256(raw).hexdigest();receipt['files']=len(actual)
 # Full frozen subject verification after transport and restoration.
 orig=set()
 for base,ds,fs in os.walk(SRC,followlinks=False):
  for n in ds+fs:assert not (Path(base)/n).is_symlink()
  for n in fs:orig.add((Path(base)/n).relative_to(SRC).as_posix())
 assert orig==actual
 for row in rows:
  b=(SRC/row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
 receipt['frozenSourceUnchanged']=True;receipt['exitCode']=0
except BaseException:
 receipt['failures'].append(traceback.format_exc());receipt['exitCode']=1
finally:
 receipt['utcPost']=now();(OUT/'verification-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt));sys.exit(receipt['exitCode'])
