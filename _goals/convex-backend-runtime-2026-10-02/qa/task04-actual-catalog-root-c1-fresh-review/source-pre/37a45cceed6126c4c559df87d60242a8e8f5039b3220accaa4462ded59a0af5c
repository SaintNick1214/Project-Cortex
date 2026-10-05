import pathlib,json,os,hashlib,datetime,subprocess,sys
R=pathlib.Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';O=Q/'task04-actual-catalog-root-c1-fresh-review';W=R/'work/resume/task04-actual-catalog-root-c1-fresh-review';C=Q/'task04-current-catalog-release-c4';A=Q/'task04-current-catalog-root-execution-c1';shared=R/'work/resume/task04-current-catalog-release-c4'
def h(b):return hashlib.sha256(b).hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def dump(n,x):(O/n).write_text(json.dumps(x,indent=2)+'\n')
def tree(p):
 rows=[]
 for f in [p,*p.rglob('*')]:
  s=f.lstat();row=dict(path=str(f.relative_to(p)),dev=s.st_dev,ino=s.st_ino,mode=s.st_mode,size=s.st_size)
  if f.is_symlink():row['link']=os.readlink(f)
  elif f.is_file():row['sha256']=h(f.read_bytes())
  elif f.is_dir():row.pop('size')
  rows.append(row)
 return rows
def snapshot():
 paths={R/x['path'] for x in json.loads((C/'source-runtime.json').read_text())['sources']}
 for name in ['src','tests/unit','convex-dev']:paths.update(f for f in (R/name).rglob('*') if f.is_file())
 paths.update([R/'eslint.config.js',R/'tests/setup.ts',R/'node_modules/convex/src/browser/sync/web_socket_manager.ts'])
 for p in [C,A,W]:paths.update(f for f in p.glob('*') if f.is_file())
 rows=[];store=O/'source-pre'
 for f in sorted(paths):
  b=f.read_bytes();digest=h(b);rows.append(dict(path=str(f.relative_to(R)),bytes=len(b),sha256=digest));dest=store/digest
  if not dest.exists():dest.write_bytes(b)
 return rows
before=snapshot();dump('observed-source-before.json',before);sharedBefore=tree(shared);dump('shared-work-before.json',sharedBefore)
cmd=['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(W/'jest.config.mjs'),'--runInBand','--no-cache','--json','--outputFile',str(O/'actual-four-observed.json'),'--runTestsByPath','tests/unit/runtimeAssetUnavailableAuth/closure.test.ts','tests/unit/runtimeWorkerAuth/admin-catalog.test.ts','tests/unit/runtimeArtifactAuth/schema-indexes.test.ts','tests/unit/runtimeArtifactAuth/inventory.test.ts']
env={'PATH':os.environ['PATH'],'LANG':'C.UTF-8','TZ':'UTC','CI':'1','NO_COLOR':'1','NODE_OPTIONS':'--import '+str(W/'fs-audit.mjs')};start=stamp();code=1
try:
 with (O/'observed.stdout').open('xb') as out,(O/'observed.stderr').open('xb') as err:p=subprocess.run(cmd,cwd=R,env=env,stdout=out,stderr=err,timeout=180)
 code=p.returncode
finally:
 after=snapshot();dump('observed-source-after.json',after);sharedAfter=tree(shared);dump('shared-work-after.json',sharedAfter);dump('observed-receipt.json',dict(argv=cmd,recorderArgv=[sys.executable,__file__],cwd=str(R),start=start,end=stamp(),exit=code,sourceStable=before==after,sharedBeforeAfterExact=sharedBefore==sharedAfter,environment=env));assert before==after;assert sharedBefore==sharedAfter
assert code==0
entries=[json.loads(line) for f in sorted(O.glob('identity-*.jsonl')) for line in f.read_text().splitlines()];created=[x for x in entries if x['event']=='created'];assert len(created)==8,len(created)
for x in created:
 assert len([e for e in entries if e['path']==x['path'] and e['event']=='cleanup-after' and e['ino']==x['ino'] and e['dev']==x['dev'] and e['absent']])==1
 if '/private-' in x['path']:assert x['mode']==0o700
 assert not pathlib.Path(x['path']).exists()
result=json.loads((O/'actual-four-observed.json').read_text());actual=json.loads((A/'actual-four.json').read_text());names=lambda j:sorted(a['fullName'] for t in j['testResults'] for a in t['assertionResults']);assert names(result)==names(actual);assert [result[k] for k in ['numPassedTests','numFailedTests','numPendingTests','numPassedTestSuites']]==[454,0,0,4]
dump('observed-verification.json',dict(passed=454,failed=0,pending=0,suites=4,namesExact=True,sourceStable=True,sharedBeforeAfterExact=True,exclusiveCreated=created,cleanupAllExact=True,normalCLI=True,observation='Node preload observes core filesystem allocations/removal; original source/guard/test/CLI unchanged; child private source tools have own fixed guard environment.'))
print('PASS 454, exclusive scratch4/private4 identities and cleanup; shared existing full tree unchanged')
