from pathlib import Path
import json,hashlib,datetime,subprocess
r=Path('/workspace/Project-Cortex');q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-charge-only-c1-product-review';s=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-charge-only-implementation-c1';w=r/'work/resume/task04-model-drift-charge-only-c1-product-review'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(n,x):(q/n).write_text(json.dumps(x,indent=2)+'\n')
# Recover the exact initial own probe by removing only the additive final3; certify against its freeze.
p=q/'stages/probe11/independent-probe.test.ts';p.write_text((q/'independent-probe.test.ts').read_text().split("it.each(['healthy','revoked','cancelled'] as const)")[0]);f=json.loads((q/'stages/probe11/current-freeze.json').read_text());assert sha(p)==next(x['sha256'] for x in f['files'] if x['path']==str(q/'independent-probe.test.ts'))
summary={};
for name,count,suites in [('probe',14,1),('native',190,2),('current',160,1),('historical/historical',78,4)]:
 d=json.loads((q/(name+'-results.json')).read_text());assert d['numTotalTests']==d['numPassedTests']==count;assert d['numTotalTestSuites']==suites
 for key in ['numFailedTests','numPendingTests','numTodoTests','numRuntimeErrorTestSuites']:assert d[key]==0
 summary[name]={'passed':count,'failed':0,'skips':0,'todo':0,'runtimeErrors':0,'suites':[{'path':x['name'],'assertions':len(x['assertionResults'])} for x in d['testResults']]}
for n in ['probe','native','current']:
 found=json.loads((q/(n+'-list.stdout')).read_text());assert sorted(found)==sorted(x['path'] for x in summary[n]['suites'])
logs=[json.loads(l) for l in (q/'current-imports.ndjson').read_text().splitlines() if l];assert all(x['verified'] for x in logs);assert any(x['resolved']==str(r/'convex-dev/runtimeGateway.ts') for x in logs);assert any(x['resolved']==str(r/'convex-dev/runtimeModelPolicy.ts') for x in logs);assert not any('/catalog/' in x['resolved'] or 'gateway-historical' in x['resolved'] for x in logs)
expected={'convex-dev/runtimeModelPolicy.ts':'c8279d4496eb9b6eb5763732dbb7e54cefe27e028f285fe3e31a639af1535710','tests/unit/runtime/model-policy-model-drift.test.ts':'9d5fe93afe4d55bdbe5181ddadfd48639057f8c5357f0e753b9cd9e3bb21d379','convex-dev/runtimePolicySchema.ts':'4467a4d4e424fa57cd07de95bce702108765747cfb6afa8a0756fea253926534','convex-dev/schema.ts':'b95bdd8b643b9d8d7f3d6ed2770181cff15e116110af3b3648bb4492e58495c2','tests/unit/runtime/model-policy-admission.test.ts':'817def96244c30f0eb176afa90163f38d5c9deac842d714c9ad3c3d69829e967','convex-dev/runtimeGateway.ts':'e796e43aafe70c37d8af7330a969e5b643eb58e86be7621cc7c08991ff1224be','tests/unit/runtime/gateway-terminal-composition.test.ts':'d324b1a85beb20fc98c1d81bc9fc592969be452ddd2d3a00886df464edc8dba1','tests/unit/runtime/gateway-dispatch.test.ts':'fc58a25d9c5cf9526e65838ab1b25c4fcf5cda024885082a560e3cf6faa029f2'}
for p,h in expected.items():assert sha(r/p)==h,p
policy=(r/'convex-dev/runtimeModelPolicy.ts').read_text();old=(s/'preimages/convex-dev/runtimeModelPolicy.ts').read_text();a=policy[policy.index('function attachmentDenied'):policy.index('async function permittedAttachment')];b=old[old.index('function attachmentDenied'):old.index('async function permittedAttachment')];assert a==b;assert policy.count('= internalMutation(')+policy.count('= internalQuery(')==16
bootstrap=(r/'convex-dev/runtimeModelPolicyBootstrap.ts').read_text();assert 'const manifests: readonly DeploymentPolicyManifest[] = Object.freeze([])' in bootstrap
summary.update({'imports':{'verifiedObservations':len(logs),'currentGatewayAndRegisteredPolicy':True,'noHistoricalMapping':True},'protectedSourcePins':expected,'classifierByteExact':True,'registrations':16,'productionRoots':'EMPTY','nativeChangedSource':'NOT_RUN','monetary':'SYNTHETIC_ONLY'})
dump('verified-results-summary.json',summary)
for n in ['types','lint']:assert json.loads((q/(n+'-receipt.json')).read_text())['exit']==0
# Preserve and reproduce setup-only syntax error; it launched no checks and touched no source.
start=datetime.datetime.now(datetime.timezone.utc).isoformat();argv=['python3',str(q/'setup-syntax-failure.py'),'setup'];z=subprocess.run(argv,cwd=r,capture_output=True,text=True);assert z.returncode==1;(q/'setup-syntax-failure.stdout').write_text(z.stdout);(q/'setup-syntax-failure.stderr').write_text(z.stderr);dump('setup-syntax-failure-receipt.json',{'argv':argv,'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':z.returncode,'expected':1,'scope':'Same preserved script reproduction; original invocation visible in tool transcript only'})
for p in w.iterdir():
 if p.is_file():(q/('reviewer-'+p.name)).write_bytes(p.read_bytes())
print(json.dumps({'verified':summary,'allChecks':True}))
