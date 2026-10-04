import datetime,gzip,hashlib,json,os,runpy,stat,sys
from pathlib import Path
OLD=Path('/workspace/Project-Cortex/work/resume/task04-evidence-transport-c4-c1-fresh-review')
e=runpy.run_path(str(OLD/'review.py'));R=e['R'];C=e['C'];P=e['Q'];T=e['T'];M=e['M'];PUBLIC=T/'public-packet';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1-fresh-review-cleanup';W=R/'work/resume/task04-evidence-transport-c4-c1-fresh-review-cleanup';read=e['read'];sha=e['sha'];meta=e['meta'];save=e['save'];now=e['now']
ROOT_ACCEPT=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1-coordinator-acceptance.json'
def sealcheck(root,name,pin):
 b,s=read(root/name);assert sha(b)==pin;manifest=json.loads(b);expected={r['path'] for r in manifest['files']};found=set();stack=[root]
 while stack:
  p=stack.pop()
  for child in p.iterdir():
   z=child.lstat()
   if stat.S_ISDIR(z.st_mode):stack.append(child)
   elif child!=root/name:found.add(str(child.relative_to(root)))
 assert found==expected
 for r in manifest['files']:
  b,s=read(root/r['path']);assert len(b)==r['bytes'] and sha(b)==r['sha256'] and s.st_nlink==1
  if 'mode' in r:assert stat.S_IMODE(s.st_mode)==r['mode']
 return {'root':str(root),'rows':len(expected),'manifest':meta(root/name),'exactSelfOnly':True}
def authseals():
 return [sealcheck(C,'qa-manifest.json','c8612ba3a6e8507485c7d47f364059397be23e56456f8b8d8f8c804a6fadeb5c'),sealcheck(R/'work/resume/task04-evidence-transport-c4-c1','work-manifest.json','362a6aced0e6540f07c767aeccacc01f9a3803c930abccdecca4faee34417593'),sealcheck(P,'qa-manifest.json','0a15543bcf258ca4814ac433d3e97eb9311d8239a284bad22b66ce4b2f6e9280'),sealcheck(OLD,'work-manifest.json','3866141fbd003ebf63b84cbe6b56227de73c6f220ce51adacf6619fd24a6a282')]
def directorymeta(s):return {'dev':s.st_dev,'ino':s.st_ino,'uid':s.st_uid,'mode':stat.S_IMODE(s.st_mode),'nlink':s.st_nlink}
def tree(p):
 rows=[];stack=[p]
 while stack:
  d=stack.pop();s=d.lstat();assert stat.S_ISDIR(s.st_mode) and s.st_uid==os.geteuid()
  rows.append({'relative':str(d.relative_to(p)),'kind':'directory',**directorymeta(s)})
  for c in d.iterdir():
   s=c.lstat();assert s.st_uid==os.geteuid()
   if stat.S_ISDIR(s.st_mode):stack.append(c)
   elif stat.S_ISREG(s.st_mode):assert s.st_nlink==1;rows.append({'relative':str(c.relative_to(p)),'kind':'file','bytes':s.st_size,'dev':s.st_dev,'ino':s.st_ino,'uid':s.st_uid,'mode':stat.S_IMODE(s.st_mode),'nlink':s.st_nlink,'blocks512':s.st_blocks})
   else:assert stat.S_ISLNK(s.st_mode);literal=os.readlink(os.fsencode(c));rows.append({'relative':str(c.relative_to(p)),'kind':'literal-symlink','bytes':len(literal),'sha256':sha(literal),'targetHex':literal.hex(),'dev':s.st_dev,'ino':s.st_ino,'uid':s.st_uid,'mode':stat.S_IMODE(s.st_mode),'blocks512':s.st_blocks})
 return sorted(rows,key=lambda r:r['relative'])
def rootproof(h,p):
 assert p in (M,PUBLIC) and p.parent==T
 f=h.directory(T)
 try:
  parent=os.fstat(f);assert parent.st_uid==os.geteuid();fd=os.open(p.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=f)
  try:s=os.fstat(fd);assert s.st_uid==os.geteuid();return {'path':str(p),'parent':directorymeta(parent),'root':directorymeta(s)}
  finally:os.close(fd)
 finally:os.close(f)
def remove_tree(h,p,expected):
 # ROOT scope is exactly the two sibling targets. Everything is unlinked relative to held ordinary descriptors.
 anchor=h.directory(T)
 try:
  a=os.fstat(anchor);assert (a.st_dev,a.st_ino,a.st_uid)==(expected['parent']['dev'],expected['parent']['ino'],expected['parent']['uid'])
  fd=os.open(p.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=anchor)
  try:
   s=os.fstat(fd);assert (s.st_dev,s.st_ino,s.st_uid)==(expected['root']['dev'],expected['root']['ino'],expected['root']['uid'])
   def walk(f):
    for n in os.listdir(f):
     s=os.stat(n,dir_fd=f,follow_symlinks=False);assert s.st_uid==os.geteuid()
     if stat.S_ISDIR(s.st_mode):
      child=os.open(n,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=f)
      try:z=os.fstat(child);assert (z.st_dev,z.st_ino,z.st_uid)==(s.st_dev,s.st_ino,s.st_uid);walk(child)
      finally:os.close(child)
      z=os.stat(n,dir_fd=f,follow_symlinks=False);assert (z.st_dev,z.st_ino,z.st_uid)==(s.st_dev,s.st_ino,s.st_uid);os.rmdir(n,dir_fd=f)
     else:
      assert stat.S_ISREG(s.st_mode) or stat.S_ISLNK(s.st_mode)
      if stat.S_ISREG(s.st_mode):assert s.st_nlink==1
      z=os.stat(n,dir_fd=f,follow_symlinks=False);assert (z.st_dev,z.st_ino,z.st_uid,z.st_size,z.st_mode)==(s.st_dev,s.st_ino,s.st_uid,s.st_size,s.st_mode);os.unlink(n,dir_fd=f)
   walk(fd);assert not os.listdir(fd)
  finally:os.close(fd)
  s=os.stat(p.name,dir_fd=anchor,follow_symlinks=False);assert (s.st_dev,s.st_ino)==(expected['root']['dev'],expected['root']['ino']);os.rmdir(p.name,dir_fd=anchor);os.fsync(anchor)
 finally:os.close(anchor)
