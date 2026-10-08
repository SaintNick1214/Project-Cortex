import pathlib,json,hashlib,os,datetime,subprocess,sys
R=pathlib.Path('/workspace/Project-Cortex'); Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'; A=Q/'task04-current-catalog-root-execution-c1'; C=Q/'task04-current-catalog-release-c4'; O=Q/'task04-actual-catalog-root-c1-fresh-review'; W=R/'work/resume/task04-actual-catalog-root-c1-fresh-review'
def h(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads(p.read_text())
def row(p,base):
 b=os.readlink(p).encode() if p.is_symlink() else p.read_bytes();return dict(path=str(p.relative_to(base)),bytes=len(b),sha256=h(b))
def tree(p):return sorted([row(f,p) for f in p.rglob('*') if f.is_file() or f.is_symlink()],key=lambda x:x['path'])
def closure(p,hash_,n):
 assert h((p/'qa-manifest.json').read_bytes())==hash_;m=read(p/'qa-manifest.json');rows=m.get('files',m.get('rows'));assert len(rows)==n
 actual={x['path']:x for x in tree(p) if x['path']!='qa-manifest.json'};assert set(actual)=={x['path'] for x in rows}
 for x in rows:assert actual[x['path']]=={k:x[k] for k in ['path','bytes','sha256']},x['path']
 return dict(count=n,manifestSHA256=hash_,exactClosure=True)
def snapshot():
 paths={R/x['path'] for x in read(C/'source-runtime.json')['sources']}
 for scope in ['src','tests/unit','convex-dev']:
  paths.update(p for p in (R/scope).rglob('*') if p.is_file())
 paths.update([R/'tests/setup.ts',R/'eslint.config.js',R/'node_modules/convex/src/browser/sync/web_socket_manager.ts',pathlib.Path(__file__)])
 for scope in [A,C,W]:paths.update(p for p in scope.glob('*') if p.is_file())
 rows=[];store=O/'source-pre';store.mkdir(exist_ok=True)
 for p in sorted(paths):
  b=p.read_bytes();x=row(p,R);rows.append(x);dest=store/x['sha256'];
  if not dest.exists():dest.write_bytes(b)
 return rows
before=snapshot();(O/'source-before.json').write_text(json.dumps(before,indent=2)+'\n'); start=datetime.datetime.now(datetime.timezone.utc).isoformat(); argv=[sys.executable,str(pathlib.Path(__file__)),*sys.argv[1:]]
try:
 result={};result['actualClosure']=closure(A,'be6c6bc5571b0deeacd010bb1d3e986b792ae92a60362044737af351738eb10b',2036);result['releaseClosure']=closure(C,'1c05d786b4da42bbfffcfe5bac3392295f2fba12a6091ac611fda048d5c9ee1d',2025)
 assert h((A/'report.md').read_bytes())=='fb15e378ea48781bab4f3fae64863923aadedb932c97dfe82fc0d726a63378fb'
 assert h((Q/'task04-catalog-release-c4-fresh-review/report.md').read_bytes())=='ba1f6a23ec2d6b869c7c57d11e8ff8b700e7db563289e572d2915efea9334335'
 rt=read(C/'source-runtime.json')['sources'];assert len(rt)==136;assert (C/'source-runtime.json').stat().st_size==27773;assert h((C/'source-runtime.json').read_bytes())=='0b95c86c703e9b73d1ed707e0dcd38805e5a3f3c408e2bbaa1a1ba3d7c532792'
 pre={x['path']:x for x in read(A/'source-before.json')};transition=read(C/'source-transition.json');changes={x['path']:x for x in transition['changedOnly']};unchanged=0
 for x in rt:
  assert row(R/x['path'],R)==x
  old=pre[x['path']];b=(A/'source-pre'/old['sha256']).read_bytes();assert len(b)==old['bytes'] and h(b)==old['sha256']
  if x['path'] in changes:
   change=changes[x['path']];assert old['sha256']==change['beforeSHA256'] and old['bytes']==change['beforeBytes'];assert x['sha256']==change['afterSHA256'] and x['bytes']==change['afterBytes'];assert (R/x['path']).read_bytes()==(C/'postimages'/x['path']).read_bytes()
  else:assert old==x;unchanged+=1
 assert unchanged==132; result['sourceTransition']=dict(rows=136,unchanged=132,exactPostimages=4,genuinePreByteCustody=True,manifestBytes=27773)
 checks=[]
 for p in sorted((A/'checks').iterdir()):
  j=read(p/'receipt.json');assert j['sourceBefore']==j['sourceAfter'] and j['stable'];assert j['start']<j['end']
  for x in j['sourceBefore']:
   b=(p/'source-pre'/x['sha256']).read_bytes();assert len(b)==x['bytes'] and h(b)==x['sha256']
  selected=[str(pathlib.Path(x).relative_to(R)) if pathlib.Path(x).is_absolute() else x for x in j['argv'] if x.endswith('.test.ts')];captured={x['path'] for x in j['sourceBefore']};missing=[x for x in selected if x not in captured]
  checks.append(dict(label=p.name,exit=j['exit'],stable=True,sourceCount=len(captured),selected=len(selected),missingBefore=missing,argv=j['argv']))
 result['retainedChecks']=checks
 final=next(x for x in checks if x['label']=='actual-root-offline-70-qualified-v2');assert final['selected']==70 and final['sourceCount']==338 and not final['missingBefore']
 old=next(x for x in checks if x['label']=='actual-root-offline-70');assert len(old['missingBefore'])==62
 def names(j):return sorted(a['fullName'] for t in j['testResults'] for a in t['assertionResults'])
 actual=read(A/'actual-four.json');frozen=read(C/'final-four.json');assert names(actual)==names(frozen) and len(names(actual))==454
 assert actual['numPassedTests']==454 and actual['numFailedTests']==0 and actual['numPendingTests']==0 and actual['numPassedTestSuites']==4
 broad=read(A/'actual-unit70-qualified-v2.json');assert [broad[k] for k in ['numPassedTests','numFailedTests','numPendingTests','numTotalTestSuites']]==[5772,7,0,70]
 failures=[dict(file=t['name'],name=a['fullName'],messages=a['failureMessages']) for t in broad['testResults'] for a in t['assertionResults'] if a['status']=='failed'];result['broadFailures']=failures
 result['names454Exact']=True
 result['lifecycleQualified']=read(A/'actual-lifecycle-qualified.json')['success'];assert result['lifecycleQualified']
 if '--replay' in sys.argv:
  scratch=R/'work/resume/task04-current-catalog-release-c4/test-scratch';sb=tree(scratch);(O/'scratch-before.json').write_text(json.dumps(sb,indent=2)+'\n')
  cfg=W/'jest.config.mjs';cfg.write_text("import config from '../../../jest.config.mjs';\nexport default {...config,rootDir:'/workspace/Project-Cortex',setupFiles:['/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-root-execution-c1/setup.mjs'],setupFilesAfterEnv:[],reporters:['default'],cacheDirectory:'/workspace/Project-Cortex/work/resume/task04-actual-catalog-root-c1-fresh-review/cache'};\n")
  cmd=['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(cfg),'--runInBand','--no-cache','--json','--outputFile',str(O/'actual-four-replay.json'),'--runTestsByPath',*changes]
  env={'PATH':os.environ['PATH'],'LANG':'C.UTF-8','TZ':'UTC','CI':'1','NO_COLOR':'1'}
  rb=snapshot();(O/'replay-source-before.json').write_text(json.dumps(rb,indent=2)+'\n');rs=datetime.datetime.now(datetime.timezone.utc).isoformat()
  with (O/'replay.stdout').open('xb') as out,(O/'replay.stderr').open('xb') as err:p=subprocess.run(cmd,cwd=R,env=env,stdout=out,stderr=err,timeout=180)
  re=datetime.datetime.now(datetime.timezone.utc).isoformat();ra=snapshot();(O/'replay-source-after.json').write_text(json.dumps(ra,indent=2)+'\n');(O/'replay-receipt.json').write_text(json.dumps(dict(argv=cmd,cwd=str(R),start=rs,end=re,exit=p.returncode,stable=rb==ra,environment=env),indent=2)+'\n')
  sa=tree(scratch);(O/'scratch-after.json').write_text(json.dumps(sa,indent=2)+'\n');assert sb==sa;assert rb==ra;assert p.returncode==0
  replay=read(O/'actual-four-replay.json');assert names(replay)==names(actual);assert replay['numPassedTests']==454 and replay['numFailedTests']==0 and replay['numPendingTests']==0
  result['independentActualFour']=dict(passed=454,failed=0,pending=0,suites=4,namesExact=True,sourceStable=True,scratchBeforeAfterExact=True)
 result['actualClosureAfter']=closure(A,'be6c6bc5571b0deeacd010bb1d3e986b792ae92a60362044737af351738eb10b',2036);result['releaseClosureAfter']=closure(C,'1c05d786b4da42bbfffcfe5bac3392295f2fba12a6091ac611fda048d5c9ee1d',2025)
 (O/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['retainedChecks','broadFailures']}));code=0
except Exception as e:
 import traceback;traceback.print_exc();code=1
finally:
 after=snapshot();(O/'source-after.json').write_text(json.dumps(after,indent=2)+'\n');(O/'review-receipt.json').write_text(json.dumps(dict(argv=argv,cwd=str(R),start=start,end=datetime.datetime.now(datetime.timezone.utc).isoformat(),exit=code,stable=before==after,bootstrapLimitation='Earlier instruction/inspection reads and creation of this recorder were not recorded; no retroactive source-before certification.'),indent=2)+'\n')
sys.exit(code)
