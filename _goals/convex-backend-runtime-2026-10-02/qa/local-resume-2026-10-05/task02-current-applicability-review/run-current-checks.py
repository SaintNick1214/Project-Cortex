import json,os,subprocess,time
from pathlib import Path
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');P=Path(__file__).parent
T=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin');env={**os.environ,'PATH':str(T)+':'+os.environ.get('PATH','')}
checks=[]
def run(name,argv):
 began=time.monotonic();r=subprocess.run(argv,cwd=R,env=env,capture_output=True,timeout=120)
 (P/(name+'.stdout')).write_bytes(r.stdout);(P/(name+'.stderr')).write_bytes(r.stderr);checks.append({'name':name,'argv':list(map(str,argv)),'exitCode':r.returncode,'elapsedSeconds':time.monotonic()-began,'cwd':str(R),'stdout':name+'.stdout','stderr':name+'.stderr','setupFiles':[],'setupFilesAfterEnv':[],'sharedCache':False,'services':0});return r
assert run('node-version',[str(T/'node'),'--version']).stdout.strip()==b'v24.15.0'
assert run('npm-version',[str(T/'npm'),'--version']).stdout.strip()==b'12.2.0'
r=run('current-offline-jest',[str(T/'node'),'--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(P/'jest.config.json'),'--runTestsByPath','tests/unit/domain/profile.test.ts','tests/unit/domain/sources.test.ts','tests/unit/domain/outcomes.test.ts','tests/unit/runtimeMemory/repository.test.ts','tests/unit/runtimeMemory/services.test.ts','tests/unit/runtimeMemory/public-boundary.test.ts','tests/unit/runtimeMemory/public-closure.test.ts','--runInBand','--no-cache','--json','--outputFile',str(P/'jest-results.json')])
(P/'command-receipts.json').write_text(json.dumps({'commands':checks,'actualServices':0,'actualCredentialsOrJWT':False,'nativeManagedAccepted':False},indent=2)+'\n')
assert r.returncode==0,r.stderr.decode()[-1000:]
j=json.loads((P/'jest-results.json').read_bytes());assert j['numTotalTestSuites']==7 and j['numFailedTests']==0 and j['numPendingTests']==0 and j['numTodoTests']==0
print(json.dumps({k:j[k] for k in ['success','numTotalTestSuites','numTotalTests','numPassedTests','numFailedTests','numPendingTests']}))
