from pathlib import Path
import json,hashlib,datetime,subprocess,sys
r=Path('/workspace/Project-Cortex');b=r/'_goals/convex-backend-runtime-2026-10-02/qa';s=b/'task04-model-drift-charge-only-implementation-c1';q=b/'task04-model-drift-charge-only-c1-product-review';w=r/'work/resume/task04-model-drift-charge-only-c1-product-review';node='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(n,x):(q/n).write_text(json.dumps(x,indent=2)+'\n')
def subject():
 f=json.loads((s/'manifest.json').read_text());paths={x['path'] for x in f['files']};actual={str(p.relative_to(s)) for p in s.rglob('*') if p.is_file() and p!=s/'manifest.json'};assert paths==actual
 for x in f['files']:assert (s/x['path']).stat().st_size==x['bytes'] and sha(s/x['path'])==x['sha256'],x['path']
 assert sha(s/'report.md')=='caeb1a90a1f274ab99e40e7174bbddc1a9ea3bac6ef0b98e345c6e09099064dc';assert sha(s/'manifest.json')=='56a2e096e78056311ef19068f762996536f2e6f06a0d20409df5612891407758'
 return {'verifiedRows':len(paths),'exactSet':True,'reportSHA256':sha(s/'report.md'),'manifestSHA256':sha(s/'manifest.json')}
def setup():
 save('subject-integrity-pre.json',subject());f=json.loads((s/'current-freeze.json').read_text());paths=[x['path'] for x in f['files'] if 'task04-model-drift-charge-only-implementation-c1' not in x['path']]
 paths.extend(str(p) for p in q.rglob('*') if p.is_file() and (p.suffix in ['.ts','.cjs','.mjs'] or p.name.startswith('jest.') or p.name=='freeze.json'))
 for x in f['files']:assert sha(x['path'])==x['sha256'],x['path']
 save('current-freeze.json',{'files':[{'path':p,'sha256':sha(p),'bytes':Path(p).stat().st_size} for p in sorted(set(paths))],'scope':'Own frozen current and guarded historical runners; unchanged source'});(q/'current-imports.ndjson').write_text('')
 save('source-pre.json',[{'path':x,'sha256':sha(x)} for x in paths]);
 for p in ['convex-dev/runtimeModelPolicy.ts','tests/unit/runtime/model-policy-model-drift.test.ts','convex-dev/runtimeGateway.ts','tests/unit/runtime/gateway-terminal-composition.test.ts','tests/unit/runtime/model-policy-admission.test.ts','convex-dev/schema.ts']:
  if (r/p).exists():dst=q/'source-preimages'/p;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes((r/p).read_bytes())
 save('historical-adaptations.json',{'originalRunner':str(s/'historical'),'ownRunner':str(q/'historical'),'onlyChanges':'Output/config/resolver/freeze path rebinding and corresponding exact hardpins; catalog and all78 assertions unchanged'})
 inspected=[]
 for p in sorted(s.rglob('*')):
  if p.is_file() and (p.suffix in ['.stdout','.stderr'] or p.name.endswith('receipt.json') or 'results' in p.name or 'source-pre' in p.name or 'source-post' in p.name or p.name in ['skips.json','final-integrity.json','current-import-verification.json']):
   content=p.read_bytes();inspected.append({'path':str(p),'bytes':len(content),'sha256':sha(p)})
 save('inspected-raw-evidence.json',inspected)
 for p in ['report.md','policy-changes.diff','skips.json','results-summary.json','native-profile-obligations.md']:(q/('subject-'+p)).write_bytes((s/p).read_bytes())
 old=b/'task04-gateway-terminal-composition-c1-review'
 for name in ['report.md','native-probe.stdout','native-probe.stderr','native-probe-results.json','native-probe-execution.json','initial-native-probe.stdout','initial-native-probe.stderr']:
  (q/('original-red-'+name)).write_bytes((old/name).read_bytes())
 print('frozen',len(paths),'subject13442 verified')
def verify():
 f=json.loads((q/'current-freeze.json').read_text());assert all(sha(x['path'])==x['sha256'] for x in f['files']);return len(f['files'])
def run(mode):
 env={'PATH':str(r/'work/resume/toolchain-bin')+':'+str(Path(node).parent)+':/usr/bin:/bin','TMPDIR':str(w),'NO_COLOR':'1'}
 if mode.startswith('historical'):argv=[node,str(q/'historical/run-historical.mjs'),'--list' if mode.endswith('list') else '--run']
 elif mode=='types':argv=[node,str(r/'node_modules/typescript/bin/tsc'),'--noEmit']
 elif mode=='lint':argv=[node,str(r/'node_modules/eslint/bin/eslint.js'),'convex-dev/runtimeModelPolicy.ts','tests/unit/runtime/model-policy-model-drift.test.ts','--report-unused-disable-directives']
 else:
  config='probe' if mode.startswith('probe') else 'native' if mode.startswith('native') else 'current';argv=[node,'--experimental-vm-modules',str(r/'node_modules/jest/bin/jest.js'),'--config',str(q/('jest.'+config+'.json')),'--runInBand','--no-cache'];argv+=['--listTests','--json'] if mode.endswith('list') else ['--json','--outputFile',str(q/(config+'-results.json'))]
 pre=verify();start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=r,env=env,capture_output=True,text=True,timeout=60);end=datetime.datetime.now(datetime.timezone.utc).isoformat();(q/(mode+'.stdout')).write_text(p.stdout);(q/(mode+'.stderr')).write_text(p.stderr);save(mode+'-receipt.json',{'argv':argv,'cwd':str(r),'environment':env,'startUTC':start,'endUTC':end,'exit':p.returncode,'preFiles':pre,'postFiles':verify()});print(mode,p.returncode,p.stderr[-2000:],flush=True)
if sys.argv[1]=='setup':setup()
elif sys.argv[1]=='final':save('subject-integrity-post.json',subject());save('source-post.json',{'allFrozenCurrentExact':True,'verifiedFiles':verify()})
else:run(sys.argv[1])
