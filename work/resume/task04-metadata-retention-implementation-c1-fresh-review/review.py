import pathlib,json,hashlib,gzip,subprocess,datetime,sys,os
ROOT=pathlib.Path('/workspace/Project-Cortex'); os.chdir(ROOT)
B=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c1'
Q=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c1-fresh-review'
S=ROOT/'work/resume/task04-metadata-retention-implementation-c1'
def sha(x):return hashlib.sha256(x).hexdigest()
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def write(n,d):(Q/n).write_text(json.dumps(d,indent=2)+'\n')
def sealcheck(p,name):
 d=json.loads((p/name).read_text()); rows=d['files']; actual=sorted(str(x.relative_to(p)) for x in p.rglob('*') if x.is_file() and x!=p/name)
 assert actual==sorted(r['path'] for r in rows),(len(actual),len(rows))
 for r in rows:
  x=p/r['path'];st=x.stat();assert sha(x.read_bytes())==r['sha256'] and st.st_size==r['bytes'] and st.st_nlink==1 and oct(st.st_mode&0o777)==r['mode'],str(x)
 return {'sealSha256':sha((p/name).read_bytes()),'rows':len(rows),'allUnique':True}
def inputs():
 own=pathlib.Path(__file__).resolve().parent
 context=['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/roles/qa-judge.md','.agents/skills/judge-task/SKILL.md','.agents/skills/feature-orchestrator/SKILL.md','_research/prompts/convex-backend-runtime-2026-10-02.md','_research/convex-ai-gateway-2026-10-02/decision-gates.md','_research/convex-ai-gateway-2026-10-02/architecture.md','_goals/convex-backend-runtime-2026-10-02/goal.md','_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md']
 peers=B.parent; extra=[peers/'task04-metadata-retention-design-c2/proposal.md',peers/'task04-metadata-retention-c2-fresh-review/report.md',peers/'task04-metadata-retention-c2-coordinator-acceptance.json',B/'repair-freeze-scope-receipt.json',B/'freeze-input-check.stderr',B/'eslint.config.mjs']
 v=json.loads((B/'verification.json').read_text()); originals=[ROOT/r['frozen'] for r in v['assertionPreservation']]
 return sorted(set([x for p in [B/'fixture',B/'fixture-vm',B/'regression'] for x in p.rglob('*') if x.is_file()]+list(S.glob('*.py'))+[x for x in own.iterdir() if x.is_file() and x.suffix in ['.py','.mjs']]+([Q/'report.md'] if (Q/'report.md').exists() else [])+[B/'report.md',B/'verification.json',B/'requirements-outcomes.json',B/'candidate-installation.json']+[ROOT/p for p in context]+extra+originals))
def observe(files,save=False):
 rows=[];store=Q/'beforeimages';store.mkdir(exist_ok=True)
 for p in files:
  raw=p.read_bytes();h=sha(raw);st=p.stat();r={'path':str(p.relative_to(ROOT)),'sha256':h,'bytes':len(raw),'mode':oct(st.st_mode&0o777),'nlink':st.st_nlink,'mtimeNs':st.st_mtime_ns,'inode':st.st_ino}
  if save:
   dest=store/(h+'.gz')
   if not dest.exists():dest.write_bytes(gzip.compress(raw,mtime=0))
   assert gzip.decompress(dest.read_bytes())==raw and dest.stat().st_nlink==1
   r['beforeimage']=str(dest.relative_to(Q));r['encodedSha256']=sha(dest.read_bytes())
  rows.append(r)
 return rows
if sys.argv[1]=='run':
 tag=sys.argv[2];argv=sys.argv[3:];files=inputs(); pre=observe(files,True);write(tag+'-pre.json',{'utc':utc(),'files':pre});start=utc()
 p=subprocess.run(argv,capture_output=True);(Q/(tag+'.stdout')).write_bytes(p.stdout);(Q/(tag+'.stderr')).write_bytes(p.stderr)
 post=observe(files);write(tag+'-post.json',{'utc':utc(),'files':post});write(tag+'-receipt.json',{'utcStart':start,'utcEnd':utc(),'cwd':str(ROOT),'argv':argv,'exit':p.returncode,'stdoutSha256':sha(p.stdout),'stderrSha256':sha(p.stderr),'sourceBytesUnchanged':all(a['sha256']==b['sha256'] for a,b in zip(pre,post))});print(tag,p.returncode,p.stdout.decode(errors='replace')[-2500:],p.stderr.decode(errors='replace')[-1500:])
elif sys.argv[1]=='seals':
 d={'utc':utc(),'candidate':sealcheck(B,'qa-seal.json'),'scratch':sealcheck(S,'scratch-seal.json'),'reportSha256':sha((B/'report.md').read_bytes())};write('candidate-seal-verification.json',d);print(json.dumps(d))
