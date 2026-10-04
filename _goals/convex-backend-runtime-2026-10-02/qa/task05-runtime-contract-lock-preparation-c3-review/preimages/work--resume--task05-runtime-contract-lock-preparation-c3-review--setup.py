from pathlib import Path
import hashlib,json,datetime,subprocess,os
root=Path.cwd(); qa=root/'_goals/convex-backend-runtime-2026-10-02/qa'; out=qa/'task05-runtime-contract-lock-preparation-c3-review'; scratch=root/'work/resume/task05-runtime-contract-lock-preparation-c3-review'; c3=qa/'task05-runtime-contract-lock-preparation-c3'; src=root/'work/resume/task05-runtime-contract-lock-preparation-c3'
def digest(p):
 b=p.read_bytes();return {'path':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def save(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
verification=[]
for name in ['task05-runtime-contract-lock-preparation','task05-runtime-contract-lock-review','task05-runtime-contract-lock-preparation-c2','task05-runtime-contract-lock-preparation-c2-review','task05-runtime-contract-lock-preparation-c3']:
 p=qa/name/'evidence-manifest.json'; m=json.loads(p.read_text()); rows=m.get('artifacts',m.get('files',[])); errors=[]
 for row in rows:
  path=root/row['path']; actual=digest(path)
  if any(actual.get(k)!=row.get(k) for k in ['bytes','sha256']):errors.append({'expected':row,'actual':actual})
 verification.append({'manifest':digest(p),'report':digest(qa/name/'report.md'),'count':len(rows),'mismatches':errors})
save(out/'packet-verification.json',verification)
# Pin actual source seam reads to exact C3 preimages, without treating moving product as prior source.
for name in ['mapping-probe.mjs','hostile-probe.mjs','repaired-boundaries.mjs','c2-defect-counterexamples.mjs']:
 s=(src/name).read_text()
 for path in ['src/domain/model-policy.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeAuth.ts','node_modules/@convex-dev/agent/dist/component/messages.js']:
  frozen=c3/'preimages'/path.replace('/','--')
  if frozen.exists():s=s.replace("'"+path+"'","'"+str(frozen.relative_to(root))+"'")
 (scratch/name).write_text(s)
paths=[root/r['path'] for r in json.loads((c3/'preimages.json').read_text())['sources']]
paths += list(scratch.glob('*'))+[c3/'evidence-manifest.json']
(out/'preimages').mkdir(exist_ok=True)
rows=[]
for p in sorted(set(paths)):
 if p.is_file():
  rows.append(digest(p));(out/'preimages'/str(p.relative_to(root)).replace('/','--')).write_bytes(p.read_bytes())
save(out/'preimages.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':rows})
comparisons={}
a=(qa/'task05-runtime-contract-lock-preparation-c2/report.md').read_text();b=(c3/'report.md').read_text()
for n,end in [(2,'## Contract 3:'),(3,'## Review and execution handoff')]:
 start='## Contract '+str(n)+':'
 comparisons['contract'+str(n)+'ByteIdentical']=a[a.index(start):a.index(end)]==b[b.index(start):b.index(end)]
comparisons['hostile13ByteIdentical']=(src/'hostile-probe.mjs').read_bytes()==(root/'work/resume/task05-runtime-contract-lock-preparation-c2/hostile-probe.mjs').read_bytes()
a=(root/'work/resume/task05-runtime-contract-lock-preparation-c2/mapping-probe.mjs').read_text();b=(src/'mapping-probe.mjs').read_text();comparisons['mapping11AssertionTailIdentical']=a[a.index('const flat='):]==b[b.index('const flat='):]
save(out/'preservation-comparisons.json',comparisons)
print(json.dumps({'verified':[(v['count'],len(v['mismatches'])) for v in verification],'comparisons':comparisons}))
