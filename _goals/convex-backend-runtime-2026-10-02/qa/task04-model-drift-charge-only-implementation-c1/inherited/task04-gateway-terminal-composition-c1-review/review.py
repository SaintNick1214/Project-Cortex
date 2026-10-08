import pathlib,json,hashlib,subprocess,datetime,os
root=pathlib.Path('/workspace/Project-Cortex'); base=root/'_goals/convex-backend-runtime-2026-10-02/qa'; qa=base/'task04-gateway-terminal-composition-c1-review'; subject=base/'task04-gateway-terminal-composition-implementation-c1'; work=root/'work/resume/task04-gateway-terminal-composition-c1-review'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,v): (qa/n).write_text(json.dumps(v,indent=2)+'\n')
def manifests():
 out=[]
 for name in ['task04-gateway-terminal-composition-implementation-c1','task04-gateway-capture-composition-preparation-c2','task04-gateway-capture-composition-c2-design-review','task04-gateway-historical-catalog-preparation-c1','task04-gateway-historical-catalog-c1-review']:
  d=base/name;m=next(p for p in d.glob('*manifest.json') if p.name in ['manifest.json','qa-manifest.json']); j=json.loads(m.read_text()); rows=j.get('files',j.get('artifacts')); assert rows is not None
  real={str(p.relative_to(d)) for p in d.rglob('*') if p.is_file() and p!=m}; expected={r['path'] for r in rows};bad=[]
  for r in rows:
   p=d/r['path'];
   if not p.exists() or sha(p)!=r['sha256'] or ('bytes' in r and p.stat().st_size!=r['bytes']):bad.append(r['path'])
  out.append(dict(packet=name,manifest=m.name,sha256=sha(m),rows=len(rows),actual=len(real),missing=sorted(expected-real),extra=sorted(real-expected),bad=bad));assert real==expected and not bad
 return out
save('manifest-verification-pre.json',manifests())
sources=json.loads((subject/'final-source-freeze.json').read_text())['currentSource']; pre={p:sha(root/p) for p in sources};assert all(pre[p]==r['sha256'] for p,r in sources.items());save('subject-pre.json',pre)
for p in sources:
 dst=qa/'source-preimages'/p;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes((root/p).read_bytes())
# Copy current runner dependencies only; redirect every runner write to own scratch.
f=json.loads((subject/'current-freeze.json').read_text());f['files']=[r for r in f['files'] if r['path'] not in [str(root/'tsconfig.json'),str(root/'eslint.config.js'),str(root/'jest.config.mjs')]];f['work']=str(work/'current');pathlib.Path(f['work']).mkdir(exist_ok=True);save('current-freeze.json',f)
(qa/'current-resolver.cjs').write_bytes((subject/'current-resolver.cjs').read_bytes())
c=json.loads((subject/'jest.current.json').read_text());c['resolver']=str(qa/'current-resolver.cjs');save('jest.current.json',c)
# History uses unchanged catalog/immutable freeze, only copied resolver's output destination changes.
h=subject/'historical'; hc=json.loads((h/'jest.historical.json').read_text()); text=(h/'resolver.cjs').read_text();text=text.replace(str(root/'work/resume/task04-gateway-terminal-composition-implementation-c1/historical'),str(work/'historical'));(work/'historical').mkdir(exist_ok=True);(qa/'historical-resolver.cjs').write_text(text);hc['resolver']=str(qa/'historical-resolver.cjs');save('jest.historical.json',hc)
# Independently guard every installed official file and byte-exact local history before child startup.
hf=json.loads((h/'freeze.json').read_text());assert all(sha(h/r['catalog'])==r['sha256'] for r in hf['local']);assert all(sha(pathlib.Path(r['path']))==r['sha256'] for r in hf['official']);assert all(sha(pathlib.Path(r['path']))==r['sha256'] for r in f['files']);save('preimport-verified.json',dict(currentFiles=len(f['files']),historicalLocal=len(hf['local']),official=len(hf['official']),verified=True))
node='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node';env={'PATH':str(root/'work/resume/toolchain-bin')+':'+str(pathlib.Path(node).parent)+':/usr/bin:/bin','TMPDIR':str(work),'NO_COLOR':'1'}; executions=[]
def run(label,args,expected=0):
 argv=[node,*args]; start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=root,env=env,text=True,capture_output=True,timeout=60);end=datetime.datetime.now(datetime.timezone.utc).isoformat();(qa/(label+'.stdout')).write_text(p.stdout);(qa/(label+'.stderr')).write_text(p.stderr);executions.append(dict(label=label,argv=argv,cwd=str(root),environment=env,startUTC=start,endUTC=end,exit=p.returncode,expected=expected));save('executions.json',executions);assert p.returncode==expected,(label,p.returncode,p.stderr[-1500:]);return p
jest=['--experimental-vm-modules',str(root/'node_modules/jest/bin/jest.js')]
for label,conf in [('current','jest.current.json'),('historical','jest.historical.json')]:
 args=jest+['--config',str(qa/conf),'--runInBand','--no-cache'];p=run(label+'-list',args+['--listTests','--json']);assert sorted(json.loads(p.stdout))==sorted(json.loads((qa/conf).read_text())['testMatch']);run(label+'-run',args+['--json','--outputFile',str(qa/(label+'-results.json'))]);r=json.loads((qa/(label+'-results.json')).read_text());assert r['numPassedTests']==(160 if label=='current' else 78) and r['numPendingTests']==0 and r['numTodoTests']==0;save(label+'-summary.json',{k:r[k] for k in ['numPassedTests','numFailedTests','numPendingTests','numTodoTests','numTotalTestSuites','numRuntimeErrorTestSuites']})
save('subject-post.json',{p:sha(root/p) for p in sources});assert pre==json.loads((qa/'subject-post.json').read_text());save('manifest-verification-post.json',manifests())
