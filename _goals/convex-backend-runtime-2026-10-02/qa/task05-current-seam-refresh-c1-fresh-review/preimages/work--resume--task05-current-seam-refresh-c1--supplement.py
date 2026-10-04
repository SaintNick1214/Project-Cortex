import pathlib,json,hashlib,datetime,subprocess,os,re
R=pathlib.Path('/workspace/Project-Cortex');G='_goals/convex-backend-runtime-2026-10-02/';Q=R/G/'qa/task05-current-seam-refresh-c1';W=R/'work/resume/task05-current-seam-refresh-c1'
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def fp(p):
 b=p.read_bytes();return {'path':str(p.relative_to(R)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def write(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
extra=['node_modules/@convex-dev/agent/src/vercel/mapping.ts','node_modules/@convex-dev/agent/src/vercel/UIMessages.ts','node_modules/@convex-dev/agent/src/validators.ts','node_modules/@convex-dev/agent/src/component/schema.ts','node_modules/@convex-dev/agent/dist/vercel/mapping.js','node_modules/@convex-dev/agent/dist/vercel/UIMessages.js','node_modules/@convex-dev/agent/dist/validators.js','node_modules/@convex-dev/agent/dist/component/schema.js','convex-dev/_generated/server.ts','convex-dev/_generated/dataModel.d.ts','convex-dev/_generated/api.d.ts','convex-dev/tsconfig.json']
rows=[];missing=[]
for s in extra:
 p=R/s
 if not p.is_file():missing.append(s);continue
 dest=Q/'preimages'/s.replace('/','--');dest.write_bytes(p.read_bytes());rows.append({**fp(p),'archive':str(dest.relative_to(R)),'capturedUTC':utc()})
write(Q/'supplement-preimages.json',{'utc':utc(),'artifacts':rows,'missing':missing})
old=R/'work/resume/task05-runtime-contract-lock-preparation-c3-review/fresh-probes.mjs';new=W/'fresh-probes.mjs'
text=old.read_text();updated=text.replace(G+'qa/task05-runtime-contract-lock-preparation-c3/preimages/src--domain--model-policy.ts',G+'qa/task05-current-seam-refresh-c1/preimages/src--domain--model-policy.ts');new.write_text(updated)
assert text[text.index('const flat='):]==updated[updated.index('const flat='):]
write(Q/'fresh21-preservation.json',{'original':fp(old),'copy':fp(new),'assertionTailByteIdentical':True,'onlyChange':'literal current archived source path'})
pre=json.loads((Q/'preimages.json').read_text())['artifacts'];inputs=[R/x['path'] for x in pre+rows]+list(W.glob('*.mjs'))+[W/'supplement.py']
for name in ['fresh-probes','seam-controls']:
 argv=['node',str((W/(name+'.mjs')).relative_to(R))];write(Q/(name+'.pre-execution.json'),{'utc':utc(),'argv':argv,'cwd':str(R),'fingerprints':[fp(p) for p in sorted(set(inputs))]});start=utc()
 p=subprocess.run(argv,cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={**os.environ,'PATH':str(R/'work/resume/toolchain-bin')+':'+os.environ['PATH']})
 (Q/(name+'.stdout')).write_bytes(p.stdout);(Q/(name+'.stderr')).write_bytes(p.stderr)
 write(Q/(name+'.receipt.json'),{'argv':argv,'cwd':str(R),'startUTC':start,'endUTC':utc(),'exitCode':p.returncode,'signal':None,'groups':len(re.findall(rb'^PASS ',p.stdout,re.M)),'skips':[],'classification':'OFFLINE_REFERENCE_OUTCOMES' if name=='fresh-probes' else 'SOURCE_STATIC_CONTROLS_ONLY'})
 print(name,p.returncode,len(re.findall(rb'^PASS ',p.stdout,re.M)))
post=[{**fp(R/x['path']),'beforeSHA256':x['sha256'],'equal':fp(R/x['path'])['sha256']==x['sha256']} for x in pre+rows]
write(Q/'final-source-postimages.json',{'utc':utc(),'artifacts':post,'drift':[x['path'] for x in post if not x['equal']]})
summary=json.loads((Q/'numerical-summary.json').read_text());summary.update({'utc':utc(),'supplementSourceFiles':len(rows),'capturedTotalBeforeBackingFiles':len(pre)+len(rows),'offlineBehavioralGroups':57,'staticSourceGroups':14,'receiptCount':7,'sourceDriftCount':sum(not x['equal'] for x in post),'supplementMissing':missing});summary.pop('offlineGroups');write(Q/'numerical-summary.json',summary)
