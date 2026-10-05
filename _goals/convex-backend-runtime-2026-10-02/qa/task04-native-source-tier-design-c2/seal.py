import datetime,json,hashlib,os,sys
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');O=Path(__file__).absolute().parent;W=ROOT/'work/resume/task04-native-source-tier-design-c2'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
pre=now();r=json.loads((O/'repair-receipt.json').read_text());assert r['exitCode']==0 and r['failures']==[]
for ref in r['referencesAfter']:
 d=ROOT/ref['path'];raw=(d/'qa-manifest.json').read_bytes();assert sha(raw)==ref['manifestSha256'];m=json.loads(raw);actual=set()
 for base,ds,fs in os.walk(d,followlinks=False):
  for n in ds+fs:assert not (Path(base)/n).is_symlink()
  actual.update((Path(base)/n).relative_to(d).as_posix() for n in fs)
 assert actual=={x['path'] for x in m['rows']}|{'qa-manifest.json'}
 for x in m['rows']:
  b=(d/x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256']
(O/'seal-preflight.json').write_text(json.dumps({'argv':sys.argv,'utcPre':pre,'utcPost':now(),'exitCode':0,'frozenReferenceClosuresUnchanged':r['referencesAfter'],'reportBefore':{'bytes':(O/'report.md').stat().st_size,'sha256':sha((O/'report.md').read_bytes())}},indent=2)+'\n')
(W/'operation-summary.json').write_text(json.dumps({'utc':now(),'scope':'Bounded design count repair only','newModelResults':{'original':39,'freshReviewer':33},'counts':{'extra':'99+19=118','extension':'97+19=116','regression':'96+17=113'},'toolsEach':'4+14=18','subjectWrites':0,'implementationAcceptance':False},indent=2)+'\n')
def seal(d):
 rows=[]
 for p in sorted(d.rglob('*')):
  assert not p.is_symlink()
  if not p.is_file() or p==d/'qa-manifest.json':continue
  b=p.read_bytes();assert len(b)<=5*1024*1024;rows.append({'path':p.relative_to(d).as_posix(),'kind':'file','bytes':len(b),'sha256':sha(b)})
 raw=(json.dumps({'utc':now(),'excludesOnly':'qa-manifest.json','links':'none; all regular files','rows':rows},indent=2)+'\n').encode();(d/'qa-manifest.json').write_bytes(raw)
 assert {p.relative_to(d).as_posix() for p in d.rglob('*') if p.is_file()}=={x['path'] for x in rows}|{'qa-manifest.json'}
 for x in rows:
  b=(d/x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256']
 return {'files':len(rows)+1,'rows':len(rows),'manifestSha256':sha(raw)}
scratch=seal(W)
summary={'utc':now(),'status':'CORRECTED_DESIGN_PROPOSAL_FRESH_DESIGN_JUDGMENT_REQUIRED','reportSha256':sha((O/'report.md').read_bytes()),'scratch':scratch,'profilePartitions':json.loads((O/'profile-partitions.json').read_text()),'priorVerdictPreserved':'NEEDS FIXES DESIGN ONLY3.8','modelsRerun39And33':True,'qualificationAcceptance':False,'currentC4ClassificationAdopted':False}
(O/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');qa=seal(O)
print(json.dumps({'reportSha256':summary['reportSha256'],'qa':qa,'scratch':scratch,'utc':now()}))
