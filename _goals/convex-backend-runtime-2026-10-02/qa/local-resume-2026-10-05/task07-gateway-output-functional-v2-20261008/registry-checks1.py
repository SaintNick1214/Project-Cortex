import concurrent.futures, json, os, pathlib, subprocess, time
root = pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
out = pathlib.Path(__file__).resolve().parent
node = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node'
env = dict(os.environ); env['PATH'] = str(pathlib.Path(node).parent)+':'+env['PATH']
checks = [
 ('registry-jest1', [node, '--experimental-vm-modules', str(root/'node_modules/jest/bin/jest.js'), '--runInBand', '--runTestsByPath', 'tests/unit/runtime/gateway-qualification-registry.test.ts', 'tests/unit/runtime/model-policy-admission.test.ts', 'tests/unit/domain/model-policy.test.ts', '--json', '--outputFile='+str(out/'registry-jest1.result.json')]),
 ('registry-sdk-types1', [node, str(root/'node_modules/typescript/bin/tsc'), '--noEmit']),
 ('registry-eslint1', [node, str(root/'node_modules/eslint/bin/eslint.js'), 'convex-dev/runtimeGatewayQualifications.ts', 'convex-dev/runtimeModelPolicyBootstrap.ts', 'tests/unit/runtime/gateway-qualification-registry.test.ts', 'tests/unit/runtime/model-policy-admission.test.ts']),
]
def run(check):
 name,cmd=check; start=time.time()
 with (out/(name+'.stdout.log')).open('wb') as stdout,(out/(name+'.stderr.log')).open('wb') as stderr:
  try: result=subprocess.run(cmd,cwd=root,env=env,stdout=stdout,stderr=stderr,timeout=90); receipt=dict(exitCode=result.returncode,timedOut=False)
  except subprocess.TimeoutExpired: receipt=dict(exitCode=None,timedOut=True)
 receipt.update(command=cmd,cwd=str(root),durationMs=round((time.time()-start)*1000),deadlineMs=90000)
 (out/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n'); return dict(name=name,**receipt)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for receipt in pool.map(run,checks): print(json.dumps(receipt))
