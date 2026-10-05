import pathlib,json,hashlib,os,datetime,shutil
root=pathlib.Path('/workspace/Project-Cortex');qa=root/'_goals/convex-backend-runtime-2026-10-02/qa';old=qa/'task04-current-catalog-composition-c1';base=qa/'task04-current-catalog-composition-c2';start=datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
lineage=[]
for label,folder,count in [('C1-subject',old,1424),('C1-fresh-review',qa/'task04-current-catalog-composition-c1-review',2177)]:
 m=folder/'qa-manifest.json';data=json.loads(m.read_text());assert len(data['rows'])==count
 actual={str(p.relative_to(folder)) for p in folder.rglob('*') if p!=m and (p.is_file() or p.is_symlink())};assert actual=={r['path'] for r in data['rows']}
 for row in data['rows']:
  p=folder/row['path'];raw=os.readlink(p).encode() if p.is_symlink() else p.read_bytes();assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']
 assert sha(old/'report.md')=='43a83afb03deac11402a3b392a2d9af1767056ec7ea3613173df8f6f96e55df6'
 if label.endswith('review'):assert sha(folder/'report.md')=='4d10de240cd631cb5083408820492fd650871d6eccd933f3c52cbe35476d0d8b'
 lineage.append({'label':label,'absolutePublicFolder':str(folder),'reportSHA256':sha(folder/'report.md'),'manifestSHA256':sha(m),'rows':count,'regularFiles':sum(not(folder/r['path']).is_symlink() for r in data['rows']),'literalSymlinks':sum((folder/r['path']).is_symlink() for r in data['rows']),'closure':'ALL exact bytes/literal links verified; external dependency links never traversed'})
 target=base/'lineage'/label;target.mkdir(parents=True);shutil.copyfile(m,target/'qa-manifest.json');shutil.copyfile(folder/'report.md',target/'report.md')
files=['current-compose.mjs','native-probe.mts','offline-guard.mjs','adverse.mjs','approved-additions.json','source-pre.json','original-tests.json','original-four-failures.json','package.json','tsconfig.json','eslint.config.mjs','jest.config.mjs','setup.mjs','proposed-four-file-minimal.patch','copy-map.json','check-history.json','exploration-gap.json','checks/make-copies.py','checks/run.py']
for name in files:
 target=base/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(old/name,target)
shutil.copytree(old/'preimages',base/'preimages');shutil.copytree(old/'copies',base/'copies')
(base/'lineage.json').write_text(json.dumps({'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'externalImmutableClosureBinding':lineage,'earlier454and30':'bound complete C1 subject and full fresh review; no copied/reconstructed observation relabeled new','NOT_REPRODUCED':'Review JS-sibling import attempt did not execute; do not invent an executed exploit'},indent=2)+'\n')
print(json.dumps({'lineage':lineage,'sources':len(json.loads((base/'source-pre.json').read_text())['sources']),'utc':start}))
