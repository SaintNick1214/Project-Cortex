from pathlib import Path
import json,hashlib,datetime
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa';d=q/'task04-default-native-driver-implementation-c2';results=[]
for name in ['task04-default-native-driver-implementation-c1','task04-default-native-driver-implementation-c1-review','task04-default-native-driver-design-c4','task04-default-native-driver-design-c4-review']:
 p=q/name;manifest=p/'qa-manifest.json';m=json.loads(manifest.read_text());rows=m.get('rows',m.get('files'));expected={row['path']:(row['bytes'],row['sha256']) for row in rows};actual={}
 for f in p.rglob('*'):
  if f.is_file() and f!=manifest:
   b=f.read_bytes();actual[str(f.relative_to(p))]=(len(b),hashlib.sha256(b).hexdigest())
 assert actual==expected,name
 results.append({'path':str(p.relative_to(r)),'manifestSHA256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'files':len(actual),'exactRecursiveClosure':True,'excludesOnly':'qa-manifest.json'})
# Original control bytes and all56 frozen references, not merely check exits.
c1=q/'task04-default-native-driver-implementation-c1'; unchanged=[]
for p in (c1/'fixture/checks').glob('*.mjs'):
 other=d/'fixture/checks'/p.name;assert p.read_bytes()==other.read_bytes();unchanged.append(str(other.relative_to(d)))
for p in (c1/'regression').rglob('*'):
 if p.is_file():assert p.read_bytes()==(d/'regression'/p.relative_to(c1/'regression')).read_bytes()
source=json.loads((d/'source-pre.json').read_text());post=[]
for row in source['sources']:
 p=r/row['path'];b=p.read_bytes();h=hashlib.sha256(b).hexdigest();assert h==row['sha256'];post.append({'path':row['path'],'bytes':len(b),'sha256':h})
(d/'source-post.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':post},indent=2)+'\n')
value={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'historicalClosures':results,'protectedPins':len(post),'originalProducerControlsUnchanged':unchanged,'regressionAllBytesUnchanged':True,'noNativeCertification':True}
(d/'historical-closure-verification.json').write_text(json.dumps(value,indent=2)+'\n');print(json.dumps(value))
