from pathlib import Path
import json,hashlib,subprocess,datetime,sys,ast
root=Path('/workspace/Project-Cortex');s=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-design-c3';r=s.with_name(s.name+'-review')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def closure(p):
 m=json.loads((p/'qa-manifest.json').read_text());actual={str(x.relative_to(p)) for x in p.rglob('*') if x.is_file() and x!=p/'qa-manifest.json'};rows=m['files'];expected={x['path'] for x in rows}
 assert len(rows)==len(expected) and actual==expected
 for x in rows:assert (p/x['path']).stat().st_size==x['bytes'] and h(p/x['path'])==x['sha256']
 return len(rows)
checks={'subjectClosure':closure(s),'c2SubjectClosure':closure(s/'lineage/task04-default-native-driver-design-c2'),'c2ReviewClosure':closure(s/'lineage/task04-default-native-driver-design-c2-review')}
assert checks=={'subjectClosure':287,'c2SubjectClosure':101,'c2ReviewClosure':163}
for n in ['task04-default-native-driver-design-c2','task04-default-native-driver-design-c2-review']:
 copy=s/'lineage'/n;original=s.parent/n
 assert {str(p.relative_to(copy)) for p in copy.rglob('*') if p.is_file()}=={str(p.relative_to(original)) for p in original.rglob('*') if p.is_file()}
 for p in copy.rglob('*'):
  if p.is_file():assert h(p)==h(original/p.relative_to(copy))
checks['lineageByteIdentity']=True
ids=json.loads((s/'initial14-identities.json').read_text());cases=ids['cases'];checks['identities']=len(cases);checks['nativeHashes']=len({x['normalizedNativeRequestHash'] for x in cases});checks['KMicroUSD']=sum(x['candidateReservationKMicroUSD'] for x in cases)
assert checks['identities']==14 and checks['nativeHashes']==13 and checks['KMicroUSD']==314310
base=json.loads((root/ids['source']).read_text());assert h(root/ids['source'])==ids['sourceSha256']
# Compare every selected field, not private canonical requests.
for c in cases:
 source=next(x for x in base['cases'] if x['scenarioId']==c['scenarioId'])
 for k,v in c.items():assert source[k]==v,(c['scenarioId'],k)
receipts=[]
for n in ['design-model.py','replay-cleanup-model.py']:
 p=r/'checks'/n;ast.parse(p.read_text());argv=[sys.executable,str(p)];start=datetime.datetime.now(datetime.timezone.utc).isoformat();out=subprocess.run(argv,cwd=root,capture_output=True)
 (r/'raw'/f'{p.stem}.stdout').write_bytes(out.stdout);(r/'raw'/f'{p.stem}.stderr').write_bytes(out.stderr)
 receipts.append({'argv':argv,'cwd':str(root),'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':out.returncode,'stdout':f'raw/{p.stem}.stdout','stderr':f'raw/{p.stem}.stderr','groups':json.loads(out.stdout)['groups'],'skipped':0,'scope':'ILLUSTRATIVE_ONLY'})
 assert out.returncode==0
checks['illustrativeGroups']=sum(x['groups'] for x in receipts);checks['skipped']=0
(r/'command-receipts.json').write_text(json.dumps(receipts,indent=2)+'\n')
(r/'verification.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps(checks,indent=2))
