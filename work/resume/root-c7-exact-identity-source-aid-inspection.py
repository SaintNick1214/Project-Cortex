from pathlib import Path
import os,stat,json,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';C=Q/'task04-c7-exact-identity-source-aid';W=R/'work/resume/task04-c7-exact-identity-source-aid';K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:str(getattr(s,'st_'+k)) for k in K}
def held(p,retain=False):
 p=Path(p);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1;h=hashlib.sha256();chunks=[]
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b)
   if retain:chunks.append(b)
  assert identity(a)==identity(os.fstat(fd))==identity(os.lstat(p))
  return {'path':str(p),'bytes':a.st_size,'sha256':h.hexdigest(),'identity':identity(a)},b''.join(chunks) if retain else None
 finally:os.close(fd)
def check(row,key='identity',retain=False):
 observed,b=held(row['path'],retain);assert observed['bytes']==row['bytes'] and observed['sha256']==row['sha256'] and observed['identity']==row[key]
 return b
checks=[]
for root,pin in [(C,'b5d12b3410abc8c0c267db5b12652b6871db7dadddfbfa77fb781342655d85e9'),(W,'ceaee4219712f8e8d7c6f6e592099d264d546ccaefce037bcb251bf4f34d3e0a')]:
 observed,b=held(root/'selfseal.json',True);assert observed['sha256']==pin;d=json.loads(b)
 assert d['root']==str(root) and d['excludedSelfOnly']==['selfseal.json'] and d['format']=='PLAIN_EXACT_FILE_CONTENT_MANIFEST_NOT_DIRECTORY_HISTORICAL_SEAL'
 expected={};total=0
 for row in d['rows']:
  rel=Path(row['relativePath']);assert not rel.is_absolute() and '..' not in rel.parts and row['path']==str(root/rel) and str(rel) not in expected;expected[str(rel)]=row;check(row);total+=row['bytes']
 actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and p!=root/'selfseal.json'}
 assert actual==set(expected) and len(expected)==d['files'] and total==d['bytes']
 assert not any(p.is_symlink() for p in root.rglob('*'))
 for ref in d['references']:check(ref)
 checks.append({'root':str(root),'sealSHA256':pin,'files':len(expected),'regularBytes':total,'plainContentManifestNotDirectoryHistoricalIdentity':True})
obs,report=held(C/'report.md',True);assert obs['sha256']=='7fd890bef7b8b0eda17d1dab622fc1c57fbdea66c5826c4c1fbb047e441a28ee';report.decode('utf-8')
pre=json.loads(held(W/'source-PRE.json',True)[1]);post=json.loads(held(W/'source-POST.json',True)[1]);assert pre['count']==post['count']==len(pre['rows'])==len(post['rows'])==119 and post['allEqual']
sources={}
for before,after in zip(pre['rows'],post['rows']):
 assert before['source']==after['source']['path'] and before['copy']==after['copy']['path']
 check(after['source']);copy=check(after['copy'],retain=True)
 assert before['bytes']==after['source']['bytes']==after['copy']['bytes'] and before['sha256']==after['source']['sha256']==after['copy']['sha256']
 assert before['PRE']==before['POST']==before['pathPOST']==after['source']['identity']
 if Path(before['source']).suffix in ('.mjs','.cjs','.py'):sources[Path(before['source']).name]=copy.decode('utf-8').splitlines()
sites=json.loads(held(W/'identity-consumer-line-map.json',True)[1]);assert sites['sites']==len(sites['rows'])==501 and len(sources)==111
for row in sites['rows']:assert sources[row['file']][row['line']-1]==row['source']
before=json.loads(held(W/'microcontrol-before.json',True)[1]);receipt=json.loads(held(W/'microcontrol-receipt.json',True)[1]);assert receipt['exitCode']==0 and receipt['sourceEqual'] and receipt['label']=='SOURCE_AID_ONLY'
assert receipt['argv']==before['argv'] and receipt['cwd']==before['cwd'] and receipt['sourcePRE']==before['sourcePRE']
for row in before['sourcePRE']:check(row,key='PRE')
for row in receipt['sourcePOST']:
 assert row['PRE']==row['POST']==row['pathPOST'];check(row,key='PRE')
raws=[]
for row in receipt['raws']:
 assert row['PRE']==row['POST']==row['pathPOST']
 b=check(row,key='PRE',retain=True);raws.append({'path':row['path'],'bytes':row['bytes'],'sha256':row['sha256'],'text':b.decode('utf-8')})
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_SOURCE_AID_FULL_CONTENT_AND_MICROCONTROL_INSPECTION_ONLY','checks':checks,'sourceCopiesVerified':119,'sourceCopyBytes':post['bytes'],'sourceMapFiles':111,'exactLineSitesVerified':501,'recordedOwnBuiltinMicrocontrolExit':0,'raws':raws,'candidateRuntime':'NOT_RUN_NOT_IMPLEMENTED','original122SourceParentNativePrivatePaidTiming':'HELD','limits':'Plain exact file-content manifests only, not historical directory identity seals. Current original/copy/tool rereads verify preservation; never retroactive custody. Pure own builtin controls do not certify proposed strict schema/parser/consumer implementation or whole120s.'}
with (Q/'task04-c7-exact-identity-source-aid-root-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in out.items() if k!='raws'}))
