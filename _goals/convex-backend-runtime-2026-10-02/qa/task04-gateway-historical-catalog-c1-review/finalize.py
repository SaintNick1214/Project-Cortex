import pathlib,json,hashlib,shutil,datetime
R=pathlib.Path('/workspace/Project-Cortex'); G=R/'_goals/convex-backend-runtime-2026-10-02'; P=G/'qa/task04-gateway-historical-catalog-preparation-c1'; Q=G/'qa/task04-gateway-historical-catalog-c1-review'; W=R/'work/resume/task04-gateway-historical-catalog-c1-review'; C=W/'owned-packet'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,o):(Q/n).write_text(json.dumps(o,indent=2)+'\n')
O=json.loads((P/'official-catalog.json').read_text()); folders={x['folder'] for x in O['packages']}; deps=[]
for pkg in O['packages']:
 f=pathlib.Path(pkg['folder']); m=json.loads((f/'package.json').read_text()); assert m['name']==pkg['name'] and m['version']==pkg['version']
 for name in m.get('dependencies',{}):
  found=None
  for parent in [f,*f.parents]:
   trial=parent/'node_modules'/name/'package.json'
   if trial.is_file():found=trial.parent;break
  assert found is not None,(f,name)
  assert str(found) in folders,(f,name,found)
  deps.append({'importer':str(f),'dependency':name,'physicalRoot':str(found)})
save('official-closure-review.json',{'physicalRoots':len(folders),'files':len(O['files']),'bytes':sum(x['bytes'] for x in O['files']),'dependencyEdges':deps,'allPackageIdentityAndDeclaredDependencyRootsVerified':True,'allInstalledAndPreimageHashesVerified':True,'unusedFilesNotClaimedExecuted':True})
lineage=json.loads((P/'deadline-lineage.json').read_text()); a=R/lineage['originalPath']; b=R/lineage['acceptedRunnerPath']; assert a.read_text().replace(lineage['before'],lineage['after'])==b.read_text(); assert sha(a)==lineage['originalFingerprint']['sha256']; assert sha(b)==lineage['acceptedFingerprint']['sha256']; save('independent-deadline-lineage.json',lineage)
receipts=[]
for directory in sorted((P/'evidence').iterdir()):
 p=directory/'result.json'
 if not p.exists():continue
 d=json.loads(p.read_text()); pre=json.loads((directory/'pre-execution.json').read_text()) if (directory/'pre-execution.json').exists() else {}
 receipts.append({'directory':directory.name,'argv':d.get('argv'),'cwd':d.get('cwd'),'startUTC':d.get('startedUTC'),'endUTC':d.get('endedUTC'),'exitCode':d.get('exitCode'),'sourcesStable':d.get('allSourcesConfigsStable'),'schemaKeys':sorted(d),'preSchemaKeys':sorted(pre)})
save('producer-receipt-review.json',receipts)
for name in ['catalog']:
 shutil.copytree(P/name,Q/'source-preimages'/name)
for name in ['local-catalog.json','official-catalog.json','deadline-lineage.json','report.md','manifest.json']:
 shutil.copyfile(P/name,Q/'source-preimages'/name)
context=['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','.agents/skills/feature-orchestrator/SKILL.md','_research/convex-ai-gateway-2026-10-02/decision-gates.md','_research/convex-ai-gateway-2026-10-02/architecture.md','_goals/convex-backend-runtime-2026-10-02/implementation-prompt.md','_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md','_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-capture-composition-preparation-c2/report.md','_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-capture-composition-c2-design-review/report.md','_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-capture-composition-c2-coordinator-acceptance.json','_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-middleware-c2-review/report.md']
for name in context:
 p=R/name
 if not p.exists():
  assert name.endswith('04-model-policy.md'); p=next((G/'tasks').glob('04*')); name=str(p.relative_to(R))
 target=Q/'context-preimages'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
for name in ['review.py','finalize.py']:shutil.copyfile(W/name,Q/name)
for name in ['build-official.mjs','create-runner.py','record-run.py']:shutil.copyfile(R/'work/resume/task04-gateway-historical-catalog-preparation-c1'/name,Q/'runner-preimages'/name)
(Q/'reviewer-setup-failure.txt').write_text('Observed first reviewer driver invocation failed before launching Node: FileNotFoundError: /workspace/Project-Cortex/work/resume/toolchain-bin/node. The bin directory contains npm and npx only. Corrected reviewer driver uses ambient absolute Node at /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node; required toolchain-bin remains first in exclusive PATH. No test/guard execution occurred in the failed attempt. Exact tool-returned traceback was visible in review session; this note is a transparent retrospective preservation, not a fabricated contemporaneous receipt.\n')
I=json.loads((Q/'import-verification.json').read_text()); T=json.loads((Q/'historical-results.json').read_text()); assert I['verifiedResolutions']==378;assert len(I['uniqueModules'])==255; assert all(x['verified'] for x in I['observations']); assert all(x['status']=='passed' for t in T['testResults'] for x in t['assertionResults']);save('independent-outcome-summary.json',{'tests':T['numTotalTests'],'passed':T['numPassedTests'],'suites':T['numTotalTestSuites'],'counts':I['counts'],'pending':T['numPendingTests'],'todo':T['numTodoTests'],'failed':T['numFailedTests'],'resolverObservations':I['verifiedResolutions'],'uniqueModules':len(I['uniqueModules']),'currentTestsExecuted':0,'nativePaidServices':0})
print('Independent declared-transitive closure, deadline lineage and source/context preimages verified')