def main():
 start=now();source_script=meta(Path(__file__));accept=meta(ROOT_ACCEPT);seals=authseals();h,idx,m,rows=e['load']()
 # Complete archive verification before any cleanup: missing/corrupt durable bytes HOLD here.
 objects=0;objectbytes=0
 for key,b in h.objects(C,idx,m):objects+=1;objectbytes+=len(b)
 assert objects==18995 and objectbytes==1215614313
 mirror,current=e['closure'](M,rows,False);prior=json.loads(read(P/'mirror-full-results.json')[0]);assert mirror['recordMetadataSha256']==prior['recordMetadataSha256']
 source,source_rows=e['closure'](R,rows,True);before=json.loads(read(P/'source-after-public-inputs-results.json')[0]);assert source['recordMetadataSha256']==before['recordMetadataSha256'] and source['negativeHardlinkTopology']==before['negativeHardlinkTopology']
 copies=json.loads(read(P/'public-input-copy-results.json')[0])['files'];expected={r['path'] for r in copies};found=set()
 for d,sub,files in os.walk(PUBLIC,followlinks=False):
  assert stat.S_IMODE(Path(d).lstat().st_mode)==0o755
  for n in files:found.add(str((Path(d)/n).relative_to(PUBLIC)))
 assert found==expected
 for r in copies:
  b,s=read(PUBLIC/r['path']);assert sha(b)==r['sha256'] and len(b)==r['bytes'] and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o644
 targetproof=[rootproof(h,p) for p in [M,PUBLIC]];inventories={str(p):tree(p) for p in [M,PUBLIC]};backing=Q/'cleanup-before-target-inventories.json.gz'
 with backing.open('xb') as f:f.write(gzip.compress(json.dumps(inventories,separators=(',',':')).encode(),mtime=0))
 before_result={'utcPRE':start,'utcPOST':now(),'sourceScriptPRE':source_script,'coordinatorAcceptance':accept,'frozenSeals':seals,'archiveObjectsVerified':objects,'archiveRawBytesVerified':objectbytes,'mirrorFullAudit':mirror,'sourceBeforeAudit':source,'publicExactFileCopiesVerified':len(copies),'targets':targetproof,'completeTargetBeforeIdentities':meta(backing),'scope':'Prospective ROOT authorization to remove ONLY own mirror and public-packet; all other tmp history and frozen source/evidence preserved'}
 save(Q/'cleanup-before.json',before_result);print(json.dumps({'preverification':'PASS','targets':targetproof,'mirrorRows':148325,'publicFiles':38}),flush=True)
 # Rewalk every owned identity immediately before removal and require identical member set/metadata.
 for p in [M,PUBLIC]:assert tree(p)==inventories[str(p)]
 total_payload=0;total_blocks=0;terminal=0;directories=0
 for proof,p in zip(targetproof,[M,PUBLIC]):
  inv=inventories[str(p)];total_payload+=sum(r.get('bytes',0) for r in inv);total_blocks+=sum(r.get('blocks512',0)*512 for r in inv);terminal+=sum(r['kind']!='directory' for r in inv);directories+=sum(r['kind']=='directory' for r in inv);remove_tree(h,p,proof)
  assert not p.exists() and not p.is_symlink()
 post_source,post_records=e['closure'](R,rows,True);assert source['recordMetadataSha256']==post_source['recordMetadataSha256'] and source['negativeHardlinkTopology']==post_source['negativeHardlinkTopology'];post_seals=authseals();assert seals==post_seals
 save(Q/'cleanup-results.json',{'status':'PASS_EXACT_OWNED_TWO_TARGETS_REMOVED','utcPRE':start,'utcPOST':now(),'removedTargets':[str(M),str(PUBLIC)],'removedTerminalEntries':terminal,'removedDirectoriesIncludingTwoTargetRootsAndContainers':directories,'logicalPayloadBytesRemovedIncludingLiteralTargets':total_payload,'terminalAllocatedBytesRemovedFromActualStBlocks':total_blocks,'archiveOriginalObjectsRemain':objects,'archiveOriginalBytesRemain':objectbytes,'allEightSourceRowsUnchanged':148325,'sourceBeforeMetadataSha256':source['recordMetadataSha256'],'sourceAfterMetadataSha256':post_source['recordMetadataSha256'],'negative32Paths16PairsPreserved':True,'candidateAndReviewFourSealsUnchanged':post_seals,'allOtherOwnedTmpHistoryPreserved':True,'nativeSourceCustodyGitAcceptance':False});print(json.dumps({'cleanup':'PASS','removedTerminalEntries':terminal,'removedDirectories':directories,'logicalPayloadBytes':total_payload,'allocatedTerminalBytes':total_blocks,'sourceUnchanged':True}),flush=True)
if __name__=='__main__':main()
