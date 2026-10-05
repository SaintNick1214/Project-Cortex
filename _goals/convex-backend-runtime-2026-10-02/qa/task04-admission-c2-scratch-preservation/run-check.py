import sys,subprocess,pathlib,json,hashlib,datetime,os
root=pathlib.Path('/workspace/Project-Cortex'); base=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-admission-implementation-c2'
name=sys.argv[1]; args=sys.argv[2:]; target=base/name;target.mkdir(exist_ok=False)
files=['convex-dev/runtimePolicySchema.ts','convex-dev/schema.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeModelPolicyBootstrap.ts','src/domain/model-policy.ts','src/domain/index.ts','tests/unit/domain/model-policy.test.ts','tests/unit/runtime/model-policy-admission.test.ts','tsconfig.json','tsconfig.lint.json','eslint.config.js']
files += ['work/resume/task04-admission-implementation-c2/c1-mirror/runtimeModelPolicy.ts','convex-dev/runtimeAuth.ts','convex-dev/runtimeAuthSchema.ts','convex-dev/runtimeMemorySchema.ts','convex-dev/runtimeMemoryRepository.ts','convex-dev/runtimeWorkerAuth.ts','src/auth/verified.ts','src/domain/contracts.ts','src/domain/profile.ts','tests/unit/runtimeMemory/fixture.ts','package.json','package-lock.json']
for arg in args:
 path=pathlib.Path(arg); candidate=path if path.is_absolute() else root/path
 if candidate.is_file() and candidate.suffix in ['.json','.js','.mjs','.py']:
  namecopy='config-'+str(len(list(target.glob('config-*'))))+candidate.suffix; (target/namecopy).write_bytes(candidate.read_bytes()); files.append(str(candidate))
(target/'test-discovery.json').write_text(json.dumps({'selectedConfigArgs':args,'runtimeTests':sorted(str(p) for p in (root/'tests/unit/runtime').glob('*.test.ts')),'serviceSetupExcluded':True},indent=2)+'\n')
manifest={'startedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cwd':str(root),'argv':args,'sources':[{'path':f,'sha256':hashlib.sha256((root/f).read_bytes()).hexdigest()} for f in files if (root/f).exists()]}
(target/'pre-execution.json').write_text(json.dumps(manifest,indent=2)+'\n')
with (target/'stdout.txt').open('x') as out,(target/'stderr.txt').open('x') as err: result=subprocess.run(args,cwd=root,stdout=out,stderr=err,env=os.environ.copy())
after=[{'path':row['path'],'sha256':hashlib.sha256((root/row['path']).read_bytes()).hexdigest()} for row in manifest['sources']]
(target/'post-execution-sources.json').write_text(json.dumps(after,indent=2)+'\n')
changed=[row['path'] for row,new in zip(manifest['sources'],after) if row['sha256']!=new['sha256']]
(target/'result.json').write_text(json.dumps({'exitCode':result.returncode,'sourceChangedDuringExecution':changed,'finishedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n')
print(name,'exit',result.returncode)
print((target/'stdout.txt').read_text()[-5000:]);print((target/'stderr.txt').read_text()[-3000:])
sys.exit(result.returncode)
