from pathlib import Path
import json,hashlib,datetime,sys
root=Path('/workspace/Project-Cortex'); q=root/'_goals/convex-backend-runtime-2026-10-02/qa'; out=q/'task04-model-drift-charge-only-c2-design-review'
def info(p):
 b=p.read_bytes(); return {'path':str(p.relative_to(root)), 'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
subject=q/'task04-model-drift-charge-only-repair-preparation-c2'
sources=json.loads((subject/'source-evidence.json').read_text())['sources']
rows=[]
for r in sources:
 a=info(root/r['path']); assert a['bytes']==r['bytes'] and a['sha256']==r['sha256'],a; rows.append(a)
extra=['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','.agents/skills/feature-orchestrator/SKILL.md','_goals/convex-backend-runtime-2026-10-02/implementation-prompt.md','_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md','_research/convex-ai-gateway-2026-10-02/decision-gates.md','_research/convex-ai-gateway-2026-10-02/architecture.md','convex-dev/runtimeModelPolicyBootstrap.ts','package.json']
rows += [info(root/p) for p in extra]
(out/'source-pre.json').write_text(json.dumps(rows,indent=2)+'\n')
packets=[]
for name in ['task04-model-drift-charge-only-repair-preparation-c2','task04-model-drift-charge-only-repair-preparation-c1','task04-model-drift-charge-only-c1-design-review','task04-gateway-terminal-composition-c1-review','task04-gateway-capture-composition-preparation-c2','task04-gateway-capture-composition-c2-design-review']:
 d=q/name; m=d/'manifest.json'; obj=json.loads(m.read_text()); rs=obj.get('files',obj.get('rows'))
 if rs is None: raise ValueError(list(obj))
 actual={str(p.relative_to(d)) for p in d.rglob('*') if p.is_file() and p!=m}
 expected={r['path'] for r in rs}; assert actual==expected,(name,len(actual),len(expected),actual-expected,expected-actual)
 for r in rs:
  b=(d/r['path']).read_bytes(); assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],(name,r['path'])
 packets.append({'packet':name,'rows':len(rs),'manifest':info(m),'complete':True,'nestedManifestsIncluded':True})
p=(subject/'proposal.md').read_text(); code=(root/'convex-dev/runtimeModelPolicy.ts').read_text(); bootstrap=(root/'convex-dev/runtimeModelPolicyBootstrap.ts').read_text()
checks={
 'subject_exact':hashlib.sha256((subject/'proposal.md').read_bytes()).hexdigest()=='85a9ed8e6ce24025cc17f5556f2154ab338684f915e1dd7eeb7417bc2ae37a37',
 'mandatory_money_independent_predicate':'MANDATORY shared native observation predicate' in p and 'independently of knownCost' in p,
 'original_OR_latches':'Atomically OR-latch' in p and 'OR latches and next original guarded permit denial' in p,
 'defensive_initial_final_attempt':'initial AND final captured canonical observations and attempt.actualModel' in p,
 'false_latches_attached_pending':'ALL overrun latches are falsely unset' in p and 'attached:true/resultWithheld:false' in p,
 'unexpected_errors_propagate':'Unexpected native read failures still propagate/retry' in p,
 'conditional_whole_money':'whole invocation even if served model drifts' in p and 'cannot be inferred from knownCost code' in p,
 'duplicate_before_mutation':'Apply zero-write duplicate recognition before any mutation' in p,
 'source_capture_drift_before_cost':code.index('receipt.actualModel !== snapshot.modelId',code.index('export const captureTerminalEvidence')) < code.index('const cost = knownCost',code.index('export const captureTerminalEvidence')),
 'source_immutable_facts': 'receipt.actualModel !== initial.data.actualModel' in code and 'receipt.usage?.[key] !== initial.data.usage[key]' in code,
 'production_roots_empty':'const manifests: readonly DeploymentPolicyManifest[] = Object.freeze([]);' in bootstrap,
 'schema_unchanged':next(r['sha256'] for r in rows if r['path']=='convex-dev/runtimePolicySchema.ts')=='4467a4d4e424fa57cd07de95bce702108765747cfb6afa8a0756fea253926534',
}
assert all(checks.values()),checks
post=[info(root/r['path']) for r in rows]; assert rows==post
(out/'source-post.json').write_text(json.dumps(post,indent=2)+'\n')
(out/'verification.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'PASS_STATIC_INTEGRITY_ONLY','sourceRows':len(rows),'packets':packets,'checks':checks,'productTests':'NOT_RUN','nativeServices':'NOT_RUN','actualMoney':'UNQUALIFIED','failures':[],'skips':['All application/native/provider/paid/UI execution deliberately outside read-only design scope']},indent=2)+'\n')
print(json.dumps({'result':'PASS_STATIC_INTEGRITY_ONLY','sourceRows':len(rows),'packets':[(x['packet'],x['rows']) for x in packets],'controls':len(checks),'prePostEqual':True}))
