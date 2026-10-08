import datetime, hashlib, json, pathlib, subprocess, time
root=pathlib.Path('/workspace/Project-Cortex')
out=pathlib.Path('/tmp/task03b2d-compiler-review1-4crx_9fi')
qa=pathlib.Path('_goals/convex-backend-runtime-2026-10-02/qa/task03b2d')
cc=qa/'compiler-compatibility'
freeze=json.loads((root/cc/'source-freeze.json').read_text())
before=json.loads((root/cc/'before.json').read_text())
HEAD='cd5671449beb64ed1ca4a284a761cad60ab70525'
def sha(data): return hashlib.sha256(data).hexdigest()
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def git(*args): return subprocess.check_output(['git',*args],cwd=root)
def filehash(path): return sha((root/path).read_bytes())
monitored=['convex-dev/admin.ts','convex-dev/graphSync.ts','convex-dev/tsconfig.json','package.json','package-lock.json','convex.json','src/governance/index.ts']
monitored+=sorted(str(p.relative_to(root)) for p in (root/'tests/unit/runtimeWorkerAuth').rglob('*') if p.is_file())
monitored+=sorted(str(p.relative_to(root)) for p in (root/'convex-dev/_generated').rglob('*') if p.is_file())
def verify(phase):
 data={'observedAt':now(),'head':git('rev-parse','HEAD').decode().strip(),'indexSha256':sha(git('ls-files','--stage','-z')),'source':[],'preservedQa':[],'freezeArtifacts':[],'monitored':[],'originalCiReceipts':[],'gitStatus':git('status','--short').decode()}
 assert data['head']==HEAD
 for entry in freeze['sourceFiles']:
  path=entry['file']; original=git('show',f'{HEAD}:{path}'); current=(root/path).read_bytes()
  replacement=(b'Object.hasOwn(durations, options.period)',b'Object.prototype.hasOwnProperty.call(durations, options.period)') if path.endswith('governance.ts') else (b'Object.hasOwn(fields, key)',b'Object.prototype.hasOwnProperty.call(fields, key)')
  assert original.count(replacement[0])==1
  exact=current==original.replace(*replacement)
  assert exact and sha(original)==entry['beforeSha256'] and sha(current)==entry['sha256']
  data['source'].append({'file':path,'headSha256':sha(original),'observedSha256':sha(current),'exactSingleReplacement':exact})
 for group,target in [('preservedQa',before['preservedQa']),('freezeArtifacts',freeze['artifacts'])]:
  for entry in target:
   observed=filehash(entry['file']); match=observed==entry['sha256']; assert match,entry['file']
   data[group].append({**entry,'observedSha256':observed,'matches':match})
 for path in monitored:
  current=filehash(path); headhash=sha(git('show',f'{HEAD}:{path}'))
  assert current==headhash,path
  data['monitored'].append({'file':path,'sha256':current,'matchesHead':True})
 for entry in before['originalCiReceipts']:
  observed=filehash(entry['file']); data['originalCiReceipts'].append({**entry,'observedSha256':observed,'matchesExecutorBefore':observed==entry['sha256'],'provenance':'Parent-owned concurrent metadata receipt; no executor/judge write' if entry['file'].endswith('worker-closure-failures.json') else 'Original failed private backend CI log; must remain unchanged'})
  if entry['file'].endswith('.log'): assert observed==entry['sha256']
 (out/f'{phase}-verification.json').write_text(json.dumps(data,indent=2)+'\n')
 return data
initial=verify('before')
commands=[]
def run(name,argv):
 started=now(); began=time.monotonic()
 stdout=out/f'{name}.stdout.log'; stderr=out/f'{name}.stderr.log'
 with stdout.open('wb') as so,stderr.open('wb') as se: result=subprocess.run(argv,cwd=root,stdout=so,stderr=se)
 record={'name':name,'argv':argv,'cwd':str(root),'startedAt':started,'completedAt':now(),'elapsedSeconds':time.monotonic()-began,'exitCode':result.returncode,'stdout':str(stdout),'stderr':str(stderr),'sourceHashes':[{'file':e['file'],'sha256':filehash(e['file'])} for e in freeze['sourceFiles']],'hostCompilerConfigSha256':filehash('convex-dev/tsconfig.json')}
 commands.append(record);(out/f'{name}.command.json').write_text(json.dumps(record,indent=2)+'\n');(out/'commands.json').write_text(json.dumps(commands,indent=2)+'\n')
 print(name,result.returncode,flush=True);assert result.returncode==0,name
