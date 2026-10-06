import datetime, hashlib, json, os, subprocess
from pathlib import Path
repo=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
qa=repo/'_goals/convex-backend-runtime-2026-10-02/qa';q=qa/'task03-local-native-attempt3-2026-10-05'
out=Path(__file__).resolve().parent;mg=qa/'local-resume-2026-10-05/task03-attempt3-management-review'
node='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node'
npm='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/npm'
env=dict(os.environ);env['PATH']=str(Path(node).parent)+os.pathsep+env.get('PATH','');env['NODE_OPTIONS']='--require '+str(out/'offline-network-v2.cjs')
receipts={str(out):[],str(mg):[]}
def run(name,argv,directory=out,timeout=45):
    before=datetime.datetime.now(datetime.timezone.utc).isoformat()
    r=subprocess.run([str(v) for v in argv],cwd=repo,env=env,capture_output=True,timeout=timeout)
    (directory/(name+'.stdout')).write_bytes(r.stdout);(directory/(name+'.stderr')).write_bytes(r.stderr)
    receipt={'name':name,'argv':[str(v) for v in argv],'cwd':str(repo),'startedAt':before,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':r.returncode,'stdout':name+'.stdout','stderr':name+'.stderr','stdoutSha256':hashlib.sha256(r.stdout).hexdigest(),'stderrSha256':hashlib.sha256(r.stderr).hexdigest()}
    receipts[str(directory)].append(receipt)
    (directory/'command-receipts.json').write_text(json.dumps({'scope':'CREDENTIAL_FREE_INDEPENDENT_EXACT_SOURCE_REVIEW','commands':receipts[str(directory)],'candidateWrites':0,'privateByteReads':0,'serviceRequests':0},indent=2)+'\n')
    print(json.dumps({'name':name,'exitCode':r.returncode,'directory':directory.name}),flush=True)
    assert r.returncode==0,name
    return r.stdout
run('integrity-before',['python3','-B',out/'inspect-integrity.py','integrity-before'])
run('node-version',[node,'--version']);run('npm-version',[npm,'--version'])
run('actual-source-47-controls',[node,'--experimental-vm-modules',q/'attempt2/affected-controls.mjs'])
run('actual-filesystem-3-controls',[node,'--experimental-vm-modules',out/'readonly-boundaries.mjs','actual-filesystem-controls'])
run('conserved-28-cleanup-driver-controls',[node,'--experimental-vm-modules',q/'repair-cycle2/offline-repair-check.mjs'])
run('readonly-40-guard-controls',[node,'--experimental-vm-modules',out/'readonly-boundaries.mjs','guard-controls'])
run('source-preflight',[node,'--experimental-vm-modules',out/'readonly-boundaries.mjs','source-preflight'])
run('scoped-6-file-lint',[node,repo/'node_modules/eslint/bin/eslint.js','--config',q/'attempt2/eslint.config.mjs','--no-ignore','--max-warnings','0',q/'scripts/deploy.mjs',q/'scripts/incidental-custody.mjs',q/'scripts/guard.mjs',q/'attempt2/affected-controls.mjs',q/'attempt2-repair1/real-owned-custody-controls.mjs',q/'fresh-identity.mjs'])
for name in ['guard','incidental-custody','deploy']:
    run('syntax-'+name,[node,'--check',q/('scripts/'+name+'.mjs')])
raw=run('offline-vm',[node,'--experimental-vm-modules',mg/'offline-vm-harness.mjs'],mg)
(mg/'offline-vm-results.json').write_bytes(raw)
run('helper-syntax',[node,'--check',qa/'local-resume-2026-10-05/task03-attempt3-target-management.mjs'],mg)
run('guard-syntax',[node,'--check',q/'scripts/guard.mjs'],mg)
lint=run('lint',[node,repo/'node_modules/eslint/bin/eslint.js','--config',q/'attempt2/eslint.config.mjs','--no-ignore','--max-warnings','0','--format','json',qa/'local-resume-2026-10-05/task03-attempt3-target-management.mjs',q/'scripts/guard.mjs'],mg)
(mg/'lint.json').write_bytes(lint)
print(json.dumps({'status':'PASS','newSourceChecks':47,'newFilesystemChecks':3,'newCleanupDriverChecks':28,'newGuardNegatives':40,'newManagementControls':json.loads(raw)['caseCount'],'networkDeniedAttempts':sum(json.loads(p.read_text())['deniedAttempts'] for p in (out/'tmp').glob('network-v2-*.json'))}))
