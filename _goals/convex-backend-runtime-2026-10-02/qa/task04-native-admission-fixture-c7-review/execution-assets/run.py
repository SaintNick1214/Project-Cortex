from pathlib import Path
import json,hashlib,datetime,subprocess,re,difflib,shutil
R=Path('/workspace/Project-Cortex'); B=R/'_goals/convex-backend-runtime-2026-10-02/qa'; C=B/'task04-native-admission-fixture-c7'; W=Path(__file__).parent; Q=B/'task04-native-admission-fixture-c7-review'
Q.mkdir(mode=0o700,exist_ok=False);(W/'scripts').mkdir();(W/'sources').mkdir();
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,x): (Q/n).write_text(json.dumps(x,indent=2)+'\n')
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def verify(packet,name):
 j=json.loads((packet/name).read_text());rows=j['files'];bad=[]
 for row in rows:
  p=packet/row['path']
  if not p.is_file() or h(p)!=row['sha256'] or p.stat().st_size!=row['bytes']:bad.append(row['path'])
 return {'name':str(packet/name),'hash':h(packet/name),'rows':len(rows),'mismatches':bad}
ver=[verify(C,'qa-manifest.json'),verify(C,'runtime-freeze.json')];freeze=json.loads((C/'runtime-freeze.json').read_text());op=sorted(str(p.relative_to(C)) for d in ['scripts','fixture'] for p in (C/d).rglob('*') if p.is_file());op+=['project-request.json','cases.json','source-inventory.json','registration-inventory.json','schema-evidence.json','profile.json'];op.sort()
inv=json.loads((C/'source-inventory.json').read_text());unequal=[];sourcebad=[]
for row in inv['files']:
 p=R/row['source'];copy=C/row['copy']
 if h(p)!=row['sha256']:sourcebad.append(row['source'])
 if p.read_bytes()!=copy.read_bytes():unequal.append(row['source'])
acceptedbad=[r['path'] for r in inv['acceptedGateHashes'] if h(R/r['path'])!=r['sha256']]
actual=sorted(str(p.relative_to(C)) for p in C.rglob('*') if p.is_file() and p.name!='qa-manifest.json');listed=sorted(r['path'] for r in json.loads((C/'qa-manifest.json').read_text())['files'])
save('integrity-before.json',{'utc':utc(),'verification':ver,'operationalCount':len(op),'operationalExact':op==freeze['operationalPaths'],'manifestInventoryExact':actual==listed,'sourceCount':len(inv['files']),'sourceMismatches':sourcebad,'unequal':unequal,'acceptedCount':len(inv['acceptedGateHashes']),'acceptedMismatches':acceptedbad,'reportSHA256':h(C/'report.md'),'native':'NOT_RUN'})
protected={str(p.relative_to(R)):h(p) for p in [C/r['path'] for r in json.loads((C/'qa-manifest.json').read_text())['files']]+[C/'qa-manifest.json']+[R/r['source'] for r in inv['files']]+[R/r['path'] for r in inv['acceptedGateHashes']]}
save('protected-before.json',protected)
for name in ['task04-native-admission-fixture-c6','task04-native-admission-fixture-c6-review','task04-native-admission-c6-execution','task04-native-admission-c6-execution-supplement','task04-native-error-boundary-repair','task04-native-error-boundary-repair-review']:
 packet=B/name
 rows={str(p.relative_to(packet)):h(p) for p in packet.rglob('*') if p.is_file()};save(name+'-hashes.json',rows)
# Execution copies preserve assertions; only explicit module paths, source roots and allowed scratch location are relocated.
rel=str(W.relative_to(R))
for p in (C/'scripts').glob('*.mjs'):
 text=p.read_text();original=text
 if p.name=='guard.mjs':text=text.replace("root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(root,'../../../..'),fixture=resolve(root,'fixture')",f"root={json.dumps(str(C))},repo={json.dumps(str(R))},fixture=resolve(root,'fixture')")
 text=text.replace('work/resume/task04-native-admission-fixture-c7/',rel+'/')
 text=text.replace('work/backend-runtime/task04-native-admission-c7',rel+'/native-not-run')
 text=text.replace("'../../../../../node_modules/convex/dist/esm/server/impl/registration_impl.js'",json.dumps(str(R/'node_modules/convex/dist/esm/server/impl/registration_impl.js')))
 text=text.replace("'../../task04-native-admission-fixture-c4/scripts/guard.mjs'",json.dumps(str(B/'task04-native-admission-fixture-c4/scripts/guard.mjs')))
 (W/'scripts'/p.name).write_text(text);(W/'sources'/p.name).write_text(original)
 (Q/(p.name+'.relocation.diff')).write_text(''.join(difflib.unified_diff(original.splitlines(True),text.splitlines(True),fromfile=str(p),tofile=str(W/'scripts'/p.name))))
checks=[];env={'PATH':'/workspace/Project-Cortex/work/resume/toolchain-bin:/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8'}
def snap():return {str(p.relative_to(R)):h(p) for p in (W/'scripts').glob('*.mjs')}
def run(name,args):
 pre=snap();start=utc();res=subprocess.run(args,cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=150)
 (Q/(name+'.stdout')).write_bytes(res.stdout);(Q/(name+'.stderr')).write_bytes(res.stderr)
 row={'name':name,'argv':args,'cwd':str(R),'utcStart':start,'utcEnd':utc(),'exitCode':res.returncode,'sourceConfigBefore':pre,'sourceConfigAfter':snap(),'stdoutSHA256':h(Q/(name+'.stdout')),'stderrSHA256':h(Q/(name+'.stderr'))};save(name+'.receipt.json',row);checks.append(row);print(name,res.returncode,res.stdout[-450:].decode(errors='replace'),res.stderr[-350:].decode(errors='replace'),flush=True)
run('node',['node','--version']);run('npm',['npm','--version'])
files=sorted((W/'scripts').glob('offline*.mjs'));save('discovery.json',{'files':[str(p) for p in files],'expectedUniqueTests':42,'requiredNative':'NOT_RUN','services':0})
run('offline01',['node','--experimental-vm-modules','--test','--test-concurrency=1',*[str(p) for p in files]])
save('checks.json',checks);save('protected-after.json',{p:h(R/p) for p in protected});save('preservation.json',{'mismatches':[p for p in protected if h(R/p)!=protected[p]],'native':'NOT_RUN'})
