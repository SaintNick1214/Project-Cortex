import sys, json, hashlib, gzip, datetime, traceback, re, os
from pathlib import Path
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';O=Q/'task04-native-source-tier-design-c1';W=R/'work/resume/task04-native-source-tier-design-c1'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
receipt={'argv':sys.argv,'utcPre':now(),'failures':[]};snap={};profiles={}
def preserve(path):
 p=R/path;assert p.is_file() and not p.is_symlink();b=p.read_bytes();key=p.relative_to(R).as_posix()
 if key not in snap:
  h=sha(b);packed=gzip.compress(b,mtime=0);name='preimages/'+h+'.gz';dest=O/name;dest.parent.mkdir(exist_ok=True)
  if not dest.exists():dest.write_bytes(packed)
  assert len(packed)<=5*1024*1024
  snap[key]={'path':key,'bytes':len(b),'sha256':h,'preimage':name}
 return b
def load(p):return json.loads(preserve(p))
try:
 for n in ['AGENTS.md','.agents/CODEX-RUNTIME.md','.agents/PROJECT-PROFILE.md','.agents/roles/pessimistic-judge.md','.agents/skills/judge-task/SKILL.md','_goals/convex-backend-runtime-2026-10-02/tasks/04-model-policy.md']:
  if (R/n).exists():preserve(n)
 for kind in ['extra','extension','regression']:
  base=(Q/('task04-model-drift-native-'+kind+'-preparation-c4')).relative_to(R).as_posix()
  tiers=load(base+'/dependency-tiers.json');runner=load(base+'/runner-dependency-inventory.json');tools=load(base+'/toolchain-evidence.json')
  freeze=load(base+'/runtime-freeze.json');src=load(base+'/source-inventory.json');deps=load(base+'/dependency-inventory.json');runtime=load(base+'/runtime-inputs.json')
  groups={'capsule':[base+'/'+row['path'] for row in freeze['files']], 'external':[row['path'] for row in runtime['externalSources']], 'accepted':[row['path'] for row in src['acceptedGateHashes']], 'product':[row['source'] for row in src['files'] if row['kind']!='baseline-generated-not-native-codegen'],'dependencies':[row['path'] for row in deps['inputs']], 'rpcRunner':[row['path'] for row in tiers['rpc']['runner']], 'rpcTools':[row['path'] for row in tiers['rpc']['tools']], 'boundaryRunner':[row['path'] for row in tiers['boundaryOnly']['runner']], 'boundaryTools':[row['path'] for row in tiers['boundaryOnly']['tools']]}
  allpaths=set(p for group in groups.values() for p in group)
  for p in sorted(allpaths):preserve(p)
  for row in runner['inputs']:
   assert snap[row['path']]['bytes']==row['bytes'] and snap[row['path']]['sha256']==row['sha256']
  graph=tiers['proof']['metafile']['inputs'];edges={p:[i['path'] for i in v['imports'] if not i.get('external')] for p,v in graph.items()}
  def closure(entries):
   seen=set();todo=list(entries)
   while todo:
    p=todo.pop()
    if p in seen:continue
    seen.add(p);todo.extend(edges.get(p,[]))
   return seen
  entryPrefix=base+'/scripts/'
  dispatchEntries=[entryPrefix+n for n in ['driver.mjs','qualify-owned.mjs','fault-child.mjs','fault-driver.mjs','fault-ledger.mjs','fault-setup.mjs','fault-recovery.mjs','cleanup.mjs','reconcile.mjs']]
  reached=closure(dispatchEntries);full=closure([entryPrefix+n for n in tiers['runtimeEntries']]);compiler='node_modules/typescript/lib/typescript.js'
  assert compiler in full and compiler not in reached
  parents=[p for p,es in edges.items() if compiler in es]
  dynamic=[]
  for p in sorted(allpaths):
   if p.startswith(base+'/scripts/') and p.endswith('.mjs'):
    text=(R/p).read_text()
    for lineNo,line in enumerate(text.splitlines(),1):
     if 'import(' in line or 'localRequire(' in line or 'spawn(' in line or 'spawnSync(' in line or 'owner.run(' in line or 'new Function(' in line:dynamic.append({'path':p,'line':lineNo,'text':line})
  rpcPaths=set(p for k,v in groups.items() if not k.startswith('boundary') for p in v)
  fullPaths=set(allpaths)
  candidateDrop=[compiler]
  profiles[kind]={'base':base,'groups':{k:{'rows':len(v),'bytes':sum(snap[p]['bytes'] for p in v)} for k,v in groups.items()},'rpcUniqueFiles':len(rpcPaths),'rpcUniqueBytes':sum(snap[p]['bytes'] for p in rpcPaths),'fullUniqueFiles':len(fullPaths),'fullUniqueBytes':sum(snap[p]['bytes'] for p in fullPaths),'runtimeEntries':tiers['runtimeEntries'],'dispatchEntries':dispatchEntries,'dispatchGraph':sorted(reached),'fullGraph':sorted(full),'edges':edges,'compilerParents':parents,'compilerInDispatchClosure':False,'compilerInUnionClosure':True,'dynamicAndRequireAndProcessSites':dynamic,'minimumCandidateRows':[snap[p] for p in candidateDrop],'retainedFullGraphUnchanged':True}
  (O/(kind+'-graph.json')).write_text(json.dumps(profiles[kind],indent=2)+'\n')
  preserve(base+'/report.md')
 # Read review constraints without collecting any credentials/private scratch.
 for name in ['task04-model-drift-native-parent-preparation-c3-review','task04-model-drift-native-source-preparation-c3-review','task04-model-drift-native-parent-preparation-c2-review']:
  if (Q/name/'report.md').exists():preserve(str((Q/name/'report.md').relative_to(R)))
 (O/'source-before.json').write_text(json.dumps({'utc':now(),'rows':list(snap.values())},indent=2)+'\n')
 post=[]
 for p,row in snap.items():
  b=(R/p).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'];post.append({'path':p,'bytes':len(b),'sha256':sha(b)})
 (O/'source-after.json').write_text(json.dumps({'utc':now(),'rows':post},indent=2)+'\n')
 receipt['profiles']={k:{x:v[x] for x in ['rpcUniqueBytes','fullUniqueBytes','compilerParents','compilerInDispatchClosure','compilerInUnionClosure']} for k,v in profiles.items()};receipt['sourcesVerifiedUnchanged']=len(post);receipt['exitCode']=0
except BaseException:
 receipt['failures'].append(traceback.format_exc());receipt['exitCode']=1
finally:
 receipt['utcPost']=now();(O/'investigation-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt));sys.exit(receipt['exitCode'])
