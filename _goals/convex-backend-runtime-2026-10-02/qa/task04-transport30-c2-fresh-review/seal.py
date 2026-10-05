import datetime,hashlib,json,sys,os
from pathlib import Path
O=Path(__file__).absolute().parent
def sha(b):return hashlib.sha256(b).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
r=json.loads((O/'review-receipt.json').read_text());assert r['exitCode']==0 and r['failures']==[]
a=json.loads((O/'adverse-receipt.json').read_text());assert a['exitCode']==0 and len(a['expectedRejections'])==20 and not a['unexpectedFailures']
s={'argv':sys.argv,'utcPre':now(),'verdict':'PASS','score':4.8,'transportOnly':True,'qualificationAcceptance':False,'reviewReportSha256':sha((O/'report.md').read_bytes()),'candidateManifestSha256':r['candidateAfter']['manifestSha256'],'originalManifestSha256':r['originalAfter']['manifestSha256'],'ownReplicaFiles':63544,'adverseExpectedRejections':20,'extraControls':['growth-after-fstat maximum-plus-one rejection','exact bound accepted','short existing original rejected'],'reviewFailures':[],'bootstrapDiscoveryFailureDisclosed':True}
s['utcPost']=now();s['exitCode']=0;(O/'summary.json').write_text(json.dumps(s,indent=2)+'\n')
rows=[]
for p in sorted(O.rglob('*')):
 assert not p.is_symlink()
 if not p.is_file() or p.name=='qa-manifest.json':continue
 b=p.read_bytes();rows.append({'path':p.relative_to(O).as_posix(),'kind':'file','bytes':len(b),'sha256':sha(b)})
m={'utc':now(),'excludesOnly':'qa-manifest.json','links':'none; all regular files','rows':rows}
(O/'qa-manifest.json').write_text(json.dumps(m,indent=2)+'\n')
actual={p.relative_to(O).as_posix() for p in O.rglob('*') if p.is_file()}
assert actual=={r['path'] for r in rows}|{'qa-manifest.json'}
for row in rows:
 b=(O/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
print(json.dumps({'verdict':'PASS','score':4.8,'files':len(actual),'reportSha256':s['reviewReportSha256'],'manifestSha256':sha((O/'qa-manifest.json').read_bytes()),'utc':now()}))
