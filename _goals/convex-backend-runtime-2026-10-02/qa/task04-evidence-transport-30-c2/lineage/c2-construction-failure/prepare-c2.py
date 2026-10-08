import os,sys,json,hashlib,shutil,datetime,traceback,importlib.util,gzip
sys.dont_write_bytecode=True
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');QA=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa';OLD=QA/'task04-evidence-transport-30';OUT=QA/'task04-evidence-transport-30-c2';WORK=ROOT/'work/resume/task04-evidence-transport-30-c2';SRC=QA/'task04-catalog-release-c4-fresh-review';EXPECTED='0b3f7f43fdfbd1b2e71cb420b7a24d1255773b3ca6973df0775dc4d1c0c5179d'
def sha(b):return hashlib.sha256(b).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def closure():
 raw=(SRC/'qa-manifest.json').read_bytes();assert sha(raw)==EXPECTED;m=json.loads(raw);assert m['excludesOnly']=='qa-manifest.json';rows=m['rows'];assert len(rows)==len({r['path'] for r in rows});actual=set()
 for base,ds,fs in os.walk(SRC,followlinks=False):
  for n in ds+fs:assert not (Path(base)/n).is_symlink()
  for n in fs:actual.add((Path(base)/n).relative_to(SRC).as_posix())
 assert actual=={r['path'] for r in rows}|{'qa-manifest.json'}
 for row in rows:
  assert row['kind']=='file';p=SRC/row['path'];assert p.is_file();b=p.read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
 return {'files':len(actual),'manifestSha256':sha(raw),'fullClosureVerified':True}
r={'argv':sys.argv,'utcPre':now(),'failures':[]}
try:
 r['sourcePre']=closure();r['sourcePreUtc']=now();oldmanifest=(OLD/'qa-manifest.json').read_bytes();m=json.loads(oldmanifest);assert m['excludesOnly']=='qa-manifest.json';actual={p.relative_to(OLD).as_posix() for p in OLD.rglob('*') if p.is_file()};assert actual=={r['path'] for r in m['rows']}|{'qa-manifest.json'}
 for row in m['rows']:
  b=(OLD/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
 assert not OUT.exists();OUT.mkdir();shutil.copytree(OLD,OUT/'lineage/c1')
 for name in ('blobs','transport-map.json.gz'):
  src=OLD/name;dst=OUT/name
  if src.is_dir():shutil.copytree(src,dst)
  else:shutil.copyfile(src,dst)
 old=(OLD/'materialize.py').read_text();needle=next(line for line in old.splitlines() if 'isinstance(path,str)' in line)
 replacement=r"    require(isinstance(path,str) and path and '\' not in path and '\x00' not in path,'unsafe path')"
 corrected=old.replace(needle,replacement);assert old!=corrected;compile(corrected,'materialize.py','exec');(OUT/'materialize.py').write_text(corrected)
 spec=importlib.util.spec_from_file_location('prior',OUT/'lineage/c1/materialize.py');helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
 witness=[]
 for label,char in [('actual-single-backslash',chr(92)),('actual-NUL',chr(0))]:
  path='a'+char+'b';pre=now();result=helper.safe(path);assert result==path;witness.append({'name':label,'inputRepr':repr(path),'inputCodepoints':[ord(c) for c in path],'utcPre':pre,'utcPost':now(),'priorAccepted':True,'expectedPolicy':'reject before creation'})
 r.update({'baselineWitness':witness,'priorPacketManifestSha256':sha(oldmanifest),'priorHelperSha256':sha(old.encode()),'correctedHelperSha256':sha(corrected.encode()),'mapBytesUnchanged':(OUT/'transport-map.json.gz').read_bytes()==(OLD/'transport-map.json.gz').read_bytes(),'archiveBytesUnchanged':all((OUT/p.relative_to(OLD)).read_bytes()==p.read_bytes() for p in (OLD/'blobs').iterdir()),'sourcePost':closure(),'sourcePostUtc':now(),'exitCode':0})
except BaseException:r['failures'].append(traceback.format_exc());r['exitCode']=1
r['utcPost']=now();(WORK/'prepare-c2-receipt.json').write_text(json.dumps(r,indent=2)+'\n')
if OUT.exists():(OUT/'prepare-c2-receipt.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r));sys.exit(r['exitCode'])
