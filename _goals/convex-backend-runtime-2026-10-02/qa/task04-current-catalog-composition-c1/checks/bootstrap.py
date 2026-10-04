import pathlib,json,re,hashlib,datetime,shutil
root=pathlib.Path('/workspace/Project-Cortex');base=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-composition-c1';goal='_goals/convex-backend-runtime-2026-10-02/qa/'
start=datetime.datetime.now(datetime.timezone.utc).isoformat(); files=set()
for folder in ['convex-dev','src/domain','src/auth']:
 files.update(str(p.relative_to(root)) for p in (root/folder).rglob('*') if p.is_file() and p.suffix in ['.ts','.js','.json'])
files.update(['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/implementation-executor.md','package.json','package-lock.json','convex.json','tsconfig.json','jest.config.mjs',goal+'task04-current-unit-repair-backlog.json',goal+'task04-model-drift-charge-only-c1-coordinator-acceptance.json',goal+'task03b2d/inventory.mjs'])
strict=goal+'task03-artifact-schema-index-repair/strict-compose.mjs';text=(root/strict).read_text();constants=json.loads(text.split('const constants = ')[1].split(';\nconst hash')[0]);files.add(strict)
for name in constants['inputHashes']:
 files.add(name);files.add(goal+'task03-artifact-schema-index-repair/archive/'+name)
for name in constants['preHashes']:files.add(goal+'task03-artifact-schema-index-repair/archive/'+name)
files.update([goal+'task03-artifact-schema-index-repair/native-probe.mts',goal+'task03-artifact-schema-index-repair/pre-edit-native.json',goal+'task03b2f-asset-foundation/original/native-validators17.json'])
tests=['tests/unit/runtimeAssetUnavailableAuth/closure.test.ts','tests/unit/runtimeWorkerAuth/admin-catalog.test.ts','tests/unit/runtimeArtifactAuth/schema-indexes.test.ts','tests/unit/runtimeArtifactAuth/inventory.test.ts'];files.update(tests)
for folder in ['task04-current-offline-unit-check','task04-current-schema-index-offline-check']:
 for p in (root/goal/folder).iterdir():
  if p.is_file():files.add(str(p.relative_to(root)))
# Closed recursive relative import closure; public source only, no env file reads.
queue=list(files)
while queue:
 name=queue.pop();p=root/name
 if p.suffix not in ['.ts','.js','.mjs','.mts']:continue
 for spec in re.findall(r'(?:from\s+|import\s*)[\'\"](\.[^\'\"]+)[\'\"]',p.read_text()):
  raw=p.parent/spec;options=[raw,raw.with_suffix('.ts'),raw.with_suffix('.js'),raw/'index.ts'] if raw.suffix else [raw,raw.with_suffix('.ts'),raw.with_suffix('.js'),raw/'index.ts']
  selected=next((q.resolve() for q in options if q.is_file()),None)
  if selected and selected.is_relative_to(root) and 'node_modules' not in selected.parts:
   rel=str(selected.relative_to(root));assert selected.name not in ['env.ts','.env','.env.local','.env.test']
   if rel not in files:files.add(rel);queue.append(rel)
rows=[]
for name in sorted(files):
 p=root/name;data=p.read_bytes();target=base/'preimages'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);rows.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(base/'source-pre.json').write_text(json.dumps({'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':rows,'scope':'public source and bounded frozen contracts only; no env/private/runtime'},indent=2)+'\n')
# Preserve entire earlier failure outputs; inspect four complete failureMessages without truncation.
results=json.loads((root/goal/'task04-current-offline-unit-check/outcomes.json').read_text())
selected=[r for r in results['testResults'] if any(r['name'].endswith(t) for t in tests)]
assert len(selected)==4
(base/'original-four-failures.json').write_text(json.dumps(selected,indent=2)+'\n')
for r in selected:
 print(r['name']);print(r['message'])
(base/'original-tests.json').write_text(json.dumps(tests,indent=2)+'\n')
(base/'exploration-gap.json').write_text(json.dumps({'scope':'read-only discovery before bootstrap','exactUTC':'NOT_CAPTURED','raw':'terminal conversation retains results; full immutable original four failure outputs copied and extracted','probes':['cat absent jest.config.js','cat absent task03b2d/frozen-catalog.json','initial broad stdout read truncated; complete four outputs later extracted from outcomes.json'],'noNative':'NOT_RUN'},indent=2)+'\n')
print(json.dumps({'sourcePins':len(rows),'fourOriginalFailures':len(selected),'startUTC':start}))
