from fs_identity import fs_identity
from fs_identity import loads as authority_loads
"""Finite OWN mirror setup, never launches/imports a qualification control or old mutator."""
from pathlib import Path
import os,stat,json,hashlib,gzip,datetime,re
R=Path('/workspace/Project-Cortex');B=R/'work/resume/task04-c7-exact-identity-repair/candidate';M=Path('/dev/shm/cortex-native-c7-exact-identity-repair/mirror');T=Path('/dev/shm/cortex-native-c7-exact-identity-repair/mirror-prebytes');T.mkdir(parents=True,exist_ok=True)
H=lambda b:hashlib.sha256(b).hexdigest();UTC=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();oldwork=R/'work/resume/task04-model-drift-native-preparation-c5';newwork=M/'work/resume/task04-model-drift-native-preparation-c5';qrel='_goals/convex-backend-runtime-2026-10-02/qa';pairs=[(str(oldwork),str(newwork)),(str(oldwork.relative_to(R)),str(newwork)),('/tmp/cortex-native-preparation-c5/', '/dev/shm/cortex-native-c7-exact-identity-repair/mirror-tmp/')]
for k in ['extension','regression','extra']:
 old=R/qrel/('task04-model-drift-native-'+k+'-preparation-c5');new=M/qrel/old.name;pairs.extend([(str(old),str(new)),(str(old.relative_to(R)),str(new))])
for old,new in pairs:
 assert old!=new and (str(M) in new or new.startswith('/dev/shm/cortex-native-c7-exact-identity-repair/'))
def owned(p):
 assert p.is_absolute() and str(p)==os.path.normpath(str(p))and str(p).startswith(str(M)+'/');q=p.parent
 while q!=q.parent:
  if q.exists():assert q.is_dir()and not q.is_symlink()and q.resolve()==q
  q=q.parent
 if p.exists():assert p.is_file()and not p.is_symlink()and p.stat().st_nlink==1
 return p
def archive(p,b,s):
 t=T/(H(b)+'.gz')
 if not t.exists():t.write_bytes(gzip.compress(b,mtime=0))
 assert gzip.decompress(t.read_bytes())==b
 return {'source':str(p),'sha256':H(b),'bytes':len(b),'identity':fs_identity(s),'beforeByteBacking':str(t),'encodedSHA256':H(t.read_bytes())}
pinfile=R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c2/bridge/mirror-source-transform-map.json'
pinbytes=pinfile.read_bytes();assert H(pinbytes)=='8294fadb32a646e3f3542c9aba16e740b41d95bce8eccfdc82e214bbdbf6cfb0','SOURCE_PREIMAGE_MAP_DRIFT'
pins={x['source']:x for x in authority_loads(pinbytes)['inputs']}
inputs=[]
for k in ['extension','regression','extra']:
 old=R/qrel/('task04-model-drift-native-'+k+'-preparation-c5')
 inputs.extend(p for p in old.rglob('*')if p.is_file()and not p.is_symlink()and (p.relative_to(old).parts[0]in ['scripts','fixture','runtime','runtime-source']or len(p.relative_to(old).parts)==1))
