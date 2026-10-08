from pathlib import Path
import os,stat,json,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k)) for k in K}
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
  blocks=[]
  while b:=os.read(fd,65536):blocks.append(b)
  b=b''.join(blocks);assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p)) and len(b)==a.st_size
  return b,{'path':str(p),'identity':ident(a),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
 finally:os.close(fd)
verified=[];seals=[]
for root in (Q/'task04-c7-identity-disposition-aid',R/'work/resume/task04-c7-identity-disposition-aid'):
 raw,pin=held(root/'selfseal.json');seal=json.loads(raw);assert seal['excludes']==['selfseal.json']
 paths=[]
 def scan(p):
  for entry in sorted(os.scandir(p),key=lambda e:e.name):
   child=Path(entry.path)
   if child==root/'selfseal.json':continue
   assert not entry.is_symlink();paths.append(str(child.relative_to(root)))
   if entry.is_dir(follow_symlinks=False):scan(child)
 scan(root);assert sorted(paths)==sorted(seal['membership'])==sorted(row['path'] for row in seal['rows'])
 for row in seal['rows']:
  p=root/row['path'];expected=row['identity']['fields'];assert set(expected)==set(K) and all(type(v)is str for v in expected.values())
  if row['kind']=='directory':
   fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
   try:
    a=os.fstat(fd);assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p))==expected
    prefix=row['path']+'/';names=sorted(x[len(prefix):] for x in paths if x.startswith(prefix) and '/' not in x[len(prefix):]);assert sorted(os.listdir(p))==names
   finally:os.close(fd)
  else:
   b,z=held(p);assert z['identity']==expected and z['bytes']==row['bytes'] and z['sha256']==row['sha256'];verified.append(z)
 seals.append({'selfseal':pin,'rows':len(seal['rows']),'rootDirectoryCustody':'Not in supplied seal'})
W=R/'work/resume/task04-c7-identity-disposition-aid'
b,mpin=held(W/'identity-site-dispositions.json');mapping=json.loads(b);rows=mapping['rows'];assert len(rows)==501 and [row['originalSiteID'] for row in rows]==['ORIGINAL-'+str(n).zfill(3) for n in range(1,502)]
unresolved=sum('UNRESOLVED' in row['classification'] for row in rows);assert unresolved==369
assert sum(row['correspondenceMethod']=='equal-after-path-normalization' for row in rows)==338
copies=list((W/'copies').iterdir());assert len(copies)==113
for row in rows:
 b,z=held(W/'copies'/row['capturedCandidateFile']);assert z['sha256']==row['capturedCandidateFileSHA256']
 for candidate in row['currentCandidates']:assert b.decode().splitlines()[candidate['line']-1]==candidate['source']
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_PARTIAL_501_SITE_AID_SEALS_AND_MAPPING_VERIFIED_NOT_ACCEPTANCE','seals':seals,'files':len(verified),'verifiedRegularBytes':sum(p['bytes'] for p in verified),'mapping':mpin,'originalSites':501,'capturedCodeFiles':113,'equalLexicalCorrespondences':338,'changedLexicalCorrespondences':163,'classificationContainsUnresolved':369,'limits':'Full own seals/current9/bytes/hash/membership and all501 distinct row-to-captured-source references verified. Lexical source aid only; candidate drift/producer omissions remain. Root-directory identity absent from supplied seals; original source historical custody and evolving candidate acceptance not certified.'}
(Q/'task04-c7-identity-disposition-aid-root-inspection.json').open('x').write(json.dumps(out,indent=2)+'\n')
print({k:v for k,v in out.items() if k not in ('seals','mapping')})
