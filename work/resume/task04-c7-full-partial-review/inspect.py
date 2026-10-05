import os,sys,json,gzip,hashlib,stat,datetime,importlib.machinery,importlib.util
from pathlib import Path
R=Path('/workspace/Project-Cortex'); W=R/'work/resume/task04-c7-full-partial-review'; B=R/'work/resume/task04-c7-exact-identity-repair'; Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-exact-identity-repair'; T=Path('/dev/shm/cortex-native-c7-exact-identity-repair')
loader=importlib.machinery.SourceFileLoader('inspected_reader',str(W/'subject-stream-json-inspected.raw'));spec=importlib.util.spec_from_loader(loader.name,loader);m=importlib.util.module_from_spec(spec);loader.exec_module(m)
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s): return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def digest(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  while b:=f.read(65536):h.update(b)
 return h.hexdigest()
def snapshot(label):
 output=W/(label+'.jsonl.gz');counts={};bad=[];headers=[]
 with gzip.open(output,'wt',encoding='ascii') as out:
  for root in (B,Q,T):
   seal=root/'seal-c7-partial.json.gz';pre=ident(os.lstat(seal));count=0
   def row(key,v):
    nonlocal count
    p=root/v['path'];s=os.lstat(p);current=ident(s);ok=current==v['identity'];extra={}
    if v['kind']=='directory':extra['members']=sorted(os.listdir(p));ok=ok and extra['members']==v['members']
    elif v['kind']=='symlink':extra['literalTarget']=os.readlink(p);ok=ok and extra['literalTarget']==v['literalTarget']
    out.write(json.dumps({'root':str(root),'path':v['path'],'kind':v['kind'],'identity':current,'sealIdentityMatch':ok,**extra},separators=(',',':'))+'\n');count+=1
    if not ok:bad.append(str(p))
   with gzip.open(seal,'rb') as f:
    reader=m.Reader(iter(lambda:f.read(16384),b''),valueLimit=2097152);header=reader.top(arrayKeys=('rows',),item=row)
   rootok=ident(os.lstat(root))==header['rootIdentity'] and sorted(os.listdir(root))==header['rootMembers']
   headers.append({'seal':str(seal),'PRE':pre,'POST':ident(os.lstat(seal)),'sha256':digest(seal),'rootCurrent':ident(os.lstat(root)),'rootMatch':rootok,'header':header,'observedRows':count,'peakBuffer':reader.peakBuffer})
   counts[str(root)]=count
   if not rootok:bad.append(str(root))
 summary={'scope':'INDEPENDENT_FULL9_METADATA_SEAL_STREAM_ONLY_NO_RUNTIME_QUALIFICATION','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'counts':counts,'mismatches':bad,'headers':headers,'snapshot':str(output),'snapshotSHA256':digest(output)}
 (W/(label+'-summary.json')).write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({'label':label,'counts':counts,'mismatches':len(bad)}))
def backing():
 d=W/'source-beforebytes';d.mkdir(exist_ok=False); rows=[]
 for p in sorted((B/'candidate').iterdir()):
  if p.is_file() and p.suffix in ('.mjs','.cjs','.py'):
   a=ident(os.lstat(p));h=hashlib.sha256();dst=d/(p.name+'.raw')
   with open(p,'rb') as src,open(dst,'xb') as out:
    while b:=src.read(65536):h.update(b);out.write(b)
   z=ident(os.lstat(p));assert a==z
   rows.append({'path':str(p),'PRE':a,'POST':z,'sha256':h.hexdigest(),'backing':str(dst),'backingIdentity':ident(os.lstat(dst))})
 (W/'source-backings.json').write_text(json.dumps({'scope':'GENUINE_OWN_SOURCE_PREPOST_BACKINGS_FULL9','rows':rows},indent=2)+'\n');print(json.dumps({'sourceBackings':len(rows)}))
if sys.argv[1]=='backing':backing()
else:snapshot(sys.argv[1])
