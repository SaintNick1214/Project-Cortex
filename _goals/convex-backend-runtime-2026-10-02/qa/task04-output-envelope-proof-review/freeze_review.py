from pathlib import Path
import hashlib,json,datetime,subprocess,sys
root=Path('/workspace/Project-Cortex');out=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-output-envelope-proof-review';work=root/'work/resume/task04-output-envelope-proof-review';prep=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-output-envelope-proof-preparation'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(name,v):
 with (out/name).open('x') as f:json.dump(v,f,indent=2);f.write('\n')
evidence=json.loads((prep/'source-evidence.json').read_text()); checks=[]
for section in ['sources','artifacts','previousPacketsPreserved']:
 for row in evidence[section]:
  p=root/row['path'];checks.append({'section':section,'path':row['path'],'expectedSHA256':row['sha256'],'actualSHA256':sha(p),'matches':sha(p)==row['sha256']})
assert all(c['matches'] for c in checks);save('source-evidence-validation.json',checks)
context=['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','.agents/skills/feature-orchestrator/SKILL.md','_goals/convex-backend-runtime-2026-10-02/implementation-prompt.md','_goals/convex-backend-runtime-2026-10-02/goal.md','_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md','_research/convex-ai-gateway-2026-10-02/decision-gates.md','_research/convex-ai-gateway-2026-10-02/architecture.md','_goals/convex-backend-runtime-2026-10-02/qa/task04-input-result-bound-research/report.md','_goals/convex-backend-runtime-2026-10-02/qa/task04-structured-gateway-preparation/report.md','_goals/convex-backend-runtime-2026-10-02/qa/task04-output-vocabulary-acquisition/report.md','src/domain/profile.ts','src/domain/model-policy.ts','convex-dev/runtimeModelPolicy.ts']
argv=['python','-c','import pathlib,sys; [(print("SOURCE "+p),print(pathlib.Path(p).read_text())) for p in sys.argv[1:]]',*context];start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=root,capture_output=True)
for ext,data in [('stdout',p.stdout),('stderr',p.stderr)]:
 with (out/('context-read.'+ext)).open('xb') as f:f.write(data)
save('context-read.receipt.json',{'argv':argv,'cwd':str(root),'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest(),'role':'exact inspected context raw source receipt'})
assert p.returncode==0
for p in work.iterdir():
 if p.is_file():
  with (out/p.name).open('xb') as f:f.write(p.read_bytes())
pre=json.loads((out/'pre-fingerprints.json').read_text());final={k:sha(root/k) for k in pre};assert final==pre
save('final-preservation.json',{'checkedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'all446ProtectedFingerprintsUnchanged':final==pre,'sourceEvidenceEntriesVerified':len(checks),'writesOnlyNewReviewAndUniqueWork':True})
manifest={'frozenAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'selfExcluded':'manifest.json','mode':'FRESH_INDEPENDENT_READ_ONLY_CONDITIONAL_FORMAL_OUTPUT_PROOF_REVIEW','sources':pre,'reportSHA256':sha(out/'report.md'),'files':[{'path':str(p.relative_to(out)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(out.rglob('*')) if p.is_file() and p.name!='manifest.json'],'originalTask04':'INCOMPLETE','fullGoal':'INCOMPLETE','servingModelOutputCapDecoderNativeCorrespondence':'NOT_RUN','productionRoot':'EMPTY','conditionalProofVerdict':'PASS'}
save('manifest.json',manifest)
print(json.dumps({'reportSHA256':manifest['reportSHA256'],'manifestSHA256':sha(out/'manifest.json'),'files':len(manifest['files']),'sourceEvidenceChecks':len(checks)}))
