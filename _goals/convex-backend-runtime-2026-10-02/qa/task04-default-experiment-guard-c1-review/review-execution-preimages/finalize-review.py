from pathlib import Path
import json,hashlib,shutil,datetime
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-experiment-guard-c1-review';s=r/'work/resume/task04-default-experiment-guard-c1-review';subject=q.parent/'task04-default-experiment-guard-implementation-c1'
def hash(b):return hashlib.sha256(b).hexdigest()
pre=json.loads((q/'pre-check-fingerprints.json').read_text());post=[]
for row in pre:
 b=(r/row['path']).read_bytes();post.append({'path':row['path'],'bytes':len(b),'sha256':hash(b),'unchanged':len(b)==row['bytes'] and hash(b)==row['sha256']})
(q/'post-check-fingerprints.json').write_text(json.dumps(post,indent=2)+'\n')
refs=json.loads((subject/'source-evidence.json').read_text())['files'];checks=[]
for row in refs:
 b=(r/row['path']).read_bytes();checks.append({**row,'match':len(b)==row['bytes'] and hash(b)==row['sha256']})
(q/'current-subject-reference-verification.json').write_text(json.dumps({'rows':len(checks),'checks':checks},indent=2)+'\n')
for p in s.rglob('*'):
 if p.is_file():
  dst=q/'review-execution-preimages'/p.relative_to(s);dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dst)
baseline=json.loads((q/'raw/baseline23.stdout').read_text());hostile=json.loads((q/'raw/hostile6-asserted.stdout').read_text());(q/'test-discovery.json').write_text(json.dumps({'baseline':{'discovered':baseline['tests'],'executed':len(baseline['testsDetail']),'skipped':0,'detail':baseline['testsDetail']},'independent':{'discovered':len(hostile['outcomes']),'executed':len(hostile['outcomes']),'skipped':0,'contractFailures':sum(x['contractMet'] is not True for x in hostile['outcomes']),'detail':hostile['outcomes']}},indent=2)+'\n')
(q/'skips.json').write_text(json.dumps({'nativeOCC':'NOT_RUN: bounded offline review only','GatewayNativeDriver':'NOT_IMPLEMENTED; separate required gate','paid':'NOT_RUN: guard rejected; separate prerequisite gates','managed1536WriteSearch':'NOT_RUN: actual service gate remains required','productFullCoreUI':'NOT_RUN: disjoint original goal gates'},indent=2)+'\n')
(q/'review-tooling-history.json').write_text(json.dumps({'nonexistentNodeAttempt':{'argv':['/workspace/Project-Cortex/work/resume/toolchain-bin/node','--version'],'cwd':str(r),'error':'FileNotFoundError: No such file or directory','utc':'Exact exploratory UTC not recorded separately; transcript available','checkExecuted':False},'firstFinalChecks':'First complete set rerun when scoped lint added; final complete receipts retained, not a claimed separate certification','hostileDiagnostic':'Exit0 is execution-only with four contractMet:false; asserted rerun exit1 retained'},indent=2)+'\n')
rows=[]
for p in sorted(q.rglob('*')):
 if p.is_file() and p!=q/'qa-manifest.json':
  b=p.read_bytes();rows.append({'path':str(p.relative_to(q)),'bytes':len(b),'sha256':hash(b)})
(q/'qa-manifest.json').write_text(json.dumps({'version':1,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verdict':'REJECT_OFFLINE_EXPERIMENT_CONTROL_ONLY','excludesOnly':'qa-manifest.json','rows':rows},indent=2)+'\n')
print(json.dumps({'manifestRows':len(rows),'postChanges':[x for x in post if not x['unchanged']],'subjectReferences':len(checks),'subjectReferenceMismatches':[x for x in checks if not x['match']],'reportSHA256':hash((q/'report.md').read_bytes()),'manifestSHA256':hash((q/'qa-manifest.json').read_bytes())}))
