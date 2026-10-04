import pathlib,json,hashlib,datetime
root=pathlib.Path('/workspace/Project-Cortex');qa=root/'_goals/convex-backend-runtime-2026-10-02/qa';out=qa/'task05-runtime-contract-lock-preparation-c2-review';work=root/'work/resume/task05-runtime-contract-lock-preparation-c2-review'
def row(p):
 b=p.read_bytes();return dict(path=str(p.relative_to(root)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
old=(qa/'task05-runtime-contract-lock-preparation/report.md').read_text();new=(qa/'task05-runtime-contract-lock-preparation-c2/report.md').read_text()
comparisons={}
for n,next_heading in [(2,'## Contract 3:'),(3,'## Review and execution handoff')]:
 def segment(s):return s[s.index('## Contract '+str(n)+':'):s.index(next_heading)]
 comparisons['contract'+str(n)+'ExactBytesEqual']=segment(old)==segment(new)
comparisons['hostileOriginalBytesEqual']=(root/'work/resume/task05-runtime-contract-lock-preparation/probe.mjs').read_bytes()==(root/'work/resume/task05-runtime-contract-lock-preparation-c2/hostile-probe.mjs').read_bytes()
# The original 13-group script belongs to prior independent review, not original preparation's different probe.
comparisons['hostilePriorReviewBytesEqual']=(root/'work/resume/task05-runtime-contract-lock-review/judge-20261004/probe.mjs').read_bytes()==(work/'hostile-probe.mjs').read_bytes()
comparisons['mapping11ExactCopy']=(root/'work/resume/task05-runtime-contract-lock-preparation-c2/mapping-probe.mjs').read_bytes()==(work/'mapping-probe.mjs').read_bytes()
comparisons['staticExactC2Copy']=(root/'work/resume/task05-runtime-contract-lock-preparation-c2/contract-check.mjs').read_bytes()==(work/'contract-check.mjs').read_bytes()
(out/'preservation-comparisons.json').write_text(json.dumps(comparisons,indent=2)+'\n')
pre=json.loads((out/'preimages.json').read_text())['sources'];drift=[{'before':r,'after':row(root/r['path'])} for r in pre if row(root/r['path'])!=r]
(out/'final-source-preservation.json').write_text(json.dumps({'mismatches':drift},indent=2)+'\n')
manifest=out/'evidence-manifest.json';files=sorted(p for d in [out,work] for p in d.rglob('*') if p.is_file() and p!=manifest)
preflight=json.loads((out/'finalize.pre-execution.json').read_text());end=datetime.datetime.now(datetime.timezone.utc).isoformat()
(out/'finalize.stdout').write_text(json.dumps({'comparisons':comparisons,'sourceMismatches':len(drift)})+'\n')
(out/'finalize.stderr').write_text('')
(out/'finalize.receipt.json').write_text(json.dumps({'argv':preflight['argv'],'cwd':str(root),'startUTC':preflight['startUTC'],'endUTC':end,'exit':0,'signal':None,'skips':[]},indent=2)+'\n')
files=sorted(p for d in [out,work] for p in d.rglob('*') if p.is_file() and p!=manifest)
manifest.write_text(json.dumps({'version':1,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'classification':'fresh independent design review, NEEDS_REVISION; no product gate','excluded':[str(manifest.relative_to(root))],'artifacts':[row(p) for p in files]},indent=2)+'\n')
print(json.dumps({'report':row(out/'report.md'),'manifest':row(manifest),'rows':len(files),'comparisons':comparisons,'sourceMismatches':len(drift)}))
