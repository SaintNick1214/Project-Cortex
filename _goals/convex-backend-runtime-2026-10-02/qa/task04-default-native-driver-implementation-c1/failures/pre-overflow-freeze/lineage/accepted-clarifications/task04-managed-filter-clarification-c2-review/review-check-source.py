from pathlib import Path
import hashlib,json,datetime,subprocess
ROOT=Path('/workspace/Project-Cortex'); Q=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-managed-filter-clarification-c2-review'; S=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c1/design-clarification-c2'
def h(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(name,x): (Q/name).write_text(json.dumps(x,indent=2)+'\n')
def snapshot(p): return [{'path':str(x.relative_to(p)),'bytes':x.stat().st_size,'sha256':h(x)} for x in sorted(p.rglob('*')) if x.is_file()]
dump('subject-pre.json',snapshot(S))
paths=['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','package.json','node_modules/convex/package.json','node_modules/convex/src/server/vector_search.ts','node_modules/convex/src/server/impl/vector_search_impl.ts','_research/convex-ai-gateway-2026-10-02/decision-gates.md','_research/convex-ai-gateway-2026-10-02/architecture.md']
G='_goals/convex-backend-runtime-2026-10-02/'
paths += [G+x for x in ['goal.md','implementation-prompt.md','tasks/01-qualification.md','tasks/04-model-policy.md','tasks/14-client-extensions.md']]
D=G+'qa/task04-default-native-driver-design-c4/'
paths += [D+x for x in ['proposal.md','contracts/managed-fixture.md','contracts/receipt-state.md','contracts/hash-recovery.md','contracts/replay-cleanup.md','check-plan.md','initial14-identities.json']]
paths += [G+'qa/task04-default-native-driver-implementation-c1/fixture/convex/canonical.ts']
dump('source-pre.json',[{'path':x,'bytes':(ROOT/x).stat().st_size,'sha256':h(ROOT/x)} for x in paths])
argv=['cat',*paths]; start=datetime.datetime.now(datetime.timezone.utc).isoformat(); r=subprocess.run(argv,cwd=ROOT,capture_output=True)
(Q/'references.stdout').write_bytes(r.stdout); (Q/'references.stderr').write_bytes(r.stderr)
dump('references-run.json',{'utcStart':start,'utcEnd':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv,'cwd':str(ROOT),'exit':r.returncode,'discovery':'24 required originals/current API/reference inputs, full bytes retained','skips':['No application/native/index/codegen/service tests: DESIGN_ONLY scope'],'failed':r.returncode!=0})
assert r.returncode==0
results=[]
for p in [S/'manifest.json',S/'lineage/c1/manifest.json',S/'lineage/c1-review/manifest.json']:
 m=json.loads(p.read_text()); entries=m['files']; found={str(x.relative_to(p.parent)) for x in p.parent.rglob('*') if x.is_file() and x!=p}; expected={e['path'] for e in entries}
 assert found==expected,(p,found^expected)
 for e in entries:
  x=p.parent/e['path']; assert x.stat().st_size==e['bytes'] and h(x)==e['sha256'],x
 results.append({'path':str(p.relative_to(S)),'sha256':h(p),'files':len(entries),'exactRecursiveClosure':True})
assert h(S/'manifest.json')=='263124572857988a0b50c1fc7ebccc52c65e009a7e47dcd1f9792678327e05ff'
assert h(S/'proposal.md')=='72ada50f821b161c8ff4696805778a5b77be9693e897d906d9dc78ff74b8c4c9'
dump('closure-check.json',results)
print(json.dumps({'manifestChecks':results,'referencesExit':r.returncode}))