inputs.extend(p for p in oldwork.glob('*.mjs')if p.name not in ['compile.mjs'])
for k in ['extension','regression','extra']:inputs.extend((oldwork/k/'parent-proof').glob('*.mjs'))
rows=[]
for p in sorted(set(inputs)):
 s=p.lstat();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and p.resolve()==p;fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  identity=lambda z:tuple(getattr(z,'st_'+k)for k in ['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns']);assert identity(os.fstat(fd))==identity(s);blocks=[]
  while True:
   block=os.read(fd,1048576)
   if not block:break
   blocks.append(block)
  raw=b''.join(blocks);assert identity(os.fstat(fd))==identity(s)==identity(p.lstat())
 finally:os.close(fd)
 assert str(p) in pins and len(raw)==pins[str(p)]['bytes'] and H(raw)==pins[str(p)]['sha256'],'SOURCE_PREIMAGE_DRIFT'
 before=archive(p,raw,s);dest=owned(M/p.relative_to(R));dest.parent.mkdir(parents=True,exist_ok=True,mode=0o700);text=raw.decode();changes=[]
 mapping=dict(pairs);counts={}
 def substitute(match):
  old=match.group(0);counts[old]=counts.get(old,0)+1;return mapping[old]
 text=re.sub('|'.join(re.escape(old)for old in sorted(mapping,key=len,reverse=True)),substitute,text)
 for old,n in counts.items():changes.append({'from':old,'to':mapping[old],'occurrences':n,'kind':'EXACT_PATH_PLUMBING_SINGLE_PASS'})
 if p.name=='guard.mjs':
  k=next(k for k in ['extension','regression','extra']if 'native-'+k+'-'in str(p));root=M/qrel/('task04-model-drift-native-'+k+'-preparation-c5');old="repo=resolve(root,'../../../..')";assert text.count(old)==1;text=text.replace(old,"repo=root==="+json.dumps(str(root))+"?"+json.dumps(str(R))+":resolve(root,'../../../..')");old="export const scratch=resolve(repo,'work/backend-runtime/task04-model-drift-native-"+k+"-c5');";assert text.count(old)==1;text=text.replace(old,"export const scratch=root==="+json.dumps(str(root))+"?"+json.dumps(str(M/'work/backend-runtime'/('task04-model-drift-native-'+k+'-c5')))+":resolve(repo,'work/backend-runtime/task04-model-drift-native-"+k+"-c5');");changes.append({'kind':'EXACT_HOST_ROOT_REPO_SCRATCH_PATH_PLUMBING','dummyOtherRoots':'original resolve expressions retained'})
 if p.name=='offline-installation.mjs':
  token="resolve(root,'../'+candidate+'/fixture')";assert text.count(token)==1;text=text.replace(token,"resolve("+json.dumps(str(R/qrel))+",candidate+'/fixture')");changes.append({'kind':'EXACT_HISTORICAL_READONLY_FIXTURE_BASE_PLUMBING'})
 # Literal historical sibling reads retain public-repository backing, not absent owned sibling mirrors.
 pattern=re.compile(r"(?<![A-Za-z0-9_])(path\.)?resolve\(root,(['\"])(\.\./[^'\"]+)\2\)")
 def historical(match):
  suffix=match.group(3)[3:]
  if not suffix.startswith('task04-'):return match.group(0)
  if any(suffix.startswith('task04-model-drift-native-'+k+'-preparation-c5')for k in ['extension','regression','extra']):return match.group(0)
  changes.append({'kind':'EXACT_LITERAL_HISTORICAL_PUBLIC_READ_PLUMBING','originalExpression':match.group(0),'literalSuffix':suffix})
  return (match.group(1)or'')+'resolve('+json.dumps(str(R/qrel))+','+json.dumps(suffix)+')'
 text=pattern.sub(historical,text)
 if p.name=='parent-inputs.mjs':
  k=next(k for k in ['extension','regression','extra']if 'native-'+k+'-'in str(p));root=M/qrel/('task04-model-drift-native-'+k+'-preparation-c5');original=qrel+'/task04-model-drift-native-'+k+'-preparation-c5';token='resolve(repo,'+json.dumps(str(root))+')';assert text.count(token)==1;text=text.replace(token,'(root==='+json.dumps(str(root))+'?'+json.dumps(str(root))+':resolve(repo,'+json.dumps(original)+'))');token='resolve(repo,dirname(profileContract.privateEnvironmentFile))';assert text.count(token)==1;text=text.replace(token,'(root==='+json.dumps(str(root))+'?'+json.dumps(str(M/'work/backend-runtime'/('task04-model-drift-native-'+k+'-c5')))+':'+token+')');changes.append({'kind':'EXACT_PARENT_HOST_ROOT_ONLY_PATH_PLUMBING','dummyOtherRoots':'original resolve expressions retained'})
 if p.parent.name=='parent-proof':
  k=p.parent.parent.name;token='path.relative(repo,candidate)';n=text.count(token)
  if n:text=text.replace(token,json.dumps(qrel+'/task04-model-drift-native-'+k+'-preparation-c5'));changes.append({'kind':'VIRTUAL_DUMMY_CANDIDATE_RELATIVE_PATH_PLUMBING','occurrences':n})
 generic=qrel+'/task04-model-drift-native-';replacement=str(M/qrel)+'/task04-model-drift-native-'
 pattern=re.compile(r"(['\"])"+re.escape(generic)+r"\1(\s*\+\s*kind\s*\+\s*['\"]-preparation-c5['\"])")
 text,n=pattern.subn(lambda m:m.group(1)+replacement+m.group(1)+m.group(2),text)
 if n:changes.append({'kind':'EXACT_SPLIT_PROFILE_C5_PATH_PLUMBING','occurrences':n})
 if p.name=='runner-closure.mjs':
  token="base=resolve(repo,'"+qrel+"')";assert text.count(token)==1;text=text.replace(token,"base=resolve(repo,"+json.dumps(str(M/qrel))+")");changes.append({'kind':'EXACT_RUNNER_ONLY_QA_BASE_PATH_PLUMBING'})
 out=text.encode();
 if dest.exists():archive(dest,dest.read_bytes(),dest.lstat())
 dest.write_bytes(out);os.chmod(dest,0o600);rows.append({**before,'destination':str(dest),'destinationSHA256':H(out),'destinationBytes':len(out),'changes':changes,'assertions':'No semantic assertion/case/cap transform; exact source diff remains for independent review'})
(B/'mirror-source-transform-map.json').write_text(json.dumps({'utc':UTC(),'status':'OWN_CANDIDATE_PATH_PLUMBING_ONLY_NOT_SOURCE_ACCEPTANCE_OR_QUALIFICATION','inputs':rows,'original122':'HELD','historicMutators':'initialize/prepare/compile/default-denied; not copied as launch entries'},indent=2)+'\n')
print(json.dumps({'rows':len(rows),'bytes':sum(x['destinationBytes']for x in rows),'map':str(B/'mirror-source-transform-map.json')}))
