from pathlib import Path
import json,hashlib,shutil
r=Path.cwd();q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-terminal-composition-implementation-c1';w=r/'work/resume/task04-gateway-terminal-composition-implementation-c1';h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
context=[Path('AGENTS.md'),Path('.agents/CODEX-RUNTIME.md'),Path('.agents/PROJECT-PROFILE.md'),Path('.agents/roles/implementation-executor.md'),Path('.agents/skills/feature-orchestrator/SKILL.md'),Path('_goals/convex-backend-runtime-2026-10-02/implementation-prompt.md'),Path('_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md'),Path('_research/convex-ai-gateway-2026-10-02/decision-gates.md'),Path('_research/convex-ai-gateway-2026-10-02/architecture.md'),Path('src/domain/sources.ts'),Path('src/auth/verified.ts'),Path('convex-dev/runtimeModelPolicyBootstrap.ts'),Path('package.json'),Path('package-lock.json'),Path('tsconfig.json'),Path('tsconfig.lint.json'),Path('eslint.config.js')]
base=Path('_goals/convex-backend-runtime-2026-10-02/qa')
for packet in ['task04-gateway-capture-composition-preparation-c2','task04-gateway-capture-composition-c2-design-review','task04-gateway-historical-catalog-preparation-c1','task04-gateway-historical-catalog-c1-review','task04-terminal-capture-preparation-c2','task04-terminal-capture-proposal-c2-review']:
 context.append(base/packet/'report.md')
for p in ['task04-gateway-capture-composition-c2-coordinator-acceptance.json','task04-gateway-historical-catalog-c1-coordinator-acceptance.json','task04-terminal-capture-native-c4-coordinator-acceptance.json']:context.append(base/p)
for p in context:dest=q/'context-preimages'/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(r/p,dest)
for p in w.glob('*.py'):dest=q/'scripts'/p.name;dest.parent.mkdir(exist_ok=True);shutil.copyfile(p,dest)
for name in ['runtimeGateway.ts']:(q/'final-source-preimages').mkdir(exist_ok=True);shutil.copyfile(r/'convex-dev'/name,q/'final-source-preimages'/name)
shutil.copyfile(r/'tests/unit/runtime/gateway-terminal-composition.test.ts',q/'final-source-preimages/gateway-terminal-composition.test.ts')
f=json.loads((q/'current-freeze.json').read_text());f['expectedCurrentOutcomes']=160
for p in [r/'tsconfig.json',r/'tsconfig.lint.json',r/'eslint.config.js',q/'tsconfig.affected.json']:
 if not any(x['path']==str(p) for x in f['files']):f['files'].append({'path':str(p),'sha256':h(p)})
(q/'current-freeze.json').write_text(json.dumps(f,indent=2)+'\n')
result=json.loads((q/'current-results.json').read_text());assert result['numPassedTests']==160 and result['numTotalTests']==160 and result['numPendingTests']==0 and result['numTodoTests']==0
hist=json.loads((q/'historical/historical-results.json').read_text());assert hist['numPassedTests']==78
sourcefreeze={p:{'sha256':h(r/p),'bytes':(r/p).stat().st_size} for p in ['convex-dev/runtimeGateway.ts','tests/unit/runtime/gateway-terminal-composition.test.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimePolicySchema.ts','tests/unit/runtime/model-policy-admission.test.ts','tests/unit/runtime/gateway-dispatch.test.ts']}
(q/'final-source-freeze.json').write_text(json.dumps({'currentSource':sourcefreeze,'currentCount':160,'historicalCount':78,'current35SourceBoundaryScenarios':35,'noNativeOrPaidQualification':True},indent=2)+'\n')
(q/'boundary-coverage.json').write_text(json.dumps({'original35':json.loads((r/base/'task04-gateway-capture-composition-preparation-c2/boundary-results.json').read_text())['results'],'current35':next(x for x in result['testResults'])['assertionResults'][74:109],'caveat':'Source scenario8 now tests real Gateway trusted attachment forwarding; native repository read qualification remains separate accepted owner evidence.'},indent=2)+'\n')
# Complete latest closure/inventory fingerprints; official exact bytes retained once under historical.
allfiles={Path(x['path']):x['sha256'] for x in f['files']}
assert all(h(p)==v for p,v in allfiles.items())
(q/'final-closure-verification.json').write_text(json.dumps({'verifiedFiles':len(allfiles),'allMatch':True,'currentProductSHA256':h(r/'convex-dev/runtimeGateway.ts'),'officialBytePreimages':'historical/official-preimages; physical package-specific hash closure in current-freeze.json','currentImportedProduct':any(x['resolved']==str(r/'convex-dev/runtimeGateway.ts') for x in json.loads((q/'current-imports.json').read_text()))},indent=2)+'\n')
