import subprocess,pathlib,json,datetime,hashlib,sys,os
root=pathlib.Path('/workspace/Project-Cortex'); qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-error-boundary-repair'
files=['convex-dev/runtimeModelPolicy.ts','tests/unit/runtime/model-policy-admission.test.ts','src/domain/model-policy.ts','src/domain/profile.ts','src/domain/index.ts','convex-dev/runtimePolicySchema.ts','convex-dev/schema.ts','convex-dev/runtimeModelPolicyBootstrap.ts','convex-dev/runtimeGateway.ts','convex-dev/_generated/api.d.ts']
def hashes():return {f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in files}
name=sys.argv[1];argv=sys.argv[2:];dest=qa/name;dest.mkdir(exist_ok=False);started={'argv':argv,'cwd':str(root),'startUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceBefore':hashes()};(dest/'started.json').write_text(json.dumps(started,indent=2)); env=os.environ.copy();env['PATH']=str(root/'work/resume/toolchain-bin')+':'+env['PATH']
with (dest/'stdout').open('w') as out,(dest/'stderr').open('w') as err:r=subprocess.run(argv,cwd=root,env=env,stdout=out,stderr=err)
started.update(exitCode=r.returncode,endUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceAfter=hashes());(dest/'receipt.json').write_text(json.dumps(started,indent=2));print(name,r.returncode)
