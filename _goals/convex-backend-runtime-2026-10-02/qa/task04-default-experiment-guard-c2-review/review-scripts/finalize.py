from pathlib import Path
import json,hashlib,datetime,shutil
root=Path('/workspace/Project-Cortex');qa=root/'_goals/convex-backend-runtime-2026-10-02/qa';own=qa/'task04-default-experiment-guard-c2-review';subject=qa/'task04-default-experiment-guard-implementation-c2';c1=qa/'task04-default-experiment-guard-implementation-c1';review=qa/'task04-default-experiment-guard-c1-review'
def hash(p):return hashlib.sha256(p.read_bytes()).hexdigest()
pre=json.loads((own/'protected-pre.json').read_text());post=[]
for r in pre['rows']:
 p=root/r['path'];b=p.read_bytes();post.append({**r,'currentBytes':len(b),'currentSha256':hash(p),'unchanged':len(b)==r['bytes'] and hash(p)==r['sha256']})
(own/'protected-post.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':post,'changes':[r for r in post if not r['unchanged']]},indent=2)+'\n')
identity=[]
for rel in ['fixture/convex/canonical.ts','fixture/convex/compiled.ts','fixture/convex/runner.ts','fixture/convex/schema.ts','fixture/package.json','fixture/tsconfig.json','initial14-manifest.json','scripts/offline-check.mjs']:
 identity.append({'path':rel,'c1Sha256':hash(c1/rel),'c2Sha256':hash(subject/rel),'identical':hash(c1/rel)==hash(subject/rel)})
hostileCandidates=list((review/'preimages').rglob('hostile.mjs'))
if not hostileCandidates:hostileCandidates=[p for p in review.rglob('*') if p.is_file() and p.name.endswith('hostile.mjs')]
identity.append({'path':'scripts/hostile.mjs','c2Sha256':hash(subject/'scripts/hostile.mjs'),'frozenC1ReviewMatches':[str(p.relative_to(root)) for p in hostileCandidates if hash(p)==hash(subject/'scripts/hostile.mjs')]})
(own/'copy-identity.json').write_text(json.dumps(identity,indent=2)+'\n')
assert all(r['identical'] for r in identity[:-1]);assert identity[-1]['frozenC1ReviewMatches']
discovery=[]
for name in ['baseline23','hostile6-c2','refinement4','independent5','hostile6-c1-red']:
 d=json.loads((own/'raw'/f'{name}.stdout').read_text());out=d.get('testsDetail',d.get('outcomes'));discovery.append({'name':name,'discovered':len(out),'executed':len(out),'skipped':d.get('skipped',0),'outcomes':out})
(own/'test-discovery.json').write_text(json.dumps(discovery,indent=2)+'\n')
(own/'skips.json').write_text(json.dumps({'selectedSkipped':0,'notRun':['native official Convex OCC/publication/codegen','Gateway/product integration','actual target/nonpaid driver proof','paid provider serving/currency/category/full charges','actual managed1536 write/search','Task04/full03/text/UI/fullcore/all17/goal'],'reason':'Bounded offline experiment-control review only; subsequent separately accepted Gateway/capture/driver/target proofs required.'},indent=2)+'\n')
pins=[]
for name in ['convex','typescript','eslint','@eslint/js','@typescript-eslint/parser','@typescript-eslint/eslint-plugin','globals']:
 p=root/'node_modules'/name/'package.json';pins.append({'name':name,'installed':json.loads(p.read_text())['version'],'sha256':hash(p)})
(own/'installed-pins.json').write_text(json.dumps({'node':'24.19.0','npm':'12.2.0','toolchainBinFirst':True,'nodeExecutable':'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node','install':'NOT_RUN','pins':pins},indent=2)+'\n')
(own/'source-config-discovery.json').write_text(json.dumps({'inspected':['AGENTS/.agents runtime/profile/pessimistic-judge/judge-task/feature-orchestrator','approved Task04/09/14/prompt/decisions/architecture','complete prep report/manifest/source-evidence + fresh designreview','complete C1/C1 review/C2 packets','fixture five sources/package/tsconfig/initial14/scopedeslint/baseline23/hostile6/refinement4','subject verifier/finalizer scripts static only','root package/lock/CI/config read-only'],'executedSources':'only own copies; five source files byte exact; check scripts byte exact except independently authored additional script','productGatewayImported':False,'servicesNetworkEnvPrivatePaidNativeGitInvoked':False,'writeRoots':[str(own),str(root/'work/resume/task04-default-experiment-guard-c2-review')]},indent=2)+'\n')
for p in (root/'work/resume/task04-default-experiment-guard-c2-review').glob('*.py'):
 dest=own/'review-scripts'/p.name;dest.parent.mkdir(exist_ok=True);shutil.copyfile(p,dest)
print(json.dumps({'protected':len(post),'changes':[r['path'] for r in post if not r['unchanged']],'baselineIdentity':all(r['identical'] for r in identity[:-1]),'hostileIdentity':len(identity[-1]['frozenC1ReviewMatches']),'outcomes':[(x['name'],x['executed']) for x in discovery]}))
