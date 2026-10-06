from pathlib import Path
import json,hashlib,re,datetime
q=Path(__file__).resolve().parent;r=q.parents[3];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
product=sorted([p for root in ['src','convex-dev'] for p in (r/root).rglob('*') if p.is_file() and p.suffix in ['.ts','.js','.json']]);sourcePaths=[str(p.relative_to(r)) for p in product];extra=['package.json','package-lock.json','tsconfig.json','tsconfig.lint.json','jest.config.mjs','convex.json']
# Use the exact current configured root files that exist; no historical sources are reclassified.
source=sorted(set(product+[r/path for path in extra if (r/path).is_file()]+[r/path for path in json.loads((q/'source-pre.json').read_text())['files']]))
(q/'source-inventory.json').write_text(json.dumps({'state':'CURRENT_PRODUCT_SOURCE_FINGERPRINT','head':'1f5e6d16ee659e0896dd13df7d798abaf0c8fa63','productRootPaths':sourcePaths,'files':[{'path':str(p.relative_to(r)),'sha256':sha(p),'bytes':p.stat().st_size} for p in source]},indent=2)+'\n')
files=[]
for p in sorted(q.rglob('*')):
 if not p.is_file():continue
 rel=str(p.relative_to(q))
 if rel.startswith('tmp/') or rel in ['candidate-freeze.json','independent-preparation-review.json'] or re.match(r'^managed-fixture/fixture/convex/_generated/(api\.d\.ts|api\.js|dataModel\.d\.ts|server\.d\.ts|server\.js)$',rel):continue
 if p.is_symlink():raise RuntimeError('Candidate symlink rejected')
 files.append({'path':rel,'sha256':sha(p),'bytes':p.stat().st_size})
freeze={'state':'FROZEN_AWAITING_INDEPENDENT_PREPARATION_REVIEW','scope':'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION','historicalC11Acceptance':'Retained as immutable historical references, not current execution','currentProductRegistered':275,'public':200,'internal':75,'fixtureOnlyInternal':12,'expectedActualNativePublished':287,'actualExternalRequests':0,'actualDeployments':0,'officialCodegen':'NOT_RUN','liveQualification':'NOT_RUN','numericRepairCycleWaiver':'Cycle counts only; original criteria, independent review, bounded runtime, source and cleanup fences unchanged','mutableOfficialCodegenOnly':['managed-fixture/fixture/convex/_generated/'+name for name in ['api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js']],'files':files}
(q/'candidate-freeze.json').write_text(json.dumps(freeze,indent=2)+'\n');print(json.dumps({'candidateSha256':sha(q/'candidate-freeze.json'),'frozenFiles':len(files),'currentProductSourceFiles':len(source),'currentProductRootPaths':len(product),'actualDeployments':0}))