run('backend-types',['node','node_modules/typescript/bin/tsc','-p','convex-dev/tsconfig.json','--pretty','false'])
run('scoped-types',['node','node_modules/typescript/bin/tsc','-p',str(qa/'tsconfig.scoped.json'),'--pretty','false'])
run('lint',['node','node_modules/eslint/bin/eslint.js','convex-dev/admin.ts','convex-dev/governance.ts','convex-dev/graphSync.ts','convex-dev/runtimeWorkerAuth.ts','convex-dev/schema.ts','tests/unit/runtimeWorkerAuth','--report-unused-disable-directives'])
run('discovery',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(qa/'jest.scoped.cjs'),'--listTests','--runInBand','--no-cache','--cacheDirectory',str(out/'jest-cache')])
run('tests',['node','--experimental-vm-modules','node_modules/jest/bin/jest.js','--config',str(qa/'jest.scoped.cjs'),'--runInBand','--no-cache','--cacheDirectory',str(out/'jest-cache'),'--json','--outputFile',str(out/'tests.json')])
run('catalog',['node',str(qa/'inventory.mjs'),str(out/'catalog')])
run('diff-check',['git','diff','--check','--','convex-dev/governance.ts','convex-dev/runtimeWorkerAuth.ts'])
tests=json.loads((out/'tests.json').read_text());counts={k:tests[k] for k in ['success','numTotalTests','numPassedTests','numFailedTests','numPendingTests','numTotalTestSuites','numPassedTestSuites','numFailedTestSuites','numPendingTestSuites','numTodoTests']};assert counts['success'] and counts['numTotalTests']==counts['numPassedTests']==185 and counts['numTotalTestSuites']==counts['numPassedTestSuites']==3 and all(counts[k]==0 for k in ['numFailedTests','numPendingTests','numFailedTestSuites','numPendingTestSuites','numTodoTests'])
listtests=(out/'discovery.stdout.log').read_text().splitlines();assert sorted(listtests)==sorted(str(root/p) for p in ['tests/unit/runtimeWorkerAuth/admin-catalog.test.ts','tests/unit/runtimeWorkerAuth/governance.test.ts','tests/unit/runtimeWorkerAuth/graph.test.ts'])
catalog=json.loads((out/'catalog/public-path-inventory.json').read_text());canonical=json.loads((root/qa/'catalog/public-path-inventory.json').read_text());select=lambda d: sorted([e for e in d['endpoints'] if e['path'].split(':')[0] in ['admin','governance','graphSync']],key=lambda e:e['path'])
selected=select(catalog);assert selected==select(canonical);assert len(selected)==25 and len([e for e in selected if e['visibility']=='public'])==7 and len([e for e in selected if e['visibility']=='internal'])==18 and catalog['completeness']['unresolved']==[]
closure=json.loads((root/qa/'path-closure.json').read_text());actual={e['path']:e['visibility'] for e in selected};assert all(actual[e['path']]==e['actualVisibility'] for e in closure['entries'])
(out/'outcomes.json').write_text(json.dumps({'testCounts':counts,'discovery':listtests,'catalogCounts':catalog['completeness']['counts'],'selectedPaths':selected,'selectedExactlyCanonical':True,'original25DispositionsMatch':True,'unresolved':catalog['completeness']['unresolved'],'qualification':'Other endpoint registrations read only as unaccepted catalog context; no concurrent MF/B2A source is an accepted dependency'},indent=2)+'\n')
final=verify('after')
assert initial['source']==final['source'] and initial['monitored']==final['monitored']
assert initial['indexSha256']==final['indexSha256']
print(json.dumps({'out':str(out),'testCounts':counts,'preservedQa':len(final['preservedQa']),'freezeArtifacts':len(final['freezeArtifacts']),'monitoredHeadFiles':len(final['monitored']),'selectedD':len(selected),'original25DispositionsMatch':True}),flush=True)
