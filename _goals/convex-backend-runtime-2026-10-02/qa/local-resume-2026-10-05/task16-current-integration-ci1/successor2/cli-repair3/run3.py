import os, pathlib, subprocess, time, json, tempfile, hashlib, shutil
r=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
q=r/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task16-current-integration-ci1/successor2/cli-repair3'
t=pathlib.Path('/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin')
base=pathlib.Path(tempfile.mkdtemp(prefix='cortex-ci-command-repair3-',dir='/Users/SaintNick/.codex/tmp')).resolve()
(base/'home').mkdir(mode=0o700);(base/'tmp').mkdir(mode=0o700)
envfile=base/'exports';envfile.write_text('');envfile.chmod(0o600)
env={'PATH':f'{t}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin','HOME':str(base/'home'),'TMPDIR':str(base/'tmp'),'CI':'true','LANG':'C','NO_COLOR':'1','CORTEX_CI_AUTH_PRIVATE_KEY':'','CORTEX_TEST_ENV_MODE':'explicit'}
results=[]
def run(name,argv,timeout=180,cwd=r):
    started=time.time();log=q/(name+'.log')
    with log.open('wb') as out:
        p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
        try: code=p.wait(timeout=timeout); forced=False
        except subprocess.TimeoutExpired:
            import signal
            os.killpg(p.pid,signal.SIGTERM)
            try: code=p.wait(timeout=10)
            except subprocess.TimeoutExpired: os.killpg(p.pid,signal.SIGKILL);code=p.wait()
            forced=True
    try: os.kill(p.pid,0);absent=False
    except ProcessLookupError: absent=True
    result={'name':name,'argv':argv,'cwd':str(cwd),'pid':p.pid,'exit':code,'forced':forced,'seconds':round(time.time()-started,3),'pidAbsent':absent,'log':str(log),'logSHA256':hashlib.sha256(log.read_bytes()).hexdigest()}
    results.append(result);(q/'commands3.json').write_text(json.dumps({'node':str(t/'node'),'workspace':str(r),'workingRoot':str(base),'cleanEnvironmentNames':sorted(env),'commands':results},indent=2)+'\n')
    print(json.dumps(result),flush=True);return code
ok=False
try:
    code=run('prepare3',[str(t/'node'),'scripts/ci/command-fixtures.mjs','prepare','--directory',str(base/'fixtures'),'--env-file',str(envfile)],180)
    if code!=0: raise RuntimeError('prepare failed; see raw log')
    env.update(dict(line.split('=',1) for line in envfile.read_text().splitlines()))
    receipt=json.loads((base/'fixtures/receipt.json').read_text());(q/'prepared-inputs3.json').write_text(json.dumps(receipt,indent=2)+'\n')
    code=run('helper-tests3',[str(t/'node'),'--test','scripts/ci/command-fixtures.test.mjs'],30)
    if code!=0: raise RuntimeError('helper tests failed')
    code=run('cli-fast3',[str(t/'npm'),'run','test:fast','--workspace=@cortexmemory/cli','--','--runInBand'],240)
    ok=code==0
finally:
    cleanup=run('cleanup3',[str(t/'node'),'scripts/ci/command-fixtures.mjs','cleanup','--directory',str(base/'fixtures')],30)
    (q/'cleanup3.json').write_text(json.dumps({'cleanupExit':cleanup,'fixtureAbsent':not (base/'fixtures').exists(),'ownedWorkingRoot':str(base),'serviceCalls':0,'buildOrInstallInHelper':False,'commandsHadNoServiceCredentials':True},indent=2)+'\n')
print(json.dumps({'checksPASS':ok}),flush=True)
