import pathlib,hashlib,json,datetime,os
b=pathlib.Path(__file__).resolve().parent.parent;manifest=b/'qa-manifest.json'
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
state=json.loads((b/'resume.json').read_text());state['reportSHA256']=h(b/'report.md');(b/'resume.json').write_text(json.dumps(state,indent=2)+'\n');(b.parents[3]/'work/resume/task04-current-catalog-composition-c1/state.json').write_text(json.dumps(state,indent=2)+'\n')
rows=[]
for p in sorted(b.rglob('*')):
 if p==manifest:continue
 if p.is_symlink():
  target=os.readlink(p);rows.append({'path':str(p.relative_to(b)),'kind':'symlink','target':target,'bytes':len(target.encode()),'sha256':hashlib.sha256(target.encode()).hexdigest()})
 elif p.is_file():rows.append({'path':str(p.relative_to(b)),'kind':'file','bytes':p.stat().st_size,'sha256':h(p)})
manifest.write_text(json.dumps({'version':1,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'classification':'NEW_CURRENT_OFFLINE_COMPOSITION_SOURCE_SERIALIZED_HOLD_REVIEW_PENDING','excludesOnly':'qa-manifest.json','symlinks':'record target bytes; do not traverse external installed dependencies','rows':rows},indent=2)+'\n')
actual={str(p.relative_to(b)) for p in b.rglob('*') if p!=manifest and (p.is_file() or p.is_symlink())};assert actual=={r['path'] for r in rows}
for r in rows:
 p=b/r['path']
 if r['kind']=='file':assert p.stat().st_size==r['bytes'] and h(p)==r['sha256']
 else:assert os.readlink(p)==r['target'] and hashlib.sha256(os.readlink(p).encode()).hexdigest()==r['sha256']
print(json.dumps({'files':sum(r['kind']=='file' for r in rows),'symlinks':sum(r['kind']=='symlink' for r in rows),'closure':len(rows),'reportSHA256':h(b/'report.md'),'manifestSHA256':h(manifest),'tests':454,'adverse':30,'native':'NOT_RUN','paid':'NOT_RUN','actualRootSplice':'HOLD'}))
