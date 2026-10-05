"""Read-only source aid. Never imports or launches candidate/original JavaScript."""
from pathlib import Path
import json, hashlib, re, datetime, os, stat
R=Path('/workspace/Project-Cortex')
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-writer-role-audit'
W=R/'work/resume/task04-native-c5-writer-role-audit'
C=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c5'
M=Path('/tmp/cortex-native-c5-closed-launcher-c5/mirror')
H=lambda b:hashlib.sha256(b).hexdigest()
pins={}
def read(p):
 p=Path(p); p=p if p.is_absolute() else R/p
 s=p.lstat(); assert stat.S_ISREG(s.st_mode) and not p.is_symlink()
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd); chunks=[]
  while True:
   b=os.read(fd,1048576)
   if not b: break
   chunks.append(b)
  b=b''.join(chunks); z=os.fstat(fd)
 finally: os.close(fd)
 ident=lambda x:tuple(getattr(x,'st_'+k) for k in ('dev','ino','size','mtime_ns','ctime_ns'))
 assert ident(s)==ident(a)==ident(z)==ident(p.lstat())
 pins[str(p)]={'path':str(p),'bytes':len(b),'sha256':H(b)}
 return b
audit=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-finite-recipe-audit-c3'
inventory=json.loads(read(audit/'per-id-inventory.json'))
lineage=json.loads(read(C/'mirror-source-transform-map.json'))
prepared=json.loads(read(C/'prepared-source-inputs.json'))
registry=read(C/'command-registry.mjs').decode()
metadata_names=re.search(r'const mutableMetadata=new Set\(\[([^\]]+)\]\)',registry).group(1)
names=re.findall(r"'([^']+)'",metadata_names)
profiles=['extension','regression','extra']
qa={k:M/'_goals/convex-backend-runtime-2026-10-02/qa'/('task04-model-drift-native-'+k+'-preparation-c5') for k in profiles}
metadata={str(root/name) for root in qa.values() for name in names}|{str(root/'evidence/final-freeze-verification.json') for root in qa.values()}
mapped={r['destination']:r for r in lineage['inputs']}
entries={}; candidates=[]
for c in inventory['commands']:
 p=c['entry']['path']
 if p not in entries:
  b=read(p); assert len(b)==c['entry']['bytes'] and H(b)==c['entry']['sha256']; entries[p]=b.decode()
 for n,line in enumerate(entries[p].splitlines(),1):
  if re.search(r'writeFileSync|appendFileSync|renameSync|unlinkSync|\.writeFile\(',line):
   literals=re.findall(r"['\"]([^'\"\n]{1,160})['\"]",line)
   candidates.append({'id':c['id'],'source':str(R/p),'line':n,'lineSHA256':H(line.encode()),'filenameCandidates':[x for x in literals if x.endswith(('.json','.mjs','.ts','.text'))]})
recipes={
 'runner-closure.mjs': [('runner-dependency-inventory.json',3)],
 'dependency-tiers.mjs':[('dependency-tiers.json',2)],
 'temp-public-freeze.mjs':[('runtime-freeze.json',1),('qa-manifest.json',1)],
 'freeze-after-scratch.mjs':[('runtime-freeze.json',4),('qa-manifest.json',5),('evidence/final-freeze-verification.json',5)],
 'journal-semantic-domains.mjs':[('c4-journal-semantic-domain-proof.json',1)]}
outputs=[]; lines=[]
for src,rows in recipes.items():
 p=R/'work/resume/task04-model-drift-native-preparation-c5'/src
 b=read(p); source=b.decode().splitlines()
 for name,n in rows:
  line=source[n-1]; assert name in line
  lines.append({'source':str(p),'line':n,'lineSHA256':H(line.encode()),'exactSourceLine':line})
  for kind in profiles:
   dest=str(qa[kind]/name); row=mapped.get(dest)
   outputs.append({'writer':src,'profile':kind,'exactMirrorOutput':dest,'role':'DECLARED_MUTABLE_METADATA' if dest in metadata else 'IMMUTABLE_IF_MAPPED','mappedInput':row is not None,'initialMappedSHA256':row['destinationSHA256'] if row else None,'immutableSourceClosureMember':row is not None and dest not in metadata})
for name in ['composition-engine.mjs','input-ledger.mjs','bridge-preload.cjs','root-launcher.mjs','root-child-bootstrap.mjs','compiler-session.mjs']:
 read(C/name)
for kind in profiles:
 p=R/'_goals/convex-backend-runtime-2026-10-02/qa'/('task04-model-drift-native-'+kind+'-preparation-c5')/'scripts/inventory.mjs'
 b=read(p)
 for n,l in enumerate(b.decode().splitlines(),1):
  if 'process.argv.includes' in l: lines.append({'source':str(p),'line':n,'lineSHA256':H(l.encode()),'exactSourceLine':l})
for p in ['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','_goals/convex-backend-runtime-2026-10-02/implementation-prompt.md','_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md','_research/convex-ai-gateway-2026-10-02/decision-gates.md','_research/convex-ai-gateway-2026-10-02/architecture.md']:
 read(p)
read(audit/'report.md');read(R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-c5-composition-c4-fresh-review/report.md')
observed={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'READ_ONLY_SOURCE_AID_NO_READINESS_VERDICT_NO_ORIGINAL_EXECUTION','sourcePins':list(pins.values()),'commandCount':len(inventory['commands']),'uniqueEntries':len(entries),'writerCandidatesConservativeNotReachability':candidates,'exactHostMetadataOutputs':outputs,'exactWriterAndVerifySourceLines':lines,'candidateMetadataNamesObserved':names,'preparedSourceRowsObserved':prepared['files'],'unclassifiedMappedHostOutputCount':sum(x['immutableSourceClosureMember'] for x in outputs)}
(Q/'source-evidence.json').write_text(json.dumps(observed,indent=2)+'\n')
print(json.dumps({'sourcePins':len(pins),'commands':observed['commandCount'],'entries':len(entries),'hostOutputRows':len(outputs),'unclassifiedMappedHostOutputCount':observed['unclassifiedMappedHostOutputCount']}))
