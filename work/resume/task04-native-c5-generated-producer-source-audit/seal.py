import os,json,hashlib,pathlib,stat,datetime
R=pathlib.Path('/workspace/Project-Cortex');W=R/'work/resume/task04-native-c5-generated-producer-source-audit';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-generated-producer-source-audit';T=pathlib.Path('/dev/shm/cortex-native-c5-generated-producer-source-audit')
H=lambda b:hashlib.sha256(b).hexdigest()
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  before=os.fstat(fd);chunks=[]
  while True:
   b=os.read(fd,1048576)
   if not b:break
   chunks.append(b)
  after=os.fstat(fd);literal=os.lstat(p)
  ident=lambda s:{k:getattr(s,k) for k in ['st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns']}
  assert ident(before)==ident(after)==ident(literal)
  return b''.join(chunks),ident(before)
 finally:os.close(fd)
contexts=['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','_goals/convex-backend-runtime-2026-10-02/implementation-prompt.md','_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md','work/resume/task04-c5-fresh-review-handoff.md','_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-finite-recipe-audit-c3/report.md','_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-finite-recipe-audit-c3/per-id-inventory.json','_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-finite-recipe-audit-c3/source-evidence.json','_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-closed-launcher-c5/report.md']
contextRows=[]
for p in contexts:
 b,i=held(R/p);back=T/('context-'+H(b)+'.bytes');back.write_bytes(b);contextRows.append({'source':p,'bytes':len(b),'sha256':H(b),'identity':i,'backing':str(back)})
(Q/'context-pins.json').write_text(json.dumps(contextRows,indent=2)+'\n')
def membership(root):
 rows=[]
 for base,dirs,files in os.walk(root,followlinks=False):
  for name in sorted(dirs+files):
   p=pathlib.Path(base)/name;rel=str(p.relative_to(root))
   if rel=='selfseal.json':continue
   s=os.lstat(p)
   if stat.S_ISLNK(s.st_mode):rows.append({'path':rel,'kind':'symlink','literalTarget':os.readlink(p)})
   elif stat.S_ISDIR(s.st_mode):rows.append({'path':rel,'kind':'directory'})
   elif stat.S_ISREG(s.st_mode):
    b,i=held(p);rows.append({'path':rel,'kind':'regular','bytes':len(b),'sha256':H(b),'identity':i})
   else:raise RuntimeError('unsupported literal member '+str(p))
 return sorted(rows,key=lambda r:r['path'])
summary={}
for root in [W,T,Q]:
 rows=membership(root);obj={'root':str(root),'scope':'SELF_ONLY_SOURCE_AID_NOT_CANDIDATE_OR_ACCEPTANCE','excludedExactly':['selfseal.json'],'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'literalMemberCount':len(rows),'members':rows}
 seal=root/'selfseal.json';seal.write_text(json.dumps(obj,indent=2)+'\n');assert membership(root)==rows
 b,i=held(seal);summary[str(root)]={'sealSHA256':H(b),'sealBytes':len(b),'literalMembers':len(rows),'verifiedImmediately':True}
print(json.dumps(summary,indent=2))
