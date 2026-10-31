import subprocess, pathlib, os, json, datetime, time, signal, sys
qa = pathlib.Path(__file__).resolve().parent
root = pathlib.Path.cwd()
files = ['tests/unit/runtimeAssetUnavailableAuth/closure.test.ts', 'tests/unit/runtimeUnavailableAuth/closure.test.ts', 'tests/unit/runtimeArtifactAuth/inventory.test.ts', 'tests/unit/tenant-scope.test.ts', 'tests/unit/runtimeAuth/provisioning.test.ts', 'tests/unit/memory-observer.test.ts']
mode = sys.argv[1]
if mode == 'affected':
 cmd = ['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--runTestsByPath',*files,'--runInBand','--forceExit=false','--testTimeout=10000','--json','--outputFile='+str(qa/(sys.argv[2]+'-results.json'))]; timeout = 90
elif mode == 'type': cmd = ['node','node_modules/typescript/bin/tsc','--noEmit','--pretty','false']; timeout = 90
elif mode == 'lint': cmd = ['node','node_modules/eslint/bin/eslint.js',*files,'tests/helpers/current-closure-fixtures.ts','--report-unused-disable-directives']; timeout = 60
else: raise SystemExit('Unknown mode')
env = {k:v for k,v in os.environ.items() if not any(x in k for x in ['TOKEN','SECRET','KEY','CONVEX','NEO4J','MEMGRAPH'])}
env.update({'CONVEX_URL':'https://unit.invalid','CORTEX_TEST_ENV_MODE':'explicit','CORTEX_EMBEDDING':'false','CORTEX_FACT_EXTRACTION':'false','CORTEX_GRAPH_SYNC':'false'})
start = datetime.datetime.now(datetime.timezone.utc).isoformat(); tick = time.monotonic()
with (qa/(sys.argv[2]+'.log')).open('w') as log:
 process = subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT,env=env,start_new_session=True)
 expired = False
 try: code = process.wait(timeout=timeout)
 except subprocess.TimeoutExpired:
  expired = True; os.killpg(process.pid,signal.SIGTERM)
  try: code = process.wait(timeout=5)
  except subprocess.TimeoutExpired: os.killpg(process.pid,signal.SIGKILL); code = process.wait()
receipt = {'command':cmd,'cwd':str(root),'nodeVersion':subprocess.check_output(['node','--version'],text=True).strip(),'startedAtUtc':start,'closedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedMs':round((time.monotonic()-tick)*1000),'exitCode':code,'timedOut':expired,'watchdogMs':timeout*1000,'unitOnly':True,'actualService':False,'credentialEnvironment':False,'selectedUrl':'https://unit.invalid','forceExit':False,'pid':process.pid,'processClosed':process.poll() is not None}
(qa/(sys.argv[2]+'-command.json')).write_text(json.dumps(receipt,indent=2)+'\n'); print(json.dumps(receipt))
