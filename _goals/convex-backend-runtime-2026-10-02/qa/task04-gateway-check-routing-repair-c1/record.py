import hashlib, json, os, pathlib, subprocess, sys, datetime
root = pathlib.Path('/workspace/Project-Cortex')
qa = root / '_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-check-routing-repair-c1'
paths = ['tsconfig.json', 'jest.config.mjs', 'eslint.config.js', 'tsconfig.lint.json', 'tsconfig.build.json', 'tests/unit/runtime/convex-schema-test-types.d.ts', 'tests/unit/runtime/gateway-dispatch.test.ts', 'tests/unit/runtime/gateway-terminal-composition.test.ts', 'convex-dev/runtimeGateway.ts', 'tests/unit/runtime/model-policy-admission.test.ts', 'convex-dev/runtimePolicySchema.ts', 'convex-dev/runtimeModelPolicy.ts']
def hashes():
    return [{'path': p, 'sha256': hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in paths if (root/p).is_file()]
label, *argv = sys.argv[1:]
folder = qa / 'evidence' / label
folder.mkdir(parents=True, exist_ok=False)
env = {'PATH': str(root/'work/resume/toolchain-bin')+':/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin', 'TMPDIR': str(root/'work/resume/task04-gateway-check-routing-repair-c1'), 'NO_COLOR': '1'}
pre = hashes()
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
start = now()
with (folder/'stdout.txt').open('w') as out, (folder/'stderr.txt').open('w') as err:
    proc = subprocess.run(argv, cwd=root, env=env, stdout=out, stderr=err)
post = hashes()
(folder/'receipt.json').write_text(json.dumps({'argv':argv,'cwd':str(root),'environment':env,'startedAt':start,'endedAt':now(),'exitCode':proc.returncode,'sourcePre':pre,'sourcePost':post,'sourceUnchanged':pre==post,'testExecution':False}, indent=2)+'\n')
print(json.dumps({'label':label,'exitCode':proc.returncode,'sourceUnchanged':pre==post}))
sys.exit(proc.returncode)
