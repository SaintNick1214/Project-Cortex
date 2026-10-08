import pathlib,json,hashlib,datetime
R=pathlib.Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task05-current-seam-refresh-c1';W=R/'work/resume/task05-current-seam-refresh-c1'
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def row(p):
 b=p.read_bytes();return {'path':str(p.relative_to(R)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def write(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
# Contemporary last source comparison, no rewrite of earlier raw receipts.
initial=json.loads((Q/'preimages.json').read_text())['artifacts'];supp=json.loads((Q/'supplement-preimages.json').read_text())['artifacts']
last=[{**row(R/x['path']),'beforeSHA256':x['sha256'],'equal':row(R/x['path'])['sha256']==x['sha256']} for x in initial+supp]
write(Q/'seal-source-current.json',{'utc':utc(),'artifacts':last,'drift':[x['path'] for x in last if not x['equal']],'qualification':'source-only currentness; NOT release recheck after final Task04 PASS'})
receiptRows=[]
for p in sorted(Q.glob('*.receipt.json')):
 data=json.loads(p.read_text());receiptRows.append({'path':str(p.relative_to(R)),'exitCode':data['exitCode'],'groups':data.get('groups',data.get('assertedOutcomeGroups',0))})
assert len(receiptRows)==7 and all(x['exitCode']==0 for x in receiptRows)
assert all(x['equal'] for x in last)
verify=json.loads((Q/'historical-manifest-verification.json').read_text());assert sum(x['verifiedRows'] for x in verify)==728 and not any(x['mismatches'] for x in verify)
write(Q/'seal-verification.json',{'utc':utc(),'receiptRows':receiptRows,'sourceBackingRows':len(last),'sourceDrift':0,'historicalRows':728,'historicalMismatches':0,'classification':'INTERNAL_PACKET_VERIFICATION_ONLY_NOT_INDEPENDENT_REVIEW','bootstrapStandaloneRawReceipt':'NOT_CAPTURED'})
wm=W/'work-manifest.json';write(wm,{'utc':utc(),'excluded':[str(wm.relative_to(R))],'artifacts':[row(p) for p in sorted(W.rglob('*')) if p.is_file() and p!=wm]})
qm=Q/'evidence-manifest.json';paths=[p for root in [Q,W] for p in root.rglob('*') if p.is_file() and p!=qm]
write(qm,{'utc':utc(),'classification':'SOURCE_ONLY_CURRENT_SEAM_REFRESH_PREPARATION; NO_TASK_GATE_SATISFACTION','excluded':[str(qm.relative_to(R))],'artifacts':[row(p) for p in sorted(paths)]})
for p in [wm,qm]:
 data=json.loads(p.read_text());assert all(row(R/x['path'])==x for x in data['artifacts']);print(json.dumps({'manifest':row(p),'verifiedRows':len(data['artifacts'])}))
