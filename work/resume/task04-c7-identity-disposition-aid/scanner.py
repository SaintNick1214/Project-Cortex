import os,json,hashlib,difflib,re,datetime
from pathlib import Path
R=Path('/workspace/Project-Cortex'); W=R/'work/resume/task04-c7-identity-disposition-aid'; Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-identity-disposition-aid'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}
def read(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);os.dup2(fd,9)
 try:
  a=ident(os.fstat(9));h=hashlib.sha256();parts=[]
  while True:
   b=os.read(9,65536)
   if not b:break
   h.update(b);parts.append(b)
  z=ident(os.fstat(9));last=ident(os.lstat(p))
  return b''.join(parts),{'path':str(p),'heldFD':9,'sha256':h.hexdigest(),'pre':a,'post':z,'currentPathPost':last,'stable':a==z==last}
 finally:os.close(9);os.close(fd)
def put(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
# Correct only the naming/order of already captured exact Python integer metadata.
# No candidate reread is used to replace the earlier capture.
pre=json.loads((W/'capture-pre.json').read_text())
def fix(d):
 if d.get('schema')=='FS_IDENTITY_DECIMAL_V1':return d
 return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:d[{'mtime_ns':'mtimeNs','ctime_ns':'ctimeNs'}.get(k,k)] for k in FIELDS}}
for row in pre['files']:
 for key in ('pre','post','currentPathPost','copyIdentity'):row[key]=fix(row[key])
pre['identityFields']=list(FIELDS);pre['metadataCorrection']='Earlier Python exact integer values retained; timestamp labels normalized to schema names, field order corrected.'
put(W/'capture-pre.json',pre)
original=R/'work/resume/task04-c7-exact-identity-source-aid/identity-consumer-line-map.json'
data,originalpin=read(original);originalmap=json.loads(data)
base=R/'work/resume/task04-c7-exact-identity-source-aid/copies/work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6'
version={r['file']:r for r in pre['files']}; mappings=[];cache={}
def normalize(t):return re.sub(r'c[567](?:-exact-identity-repair)?','CANDIDATE',t)
def classify(text,file):
 tags=[]
 if re.search(r'identity\.(?:capture|same|sameStats|stable|validate|parse)|exactIdentity\.|fs_identity\(|authority_loads',text):tags.append('exact9/schema')
 if re.search(r'bigint\s*:\s*true|\bBigInt\(|\b\d+n\b',text):tags.append('internal BigInt')
 if re.search(r'(?:statSync|lstatSync|fstatSync|\.stat\()[^\n]*',text) and ('raw[n]' in text or '...a' in text or 'assert.' in text):tags.append('publicnative Stats/options')
 if re.search(r'identity\.(?:pid|bounded|startTime)|bytes|Bytes|PID|ppid|pgid|startTime',text):tags.append('bounded PID or bytecounts')
 if re.search(r'PRECISION_LIMITED|legacyExact|FORENSIC|legacy|historical',text,re.I):tags.append('legacyforensic')
 if not tags:tags=['UNRESOLVED']
 return tags
for index,row in enumerate(originalmap['rows'],1):
 f=row['file']
 if f not in cache:
  old,oldpin=read(base/f);new,newpin=read(W/'copies'/f);a=old.decode().splitlines();b=new.decode().splitlines(); correspondence={}
  for tag,i,j,k,l in difflib.SequenceMatcher(None,[normalize(x) for x in a],[normalize(x) for x in b],autojunk=False).get_opcodes():
   for n in range(i,j):
    if tag=='equal':correspondence[n]=([k+n-i],'equal-after-path-normalization',1.0)
    elif tag=='delete':correspondence[n]=([],'notretained',0.0)
    else:
     scores=[(difflib.SequenceMatcher(None,normalize(a[n]),normalize(b[m]),autojunk=False).ratio(),m) for m in range(k,l)]
     best=max(scores,default=(0.0,None));selected=[m for score,m in scores if score>=max(.35,best[0]-.03)]
     correspondence[n]=(selected,'replacement-similarity-candidates',best[0])
  cache[f]=(a,b,correspondence,oldpin,newpin)
 a,b,c,oldpin,newpin=cache[f];n=row['line']-1;assert a[n]==row['source'];lines,method,score=c[n]
 current=[{'line':m+1,'source':b[m]} for m in lines];text='\n'.join(x['source'] for x in current);tags=classify(text,f) if lines else ['notretained']
 functions=[]
 for x in current:
  for match in re.finditer(r'(?:function\s+|def\s+)([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^;]*?\)|[\w$]+)\s*=>',x['source']):functions.append(match.group(1) or match.group(2))
 purpose=('source declaration/consumer: '+', '.join(dict.fromkeys(functions))) if functions else ('module-level producer/control/serialization statement; inspect exact source below')
 if method=='replacement-similarity-candidates':tags=list(dict.fromkeys(tags+['UNRESOLVED']))
 mappings.append({'originalSiteID':f'ORIGINAL-{index:03d}','original':row,'originalCapturedFileSHA256':oldpin['sha256'],'capturedCandidateFile':f,'capturedCandidateFileSHA256':newpin['sha256'],'correspondenceMethod':method,'similarity':score,'classification':tags,'purpose':purpose,'currentCandidates':current,'limit':'Lexical correspondence only, replacement candidates require executor semantic confirmation; no acceptance claim.'})
assert len(mappings)==501 and len({r['originalSiteID'] for r in mappings})==501
put(W/'identity-site-dispositions.json',{'label':'PARTIAL_SOURCE_AID_ONLY','originalMapPin':originalpin,'capturedUTC':pre['capturedUTC'],'rows':mappings,'sites':len(mappings),'notAnAcceptanceAudit':True})
put(W/'original-copy-read-pins.json',[{'file':f,'pin':v[3]} for f,v in sorted(cache.items())])
# Fresh entire copied-source and candidate source POST before report analysis.
post=[]
for name,entry in sorted(version.items()):
 copybytes,copypin=read(W/'copies'/name);sourcebytes,sourcepin=read(Path(entry['path']))
 post.append({'file':name,'copy':copypin,'source':sourcepin,'copyPreserved':copypin['sha256']==entry['sha256'] and copypin['pre']==entry['copyIdentity'],'sourcePreserved':sourcepin['sha256']==entry['sha256'] and sourcepin['pre']==entry['pre']})
currentMembership=sorted(p.name for p in Path(pre['files'][0]['path']).parent.iterdir() if p.suffix in ('.mjs','.cjs','.py'))
put(W/'capture-post.json',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':post,'membership':currentMembership,'membershipPreserved':currentMembership==pre['membership'],'copiesPreserved':all(r['copyPreserved'] for r in post),'sourcePreserved':all(r['sourcePreserved'] for r in post)})
print(json.dumps({'sites':len(mappings),'replacementRows':sum(r['correspondenceMethod']=='replacement-similarity-candidates' for r in mappings),'notretainedRows':sum(r['correspondenceMethod']=='notretained' for r in mappings),'copyPreserved':all(r['copyPreserved'] for r in post),'sourceDrift':[r['file'] for r in post if not r['sourcePreserved']],'membershipPreserved':currentMembership==pre['membership']}))
