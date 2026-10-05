"""Compute a Git tree from a pinned base and blob rows without an index or writes.

Only metadata is read. Historical replay does not verify current source contents.
"""
from pathlib import Path
import os,re,json,hashlib,subprocess,time,resource,datetime
ROOT=Path('/workspace/Project-Cortex')
OBJ=Path('/dev/shm/cortex-root-storage-rescue-c5/transfer45-objects')
ALTERNATES=[Path('/dev/shm/cortex-root-storage-rescue-c5')/('transfer'+str(n)+'-objects') for n in (44,43,42)]
ALTERNATES += [Path('/tmp/cortex-root-storage-rescue')/('transfer'+str(n)+'-objects') for n in range(41,33,-1)]
ALTERNATES += [ROOT/'.git/objects']
ENV=os.environ.copy()
ENV.pop('GIT_INDEX_FILE',None)
ENV['GIT_OBJECT_DIRECTORY']=str(OBJ)
ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(map(str,ALTERNATES))
SHA=re.compile(r'[0-9a-f]{40}\Z')
def tree_hash(data):return hashlib.sha1(b'tree '+str(len(data)).encode()+b'\0'+data).hexdigest()
def expect(base,rows):
 assert SHA.fullmatch(base)
 pending={};seen=set();reads=0;modified=0;max_tree=0
 for row in rows:
  path=row['path'];assert type(path) is str and path not in seen
  seen.add(path);parts=path.split('/');assert parts and all(p and p not in ('.','..') and '\0' not in p for p in parts)
  assert row['mode'] in ('100644','100755','120000') and SHA.fullmatch(row['blob'])
  branch=pending
  for part in parts[:-1]:
   name=part.encode();assert not isinstance(branch.get(name),tuple)
   branch=branch.setdefault(name,{})
  name=parts[-1].encode();assert name not in branch
  branch[name]=(row['mode'].encode(),row['blob'])
 def edit(sha,changes):
  nonlocal reads,modified,max_tree
  entries={}
  if sha:
   data=subprocess.check_output(['git','cat-file','tree',sha],cwd=ROOT,env=ENV)
   assert tree_hash(data)==sha
   reads+=1;max_tree=max(max_tree,len(data));position=0
   while position<len(data):
    space=data.index(b' ',position);nul=data.index(b'\0',space+1)
    mode=data[position:space];name=data[space+1:nul];oid=data[nul+1:nul+21]
    assert mode in (b'40000',b'100644',b'100755',b'120000',b'160000') and name not in entries and len(oid)==20
    entries[name]=(mode,oid.hex());position=nul+21
   assert position==len(data)
  for name,change in changes.items():
   if isinstance(change,dict):
    old=entries.get(name)
    assert old is None or old[0]==b'40000'
    entries[name]=(b'40000',edit(old[1] if old else None,change))
   else:
    assert name not in entries or entries[name][0]!=b'40000'
    entries[name]=change
  ordered=sorted(entries,key=lambda name:name+(b'/' if entries[name][0]==b'40000' else b''))
  data=b''.join(entries[name][0]+b' '+name+b'\0'+bytes.fromhex(entries[name][1]) for name in ordered)
  max_tree=max(max_tree,len(data));modified+=1
  return tree_hash(data)
 result=edit(base,pending)
 return {'tree':result,'selectedPaths':len(seen),'baseTreesRead':reads,'changedDirectories':modified,'largestTreeMetadataBytes':max_tree}
if __name__=='__main__':
 plan_path=ROOT/'work/resume/connector-transfer-plan-45.json'
 plan_bytes=plan_path.read_bytes();plan=json.loads(plan_bytes)
 live_index=ROOT/'.git/index';before=hashlib.sha256(live_index.read_bytes()).hexdigest()
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 begin=time.monotonic();result=expect(plan['tree'],plan['rows'])
 assert result['tree']=='9b1994206110306524e9cd5c64f022cff5b94065' and result['selectedPaths']==607
 assert hashlib.sha256(live_index.read_bytes()).hexdigest()==before
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()==head
 output={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'SPARSE_READONLY_GIT_TREE_REPLAY_MATCHES_PUBLISHED45',**result,'elapsedSeconds':time.monotonic()-begin,'pythonPeakRSSKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'childPeakRSSKiB':resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,'sourcePlanSHA256':hashlib.sha256(plan_bytes).hexdigest(),'liveHead':head,'liveIndexSHA256':before,'gitWrites':False,'limits':'Historical plan/tree metadata replay only; no current source qualification or publication. No isolated index or blob body materialization. Future plans require fresh held source9/fullhash checks separately.'}
 path=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa/root-sparse-tree-expectation-replay-45.json'
 path.open('x').write(json.dumps(output,indent=2)+'\n')
 print(json.dumps(output))
