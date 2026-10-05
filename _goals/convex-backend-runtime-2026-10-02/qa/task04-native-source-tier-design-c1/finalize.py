import sys,json,hashlib,gzip,datetime,os,traceback
from pathlib import Path
O=Path(__file__).absolute().parent;ROOT=Path('/workspace/Project-Cortex');W=ROOT/'work/resume/task04-native-source-tier-design-c1'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
record={'argv':sys.argv,'utcPre':now(),'changed':[],'unchanged':0,'failures':[]}
before=json.loads((O/'source-before.json').read_text())['rows'];after=[]
for row in before:
 p=ROOT/row['path'];b=p.read_bytes();h=sha(b);entry={'path':row['path'],'bytes':len(b),'sha256':h}
 after.append(entry)
 if len(b)==row['bytes'] and h==row['sha256']:record['unchanged']+=1
 else:
  packed=gzip.compress(b,mtime=0);assert len(packed)<=5*1024*1024;name='preimages/'+h+'.gz';(O/name).write_bytes(packed)
  record['changed'].append({'path':row['path'],'before':{'bytes':row['bytes'],'sha256':row['sha256'],'preimage':row['preimage']},'after':{'bytes':len(b),'sha256':h,'preimage':name},'attribution':'Mutable C4 coordinator work; investigation never wrote source paths.'})
record['rows']=after;record['utcPost']=now();record['exitCode']=0
(O/'final-source-post.json').write_text(json.dumps(record,indent=2)+'\n')
note='\nFinal source observation at '+record['utcPost']+': '+str(record['unchanged'])+' old snapshot paths unchanged; '+str(len(record['changed']))+' changed paths recorded with exact before/after bytes, hashes and preimages in `final-source-post.json`. These changes are separate mutable C4 work, not adoption of compiler classification or acceptance by this investigation. Old graph/source pins remain historical and unchanged.\n'
with (O/'report.md').open('a') as f:f.write(note)
assert json.loads((O/'design-adversaries-receipt.json').read_text())['exitCode']==0
controls=json.loads((O/'design-adversaries-receipt.json').read_text())['controls'];assert len(controls)==39
(W/'operation-summary.json').write_text(json.dumps({'argv':sys.argv,'utcPre':record['utcPre'],'utcPost':now(),'exitCode':0,'scope':'Public static source-only design investigation; no subject source code execution','sourceChangesByInvestigator':0,'modelControls':39,'sourceSnapshotPaths':len(before),'mutableCoordinatorDrift':len(record['changed'])},indent=2)+'\n')
def seal(directory):
 rows=[]
 for p in sorted(directory.rglob('*')):
  assert not p.is_symlink()
  if not p.is_file() or p==directory/'qa-manifest.json':continue
  b=p.read_bytes();rows.append({'path':p.relative_to(directory).as_posix(),'kind':'file','bytes':len(b),'sha256':sha(b)})
 m={'utc':now(),'excludesOnly':'qa-manifest.json','links':'none; all regular files','rows':rows};raw=(json.dumps(m,indent=2)+'\n').encode();(directory/'qa-manifest.json').write_bytes(raw)
 assert {p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file()}=={r['path'] for r in rows}|{'qa-manifest.json'}
 for r in rows:
  b=(directory/r['path']).read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256']
 return {'files':len(rows)+1,'sha256':sha(raw),'bytes':len(raw)}
scratch=seal(W)
summary={'status':'CONDITIONAL_DESIGN_ONLY_NOT_ACCEPTED_OR_SUPPORTED_FOR_ADOPTION','utc':now(),'reportSha256':sha((O/'report.md').read_bytes()),'sourcePaths':len(before),'modelControls':39,'sourceDriftPaths':len(record['changed']),'scratchManifest':scratch,'compilerSha256':'569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39','compilerBytes':9144216,'scopePreserved':True,'qualificationAcceptance':False,'investigatorSourceWrites':0}
(O/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');qa=seal(O)
print(json.dumps({'reportSha256':summary['reportSha256'],'qaManifest':qa,'scratchManifest':scratch,'sourceDrift':len(record['changed']),'utc':now()}))
