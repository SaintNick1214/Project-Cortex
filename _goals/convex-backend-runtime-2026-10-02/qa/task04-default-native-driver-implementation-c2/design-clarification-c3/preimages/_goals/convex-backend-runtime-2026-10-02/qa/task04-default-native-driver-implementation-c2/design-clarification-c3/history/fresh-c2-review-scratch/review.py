import pathlib,json,hashlib,datetime,subprocess,sys,os
R=pathlib.Path('/workspace/Project-Cortex'); Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'; O=Q/'task04-driver-c2-staging-money-clarification-review'; W=R/'work/resume/task04-driver-c2-staging-money-clarification-review'; S=Q/'task04-default-native-driver-implementation-c2/design-clarification-c2'
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(b):return hashlib.sha256(b).hexdigest()
def write(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
def row(p):
 b=p.read_bytes();return {'path':str(p.relative_to(R)),'bytes':len(b),'sha256':digest(b)}
refs=[R/'AGENTS.md',R/'.agents/CODEX-RUNTIME.md',R/'.agents/PROJECT-PROFILE.md',R/'.agents/roles/pessimistic-judge.md',R/'.agents/skills/judge-task/SKILL.md',R/'_research/convex-ai-gateway-2026-10-02/decision-gates.md',R/'_goals/convex-backend-runtime-2026-10-02/goal.md',R/'_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md']
for name in ['task04-default-native-driver-design-c4','task04-managed-filter-clarification-c2-review','task04-observer-stream-start-clarification-c1-review','task04-default-native-driver-implementation-c1-review']:
 d=Q/name
 refs += [p for p in d.iterdir() if p.name in ['report.md','proposal.md','initial14-identities.json','check-plan.md']]
refs += sorted((Q/'task04-default-native-driver-design-c4/contracts').glob('*.md'))
refs += [Q/n for n in ['task04-default-native-driver-design-c4-coordinator-acceptance.json','task04-managed-filter-clarification-c2-coordinator-acceptance.json','task04-observer-stream-start-clarification-c1-coordinator-acceptance.json']]
refs += [Q/'task04-default-native-driver-implementation-c1/design-clarification-c2/proposal.md',Q/'task04-default-native-driver-implementation-c1/observer-stream-start-clarification-c1/proposal.md']
refs += sorted(S.rglob('*'));refs=[p for p in refs if p.is_file()];refs=list(dict.fromkeys(refs))
start=utc(); pre=[row(p) for p in refs];write(O/'source-pre.json',pre)
for p in refs:
 b=p.read_bytes();dest=O/'preimages'/digest(b);dest.parent.mkdir(exist_ok=True);dest.write_bytes(b)
write(O/'preimage-index.json',pre)
files=[{'path':str(p.relative_to(S)),'bytes':p.stat().st_size,'sha256':digest(p.read_bytes())} for p in sorted(S.rglob('*')) if p.is_file() and p!=S/'manifest.json']
m=json.loads((S/'manifest.json').read_text());assert sorted(files,key=lambda x:x['path'])==sorted(m['files'],key=lambda x:x['path'])
assert digest((S/'manifest.json').read_bytes())=='387dd064242a6d339a964730f2f75a84948f1e98ccf73220b6af2c122e01e935'
write(O/'subject-closure.json',{'manifestSHA256':digest((S/'manifest.json').read_bytes()),'files':files,'excludesOnly':'manifest.json','symlinks':[str(p.relative_to(S)) for p in S.rglob('*') if p.is_symlink()]})
script=W/'dummy.mjs';before=row(script);write(O/'dummy-source-pre.json',before);(O/'preimages'/before['sha256']).write_bytes(script.read_bytes())
argv=['node',str(script)];a=utc();r=subprocess.run(argv,cwd=R,capture_output=True);z=utc();(O/'dummy.stdout').write_bytes(r.stdout);(O/'dummy.stderr').write_bytes(r.stderr);write(O/'dummy-run.json',{'argv':argv,'cwd':str(R),'startUTC':a,'endUTC':z,'exit':r.returncode,'purpose':'DUMMY DESIGN MODELS ONLY, not subject implementation or native certification'});write(O/'dummy-source-post.json',row(script));assert row(script)==before;assert r.returncode==0
post=[row(p) for p in refs];write(O/'source-post.json',post);assert pre==post
write(O/'review-run.json',{'argv':sys.argv,'cwd':os.getcwd(),'startUTC':start,'endUTC':utc(),'exit':0,'discovery':{'referenceFiles':len(refs),'subjectFilesExcludingOnlySelf':len(files),'dummyGroups':10,'skips':0},'earlyInteractiveReads':'Exact historical startUTC/raw stderr NOT_CAPTURED; no retrospective receipts invented. Formal fresh capture and controls above are complete.'})
print(json.dumps({'references':len(refs),'subjectFiles':len(files),'sourceUnchanged':pre==post,'dummyExit':r.returncode}))
