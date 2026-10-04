from pathlib import Path
import json, hashlib, datetime, ast, copy
root=Path('/workspace/Project-Cortex'); base=root/'_goals/convex-backend-runtime-2026-10-02/qa'; subject=base/'task04-default-native-driver-design-c1'; review=base/'task04-default-native-driver-design-c1-review'
sha=lambda b:hashlib.sha256(b).hexdigest()
start=datetime.datetime.now(datetime.timezone.utc).isoformat(); manifest=json.loads((subject/'qa-manifest.json').read_text())
assert sha((subject/'qa-manifest.json').read_bytes())=='0de02be59be9e0905540e93cb4f59d16b590f52113602f56cc738af1718136e9'
assert sha((subject/'report.md').read_bytes())=='1e1b2c5e315db084956e90f2f7ce459b044135e7da44a464a69f0d67dc65c479'
def verify(rows, actual):
 assert len(rows)==len({r['path'] for r in rows}); assert set(actual)=={r['path'] for r in rows}
 for r in rows:
  b=actual[r['path']]; assert len(b)==r['bytes'] and sha(b)==r['sha256']
actual={str(p.relative_to(subject)):p.read_bytes() for p in subject.rglob('*') if p.is_file() and p!=subject/'qa-manifest.json'}
verify(manifest['files'],actual); assert len(actual)==17
for rel,b in actual.items():
 p=review/'preimages'/'subject'/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
 if rel.endswith('.py'):ast.parse(b)
(review/'preimages'/'subject'/'qa-manifest.json').write_bytes((subject/'qa-manifest.json').read_bytes())
sources=json.loads(actual['source-matrix.json'])['sources']; checks=[]; protected={}
for r in sources:
 b=(root/r['path']).read_bytes(); checks.append({**r,'currentSha256':sha(b),'matches':len(b)==r['bytes'] and sha(b)==r['sha256']}); protected[r['path']]=sha(b)
 p=review/'preimages'/'context'/r['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
assert all(r['matches'] for r in checks)
ids=json.loads(actual['initial14-identities.json'])['cases']; prep=json.loads((base/'task04-default-model-qualification-preparation/manifest.json').read_text()); expected=prep['expectedCalls']; keys=list(ids[0]);assert ids==[{k:c[k] for k in keys} for c in expected]
assert prep['executionOrder']==['C01','C02','C03','C04','C05','C06','C07','C08','E11','E12','E13','E14','C09','C10'];assert len(ids)==14 and len({c['normalizedNativeRequestHash'] for c in ids})==13
assert sum(c['candidateReservationKMicroUSD'] for c in ids)==314310
controls=[]
for label,rows,a in [('missing-row',manifest['files'][:-1],actual),('extra-file',manifest['files'],{**actual,'injected':b'x'}),('tampered-bytes',manifest['files'],{**actual,'proposal.md':actual['proposal.md']+b'x'}),('duplicate-row',manifest['files']+[manifest['files'][0]],actual)]:
 try:verify(rows,a)
 except AssertionError:controls.append({'case':label,'result':'EXPECTED_DENIAL'})
 else:raise AssertionError(label)
for p in subject.rglob('*'):
 if p.is_file():protected[str(p.relative_to(root))]=sha(p.read_bytes())
for extra in ['.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','node_modules/@ai-sdk/openai-compatible/src/embedding/openai-compatible-embedding-model.ts']:
 b=(root/extra).read_bytes();protected[extra]=sha(b);p=review/'preimages'/'context'/extra;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
(review/'protected-pre.json').write_text(json.dumps(protected,indent=2)+'\n')
result={'classification':'INDEPENDENT_DESIGN_INTEGRITY_ONLY','startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'subjectRows':len(actual),'sourceMatrixRows':len(sources),'uniqueSources':len({r['path'] for r in sources}),'sourceChecks':checks,'fixed14Match':True,'executionOrderMatch':True,'conditionalReservationTotal':314310,'adverseIntegrityControls':controls,'scriptSyntaxParsed':4,'applicationNativePaid':'NOT_RUN'}
(review/'input-verification.json').write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps({k:v for k,v in result.items() if k!='sourceChecks'}))
