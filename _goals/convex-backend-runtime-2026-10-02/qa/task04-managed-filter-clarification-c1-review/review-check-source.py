import datetime, hashlib, json, pathlib, subprocess

root = pathlib.Path('/workspace/Project-Cortex')
out = root / '_goals/convex-backend-runtime-2026-10-02/qa/task04-managed-filter-clarification-c1-review'
subject = root / '_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c1/design-clarification-c1'
def utc(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def h(data): return hashlib.sha256(data).hexdigest()
def write(name, value): (out/name).write_text(json.dumps(value, indent=2)+'\n')
def snapshot():
    return [{'path': str(p.relative_to(subject)), 'bytes': p.stat().st_size, 'sha256': h(p.read_bytes())} for p in sorted(subject.rglob('*')) if p.is_file()]
pre=snapshot(); write('source-pre.json', pre)
manifest=json.loads((subject/'manifest.json').read_text())
actual={x['path']:x for x in pre if x['path']!='manifest.json'}
assert set(actual)=={x['path'] for x in manifest['files']}
assert all(actual[x['path']]==x for x in manifest['files'])
assert h((subject/'manifest.json').read_bytes())=='a1bf717af79f850317632a12a48807f3190ea37628c3486e539184ca0e322cf5'
assert h((subject/'proposal.md').read_bytes())=='2d4a5c21fb6b526db205e393da0c3633d8bc442161aa5154182dce46475cf321'
refs=['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','package.json','node_modules/convex/package.json','node_modules/convex/src/server/vector_search.ts','node_modules/convex/src/server/impl/vector_search_impl.ts','_goals/convex-backend-runtime-2026-10-02/implementation-prompt.md','_goals/convex-backend-runtime-2026-10-02/tasks/01-qualification.md','_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md','_goals/convex-backend-runtime-2026-10-02/tasks/14-client-extensions.md']
base='_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-design-c4/'
refs += [base+x for x in ['proposal.md','contracts/managed-fixture.md','contracts/receipt-state.md','contracts/hash-recovery.md','check-plan.md']]
refs += ['_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c1/fixture/convex/canonical.ts']
argv=['cat',*refs]; start=utc(); run=subprocess.run(argv,cwd=root,capture_output=True); end=utc()
(out/'references.stdout').write_bytes(run.stdout); (out/'references.stderr').write_bytes(run.stderr)
write('references-run.json',{'argv':argv,'cwd':str(root),'startUTC':start,'endUTC':end,'exit':run.returncode,'classification':'READ_ONLY_CONTEXT; mutable helper is not a judged subject'})
assert run.returncode==0
write('reference-hashes.json',[{'path':p,'sha256':h((root/p).read_bytes())} for p in refs])
# DUMMY ambiguity demonstration, not proposed extra codec, native or managed evidence.
dummy={'domain':'cortex.experiment.scope-profile.v1','version':1,'tenantHash':'1'*64,'spaceHash':'2'*64,'ownerHash':'3'*64,'profileHash':'4'*64}
data=json.dumps(dummy,sort_keys=True,separators=(',',':')).encode()
write('dummy-ambiguity.json',{'classification':'DUMMY_ONLY_NONNORMATIVE','canonical':data.decode(),'canonicalBytes':len(data),'sha256Utf8Canonical':h(data),'exampleAlternativePrefix':'ASCII decimal byte length + colon + same UTF8 canonical JSON; illustrative only, unspecified by proposal','sha256IllustrativeLengthPrefixed':h(str(len(data)).encode()+b':'+data),'different':h(data)!=h(str(len(data)).encode()+b':'+data)})
post=snapshot(); write('source-post.json',post); assert pre==post
write('closure-check.json',{'utc':utc(),'sourcePreEqualsPost':True,'recursiveSubjectFilesIncludingManifest':len(pre),'manifestListedFiles':len(actual),'fullManifestMatch':True,'failures':[],'discovery':'Exactly proposal and four retained typecheck-failure files; all five read, source manifest separately hash checked','skips':['No native/index/services/provider/network/paid/codegen/deploy checks: design-only scope','No application suites or mutable implementation verdict; downstream required gates remain NOT_RUN'],'dummyExamples':1})
print(json.dumps({'closure':'PASS','frozenFiles':len(actual),'dummyAmbiguity':'different hashes','utc':utc()}))
