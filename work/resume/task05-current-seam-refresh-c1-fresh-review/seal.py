import pathlib,json,hashlib,datetime
R=pathlib.Path('/workspace/Project-Cortex');G='_goals/convex-backend-runtime-2026-10-02/';Q=R/G/'qa/task05-current-seam-refresh-c1-fresh-review';W=R/'work/resume/task05-current-seam-refresh-c1-fresh-review'
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def fp(p):
 b=p.read_bytes();return {'path':str(p.relative_to(R)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def write(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
before=json.loads((Q/'preimages.json').read_text())['artifacts']
current=[{**fp(R/x['path']),'beforeSHA256':x['sha256'],'equal':fp(R/x['path'])['sha256']==x['sha256']} for x in before]
assert all(x['equal'] for x in current)
write(Q/'seal-source-current.json',{'utc':utc(),'artifacts':current,'drift':[],'sealRunnerPreExecution':fp(W/'seal.py')})
wm=W/'work-manifest.json';qm=Q/'evidence-manifest.json'
work=[fp(p) for p in sorted(W.rglob('*')) if p.is_file() and p!=wm]
write(wm,{'utc':utc(),'classification':'FRESH_SOURCE_ONLY_JUDGMENT_WORK_SELF_EXCLUDING','excluded':[str(wm.relative_to(R))],'artifacts':work})
combined=[fp(p) for root in [Q,W] for p in sorted(root.rglob('*')) if p.is_file() and p!=qm]
write(qm,{'utc':utc(),'classification':'PASS_SOURCE_PREPARATION_ONLY_NO_TASK04_DEPENDENCY_OR_TASK05_RELEASE','excluded':[str(qm.relative_to(R))],'artifacts':combined})
for manifest,roots in [(wm,[W]),(qm,[Q,W])]:
 d=json.loads(manifest.read_text());actual={str(p.relative_to(R)) for root in roots for p in root.rglob('*') if p.is_file() and p!=manifest};listed={x['path'] for x in d['artifacts']};assert actual==listed
 for x in d['artifacts']:assert fp(R/x['path'])==x
 print(json.dumps({'manifest':fp(manifest),'verifiedRows':len(d['artifacts']),'exactClosure':True}))
print(json.dumps({'report':fp(Q/'report.md'),'verdict':'PASS_SOURCE_PREPARATION_ONLY','average':4.4,'held':'finalTask04/currentAcceptedAggregateRecheck/Task02/03-foundation'}))
