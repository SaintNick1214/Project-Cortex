from pathlib import Path
import ast,copy,hashlib,json,os,stat,types
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-preparation';Q=QA/'task03-local-native-attempt6-2026-10-06';tree=ast.parse((Q/'integrated/private-coordinate.py').read_text());fn=next(x for x in tree.body if isinstance(x,ast.FunctionDef)and x.name=='load_module');code=compile(ast.Module(body=[fn],type_ignores=[]),'<exact-verified-source-loader>','exec');source=Q/'integrated/CONTROL_ONLY_NONEXISTENT_PUBLIC_SOURCE.py';approvalpath=P/'integrated-source-review.json';mfpath=P/'operative-source-manifest.json';raw=b"marker='CURRENT_REVIEWED_SOURCE_BYTES'\n";fields=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');rows=[]
def case(label,change=None,expected=True):
 pin={'dev':'44','ino':'100','mode':str(stat.S_IFREG|0o600),'uid':'501','gid':'20','nlink':'1','size':str(len(raw)),'mtime_ns':'1','ctime_ns':'2'}
 member={'path':str(source.relative_to(R)),'PRE':pin,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
 frozen={'path':str((Q/'candidate-freeze-attempt6.json').relative_to(R)),'sha256':'freeze'}
 manifest={'files':[member,frozen]};approval={'scope':'TASK03_ATTEMPT6_INTEGRATED_SOURCE_ONLY','verdict':'PASS','independent':True,'candidateSha256':'freeze','sources':{member['path']:member['sha256']}}
 if change=='scope':approval['scope']='FOREIGN'
 if change=='independent':approval['independent']=False
 if change=='candidate':approval['candidateSha256']='FOREIGN'
 if change=='manifestduplicate':manifest['files'].append(copy.deepcopy(member))
 if change=='sourcehash':approval['sources'][member['path']]='FOREIGN'
 mraw=json.dumps(manifest).encode();approval['sourceManifestSha256']=hashlib.sha256(mraw).hexdigest()
 if change=='manifesthash':approval['sourceManifestSha256']='FOREIGN'
 files={source:raw,mfpath:mraw,approvalpath:json.dumps(approval).encode()};fds={};counter=0;reads=[]
 def status(path):
  values={k:int(v)for k,v in pin.items()};values['size']=len(files[path])
  if path!=source:values['ino']=101 if path==mfpath else 102
  if path==source and change in('uid','gid','nlink','ctime'):
   values[{'ctime':'ctime_ns'}.get(change,change)]+=1
  return types.SimpleNamespace(**{'st_'+k:v for k,v in values.items()})
 def opened(path,flags):
  nonlocal counter
  assert path in files;counter+=1;fds[counter]=[path,0];return counter
 def read(fd,size):
  path,offset=fds[fd];block=files[path][offset:offset+size];fds[fd][1]+=len(block);reads.append(path);return block
 fake=types.SimpleNamespace(O_RDONLY=os.O_RDONLY,O_NOFOLLOW=os.O_NOFOLLOW,lstat=status,open=opened,read=read,fstat=lambda fd:status(fds[fd][0]),close=lambda fd:fds.pop(fd))
 ns={'R':R,'P':P,'APPROVAL':approvalpath,'os':fake,'stat':stat,'types':types,'hashlib':hashlib,'strict_json':json.loads}
 exec(code,ns);accepted=False
 try:result=ns['load_module']('CONTROL_ONLY',source);accepted=result.marker=='CURRENT_REVIEWED_SOURCE_BYTES'
 except AssertionError:pass
 assert accepted is expected and fds=={}
 if change in('scope','independent','candidate','manifesthash'):assert source not in reads
 rows.append({'name':label,'status':'PASS','accepted':accepted,'sourceBytesExecuted':accepted,'realFilesystemWrites':0,'privateAccess':0})
case('verified-current-full-EOF-source-positive')
for name in ('scope','independent','candidate','manifestduplicate','sourcehash','manifesthash','uid','gid','nlink','ctime'):case('denies-'+name,name,False)
result={'scope':'EXACT_SOURCE_LOADER_IN_MEMORY_INTEGRITY_CONTROLS_ONLY','status':'PASS','count':len(rows),'rows':rows,'privateAccess':0,'serviceEffects':0,'actualRuntimeCertified':False}
fd=os.open(P/'loader-control-results.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w')as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:result[k]for k in('scope','status','count','privateAccess','actualRuntimeCertified')}))
