from pathlib import Path
import json,hashlib,shutil,datetime
root=Path('/workspace/Project-Cortex');qa=root/'_goals/convex-backend-runtime-2026-10-02/qa';own=qa/'task04-default-experiment-guard-c2-review'
def meta(p):
 b=p.read_bytes();return {'path':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
protected=set();closures=[]
for name,field in [('task04-default-experiment-guard-implementation-c2','rows'),('task04-default-experiment-guard-implementation-c1','rows'),('task04-default-experiment-guard-c1-review','rows')]:
 base=qa/name;m=json.loads((base/'qa-manifest.json').read_text());rows=m.get(field,m.get('files',[]));actual={str(p.relative_to(base)) for p in base.rglob('*') if p.is_file() and p!=base/'qa-manifest.json'}
 checks=[]
 for r in rows:
  p=base/r['path'];x=meta(p);checks.append({**x,'match':x['bytes']==r['bytes'] and x['sha256']==r['sha256']});protected.add(p)
 protected.add(base/'qa-manifest.json');closures.append({'packet':name,'rows':len(rows),'allMatch':all(x['match'] for x in checks),'exactSet':actual=={r['path'] for r in rows},'manifest':meta(base/'qa-manifest.json'),'checks':checks})
 assert closures[-1]['allMatch'] and closures[-1]['exactSet']
prep=qa/'task04-default-model-qualification-preparation';historical=json.loads((prep/'source-evidence.json').read_text());refs=historical.get('sources',historical.get('files',[]));history=[]
for r in refs:
 p=root/r['path'];x=meta(p);history.append({**x,'historicalSha256':r['sha256'],'match':x['bytes']==r['bytes'] and x['sha256']==r['sha256']});protected.add(p)
subject=qa/'task04-default-experiment-guard-implementation-c2';current=[]
for r in json.loads((subject/'source-evidence.json').read_text())['files']:
 p=root/r['path'];x=meta(p);current.append({**x,'match':x['bytes']==r['bytes'] and x['sha256']==r['sha256']});protected.add(p)
for name in ['task04-default-model-qualification-preparation','task04-default-model-qualification-proposal-review']:
 for p in (qa/name).rglob('*'):
  if p.is_file():protected.add(p)
for rel in ['package.json','package-lock.json','tsconfig.json','tsconfig.lint.json','jest.config.mjs','eslint.config.js','.github/workflows/pr-checks.yml','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','_research/prompts/convex-backend-runtime-2026-10-02.md']:
 protected.add(root/rel)
pre=[meta(p) for p in sorted(protected)]
(own/'protected-pre.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':pre},indent=2)+'\n')
(own/'input-verification.json').write_text(json.dumps({'closures':closures,'current20':current,'historical201':history},indent=2)+'\n')
for p in protected:
 dest=own/'preimages'/p.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
for name,src in [('copy-c2',subject),('copy-c1',qa/'task04-default-experiment-guard-implementation-c1')]:
 dest=own/name
 for rel in ['fixture','initial14-manifest.json','eslint.config.mjs']:
  if (src/rel).is_dir():shutil.copytree(src/rel,dest/rel)
  else:(dest/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src/rel,dest/rel)
 (dest/'scripts').mkdir()
 for script in ['offline-check.mjs','hostile.mjs','refinement-check.mjs']:
  source=subject/'scripts'/script
  shutil.copyfile(source,dest/'scripts'/script)
print(json.dumps({'closures':[(x['packet'],x['rows'],x['allMatch'],x['exactSet']) for x in closures],'current':len(current),'currentMatch':all(x['match'] for x in current),'historical':len(history),'historicalMatch':sum(x['match'] for x in history),'protected':len(pre)}))
