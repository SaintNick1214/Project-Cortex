from pathlib import Path
import hashlib,json,datetime,sys,subprocess
root=Path('/workspace/Project-Cortex')
qa=root/'_goals/convex-backend-runtime-2026-10-02/qa'
out=qa/'task04-model-drift-charge-only-c1-design-review'
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def row(p):
 b=p.read_bytes();return {'path':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
inputs=['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','.agents/skills/feature-orchestrator/SKILL.md','_goals/convex-backend-runtime-2026-10-02/implementation-prompt.md','_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md','_research/convex-ai-gateway-2026-10-02/decision-gates.md','_research/convex-ai-gateway-2026-10-02/architecture.md','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeModelPolicyBootstrap.ts','convex-dev/runtimePolicySchema.ts','convex-dev/runtimeGateway.ts','src/domain/model-policy.ts','tests/unit/runtime/model-policy-admission.test.ts','tests/unit/runtime/gateway-terminal-composition.test.ts']
packets=['task04-model-drift-charge-only-repair-preparation-c1','task04-gateway-terminal-composition-c1-review','task04-gateway-capture-composition-preparation-c2','task04-gateway-capture-composition-c2-design-review']
for name in packets:
 inputs += [str((qa/name/f).relative_to(root)) for f in ['report.md' if name!='task04-model-drift-charge-only-repair-preparation-c1' else 'proposal.md','manifest.json']]
inputs+= [str((qa/'task04-model-drift-charge-only-repair-preparation-c1/source-evidence.json').relative_to(root)),str((qa/'task04-terminal-capture-native-c4-coordinator-acceptance.json').relative_to(root))]
start=utc();pre=[row(root/p) for p in inputs];(out/'source-pre.json').write_text(json.dumps(pre,indent=2)+'\n')
checks=[]
for name in packets:
 base=qa/name;m=json.loads((base/'manifest.json').read_text());listed=m['files'];paths={r['path'] for r in listed}
 actual={str(p.relative_to(base)) for p in base.rglob('*') if p.is_file() and p!=base/'manifest.json'}
 bad=[]
 for r in listed:
  p=base/r['path'];b=p.read_bytes()
  if len(b)!=r['bytes'] or hashlib.sha256(b).hexdigest()!=r['sha256']:bad.append(r['path'])
 checks.append({'packet':name,'rows':len(listed),'missing':sorted(paths-actual),'extra':sorted(actual-paths),'mismatches':bad,'manifestSHA256':row(base/'manifest.json')['sha256']})
 assert len(paths)==len(listed) and paths==actual and not bad
money=json.loads((qa/'task04-model-drift-charge-only-repair-preparation-c1/source-evidence.json').read_text())
for r in money['sources']:
 actual=row(root/r['path']);assert actual['sha256']==r['sha256'] and actual['bytes']==r['bytes']
s=(root/'convex-dev/runtimeModelPolicy.ts').read_text();boot=(root/'convex-dev/runtimeModelPolicyBootstrap.ts').read_text();schema=(root/'convex-dev/runtimePolicySchema.ts').read_text()
controls={'capture_rejects_drift_before_known_cost':s.index('receipt.actualModel !== snapshot.modelId',s.index('export const captureTerminalEvidence'))<s.index('const cost = knownCost',s.index('export const captureTerminalEvidence')),'ordinary_captured_route_rejects_drift': '(captured && receipt.actualModel !== undefined && receipt.actualModel !== snapshot.modelId)' in s,'production_manifest_registry_empty':'Object.freeze([])' in boot,'terminal_cost_contract_not_k_bound':'readonly terminalCost:' in boot and 'readonly inputBound:' in boot,'existing_tables':schema.count('defineTable('),'existing_indexes':schema.count('.index('),'internal_registrations':s.count('= internalMutation(')+s.count('= internalQuery('),'unknown_transition_has_no_overrun_latch':'overrun' not in s[s.index('async function writeUnknown'):s.index('async function liabilityAuthority')],'attachment_predicate_has_no_observed_model_guard':'actualModel' not in s[s.index('async function permittedAttachment'):s.index('export const captureTerminalEvidence')]}
assert all(v for v in controls.values());assert controls['existing_tables']==5 and controls['existing_indexes']==11 and controls['internal_registrations']==16
post=[row(root/p) for p in inputs];assert pre==post
(out/'source-post.json').write_text(json.dumps(post,indent=2)+'\n')
(out/'verification.json').write_text(json.dumps({'manifests':checks,'sourceEvidenceRowsVerified':len(money['sources']),'controls':controls,'prePostStable':True,'limitations':['Static source checks only; no product implementation execution','No new qualification of real money, native OCC or services','Root routing configs outside this scope'],'failures':[],'skips':['Application tests','Native/service/network/paid execution','Root configuration acceptance']},indent=2)+'\n')
print(json.dumps({'result':'PASS_STATIC_INTEGRITY_ONLY','packets':[{'name':c['packet'],'rows':c['rows']} for c in checks],'sourceEvidenceRows':len(money['sources']),'sourceStable':True,'controls':controls},indent=2))
(out/'execution.json').write_text(json.dumps({'argv':sys.argv,'executable':sys.executable,'cwd':str(Path.cwd()),'startUTC':start,'endUTC':utc(),'exitCode':0,'environmentPolicy':'Inherited shell environment not inspected or exported; Python stdlib offline file reads only; no environment files read','stdout':'static.stdout','stderr':'static.stderr','noProductWrites':True},indent=2)+'\n')
