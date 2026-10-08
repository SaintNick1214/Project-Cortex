from pathlib import Path
import json,hashlib
r=Path('/workspace/Project-Cortex'); q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-supported-money-source-design-c1'
doc=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-money-source-candidate-c1/official-doc-response'
gen=r/'node_modules/@ai-sdk/gateway/src/gateway-generation-info.ts'
assert hashlib.sha256(doc.read_bytes()).hexdigest()=='ef607898f92882f45636250be07f3298915b4feea73dea9df38154c96d2bee23'
assert hashlib.sha256(gen.read_bytes()).hexdigest()=='af9d77a6b0c9cda77d798a4e3f4ea931ef823ba1c672d637532a4eac2468f802'
assert 'successful attempt of each stage carries its own' in doc.read_text()
convex=(r/'node_modules/@convex-dev/ai-sdk-provider/src/index.ts').read_text()
runner=(r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c2/fixture/convex/runner.ts').read_text()
assert 'https://ai-gateway.convex.dev' in convex and 'getServiceToken("ai-gateway")' in convex
assert 'getGenerationInfo' not in convex and 'getGenerationInfo' not in runner
assert 'const model=convexGateway(c.modelId)' in runner
assert 'const model=convexGateway.embeddingModel(c.modelId)' in runner
cases=['one-success-cost','zero-cost','early-generation-id','final-stop','embedding-success','fallback-success','failed-attempt-unlisted','cache-zero-token','local-cancel','local-reject','lookup-404','late-after1000','model-drift','surcharge-unlisted','hash-only-category-proof']
def diagnostic(gap,k):
 return {'money':'UNKNOWN','liability':k,'stop':True,'categories':[],'positiveAdmission':False,'missingContract':gap}
for gap in cases:
 for k in [0,314310,12000000]:
  outcome=diagnostic(gap,k)
  assert outcome['money']=='UNKNOWN' and outcome['liability']==k
  assert outcome['stop'] and outcome['categories']==[] and not outcome['positiveAdmission']
# Diagnostic is not a source extraction implementation; unsupported positives remain absent.
checks=[]
for pre in sorted(q.glob('*-pre.json')):
 post=q/(pre.name[:-9]+'-post.json')
 if post.exists():
  before=json.loads(pre.read_text())['files']; after=json.loads(post.read_text())['files']
  assert before==after,(pre.name,'source drift')
  checks.append({'command':pre.name[:-9],'sourceCount':len(before),'unchanged':True})
result={'status':'PASS','kind':'DUMMY failclosed diagnostic and exact source pin checks','positiveWholeInvocationQualification':False,'unsupportedAttractiveInputs':len(cases),'liabilityControls':len(cases)*3,'sourceCommands':checks,'currentDomain':'EMPTY','missingServiceContract':True}
(q/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
