from pathlib import Path
import os, subprocess, time, json, signal, sys, tempfile
r=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
q=r/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task16-current-integration-ci1/installer-repair1'
tools='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin'
node=tools+'/node'
private=Path(tempfile.mkdtemp(prefix='cortex-installer-repair-',dir='/Users/SaintNick/.codex/tmp'))
(private/'home').mkdir()
env={'PATH':tools+':/opt/homebrew/bin:/usr/bin:/bin','CI':'true','CORTEX_TEST_ENV_MODE':'explicit','NO_COLOR':'1','HOME':str(private/'home'),'TMPDIR':str(private)}
def run(name,args,cwd,seconds=150):
    start=time.monotonic(); log=q/(name+'.log')
    with log.open('w') as out:
        p=subprocess.Popen(args,cwd=cwd,env=env,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
        natural=True
        try: code=p.wait(timeout=seconds)
        except subprocess.TimeoutExpired:
            natural=False; os.killpg(p.pid,signal.SIGTERM)
            try: code=p.wait(timeout=5)
            except subprocess.TimeoutExpired: os.killpg(p.pid,signal.SIGKILL);code=p.wait()
    receipt={'name':name,'argv':args,'cwd':str(cwd),'pid':p.pid,'exit':code,'naturalExit':natural,'seconds':round(time.monotonic()-start,3),'log':str(log),'serviceCredentials':False,'privateTemp':str(private),'pidAliveAfterWait':False}
    (q/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt),flush=True)
    return receipt
if __name__=='__main__':
    mode=sys.argv[1]
    cwd=r/'packages/cortex-cli'
    if mode=='red':
        results=[run('tsconfig-red1',[node,'scripts/test-runner.js','unit','--runInBand','--watchman=false','--runTestsByPath','src/utils/__tests__/additive-tsconfig.test.ts','src/utils/__tests__/runtime-backend.test.ts','--json','--outputFile='+str(q/'tsconfig-red1-results.json')],cwd)]
    else:
        results=[run('tsconfig-tests1',[node,'scripts/test-runner.js','unit','--runInBand','--watchman=false','--runTestsByPath','src/utils/__tests__/additive-backend.test.ts','src/utils/__tests__/additive-tsconfig.test.ts','src/utils/__tests__/runtime-backend.test.ts','--json','--outputFile='+str(q/'tsconfig-tests1-results.json')],cwd),run('cli-types1',[node,'../../node_modules/typescript/bin/tsc','--noEmit'],cwd),run('cli-build1',[node,'../../node_modules/typescript/bin/tsc'],cwd),run('cli-lint1',[node,'../../node_modules/eslint/bin/eslint.js','src/utils/init/additive-backend.ts','src/utils/__tests__/additive-backend.test.ts','src/utils/__tests__/additive-tsconfig.test.ts','src/utils/__tests__/runtime-backend.test.ts','--report-unused-disable-directives'],cwd)]
    (q/('checks-'+mode+'1.json')).write_text(json.dumps(results,indent=2)+'\n')
