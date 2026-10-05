import hashlib,json,pathlib,datetime,subprocess
ROOT=pathlib.Path('/workspace/Project-Cortex')
GOAL=ROOT/'_goals/convex-backend-runtime-2026-10-02'
OUT=GOAL/'qa/task04-observer-stream-start-clarification-c1-review'
SUBJECT=GOAL/'qa/task04-default-native-driver-implementation-c1/observer-stream-start-clarification-c1'
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def info(p):
 b=p.read_bytes();return {'path':str(p.relative_to(ROOT)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def write(name,x): (OUT/name).write_text(json.dumps(x,indent=2)+'\n')
sources=[ROOT/p for p in ['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','_research/convex-ai-gateway-2026-10-02/decision-gates.md','_research/convex-ai-gateway-2026-10-02/architecture.md']]
sources += [GOAL/p for p in ['implementation-prompt.md','goal.md','tasks/01-qualification.md','tasks/04-model-policy.md','tasks/14-client-extensions.md']]
c4=GOAL/'qa/task04-default-native-driver-design-c4'
sources += [c4/p for p in ['proposal.md','contracts/observer-proofs.md','contracts/receipt-state.md','contracts/staging-trigger.md','contracts/replay-cleanup.md','contracts/hash-recovery.md','check-plan.md','initial14-identities.json']]
pins=json.loads((SUBJECT/'evidence/installed-source-pins.json').read_text())['sources']
sources += [ROOT/p['path'] for p in pins]
sources += sorted(p for p in SUBJECT.rglob('*') if p.is_file())
sources += [OUT/'checks/semantic.mjs',OUT/'checks/verify.py']
pre={'utc':utc(),'files':[info(p) for p in sources]};write('source-pre.json',pre)
failures=[];checks=[]
def require(name,condition):
 checks.append({'name':name,'passed':bool(condition)})
 if not condition: failures.append(name)
require('manifest expected sha',info(SUBJECT/'manifest.json')['sha256']=='c0f15491482234dc4e8c365152920e4aa9147469c979ab03bafb6d81fc829b51')
require('proposal expected sha',info(SUBJECT/'proposal.md')['sha256']=='b7d41108cc546ccfa0a1a1710b57d2c0b6f2f435fd67a21ae1b659fb4210c99a')
manifest=json.loads((SUBJECT/'manifest.json').read_text());listed={x['path']:x for x in manifest['files']}
actual={str(p.relative_to(SUBJECT)):p for p in SUBJECT.rglob('*') if p.is_file() and p!=SUBJECT/'manifest.json'}
require('recursive exact 10-file closure excludes only root self',set(listed)==set(actual) and len(actual)==10)
for name,p in actual.items():
 x=info(p);require('subject bytes+hash '+name,x['bytes']==listed[name]['bytes'] and x['sha256']==listed[name]['sha256'])
for pin in pins:
 x=info(ROOT/pin['path']);require('current installed source pin '+pin['path'],x['bytes']==pin['bytes'] and x['sha256']==pin['sha256'])
result=json.loads((SUBJECT/'evidence/adapter-01/stdout').read_text());expected=json.loads((c4/'initial14-identities.json').read_text())['cases'];by_id={c['scenarioId']:c for c in expected}
outcomes=result['outcomes'];require('retained fake-fetch14 only',result['total']==14 and result['actualFactoryExecuted'] is False and result['realNetwork']==result['serviceTokens']==result['paidCalls']==0)
require('retained original dispatch ORDER',[x['scenarioId'] for x in outcomes]==['C01','C02','C03','C04','C05','C06','C07','C08','E11','E12','E13','E14','C09','C10'])
for x in outcomes:require('retained expected wire '+x['scenarioId'],x['wireHash']==by_id[x['scenarioId']]['expectedWireBodyHash'] and x['calls']==1)
streams=[x for x in outcomes if by_id[x['scenarioId']]['method']=='stream'];require('six retained leading starts unsupported no eligibility',len(streams)==6 and all(x['kinds'][0]=='stream-start' and x['observerReason']=='unsupported' and x['eligibleParts']==0 for x in streams))
require('retained stderr empty',(SUBJECT/'evidence/adapter-01/stderr').read_bytes()==b'')
write('closure-verification.json',{'utc':utc(),'checks':checks,'failures':failures,'historicalLimit':'Retained adapter01 has source-pre only; no immediate historical source-post. Current package equality does not prove historical execution source stability. Mutable fixture dependencies are outside subject and NOT certified.'})
argv=['node',str(OUT/'checks/semantic.mjs')];start=utc();r=subprocess.run(argv,cwd=ROOT,capture_output=True)
(OUT/'semantic.stdout').write_bytes(r.stdout);(OUT/'semantic.stderr').write_bytes(r.stderr)
write('semantic-run.json',{'argv':argv,'cwd':str(ROOT),'startUTC':start,'endUTC':utc(),'exit':r.returncode,'classification':'DUMMY_DESIGN_ONLY','discovery':['checks/semantic.mjs'],'skips':['native','network','services','full implementation','full numeric byte/node/depth codec','paid','UI']})
if r.returncode:failures.append('semantic example execution')
post={'utc':utc(),'files':[info(p) for p in sources]};write('source-post.json',post)
require('fresh review source pre/post equal',pre['files']==post['files'])
write('verification.json',{'utc':utc(),'scope':'FROZEN_SUBJECT_DESIGN_ONLY','checks':checks,'failures':failures,'semanticExit':r.returncode,'subjectFiles':len(actual),'fullImplementationCertified':False})
print(json.dumps({'scope':'DESIGN_ONLY','checks':len(checks),'failures':failures,'semanticExit':r.returncode,'subjectFiles':len(actual)}))
raise SystemExit(1 if failures else 0)
