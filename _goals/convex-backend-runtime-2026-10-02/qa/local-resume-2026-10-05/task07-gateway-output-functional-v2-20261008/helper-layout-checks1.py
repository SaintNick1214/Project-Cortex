import concurrent.futures, hashlib, json, os, pathlib, subprocess, time
root = pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
out = pathlib.Path(__file__).resolve().parent
node = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node'
env = dict(os.environ)
env['PATH'] = str(pathlib.Path(node).parent) + ':' + env['PATH']
checks = [
 ('helper-layout-jest1', root/'packages/cortex-cli', [node, '--experimental-vm-modules', str(root/'node_modules/jest/bin/jest.js'), '--selectProjects', 'unit', '--runInBand', '--runTestsByPath', 'src/utils/__tests__/additive-backend.test.ts', '--json', '--outputFile='+str(out/'helper-layout-jest1.result.json')]),
 ('helper-layout-types1', root/'packages/cortex-cli', [node, str(root/'node_modules/typescript/bin/tsc'), '--noEmit']),
 ('helper-layout-eslint1', root, [node, str(root/'node_modules/eslint/bin/eslint.js'), 'scripts/backend/build-distribution.mjs', 'packages/cortex-cli/src/utils/init/additive-backend.ts', 'packages/cortex-cli/src/utils/__tests__/additive-backend.test.ts']),
]
def run(check):
 name, cwd, cmd = check
 start = time.time()
 with (out/(name+'.stdout.log')).open('wb') as stdout, (out/(name+'.stderr.log')).open('wb') as stderr:
  try:
   result = subprocess.run(cmd, cwd=cwd, env=env, stdout=stdout, stderr=stderr, timeout=90)
   receipt = dict(exitCode=result.returncode, timedOut=False)
  except subprocess.TimeoutExpired:
   receipt = dict(exitCode=None, timedOut=True)
 receipt.update(command=cmd, cwd=str(cwd), durationMs=round((time.time()-start)*1000), deadlineMs=90000)
 (out/(name+'.json')).write_text(json.dumps(receipt, indent=2)+'\n')
 return dict(name=name, **receipt)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for receipt in pool.map(run, checks): print(json.dumps(receipt))
