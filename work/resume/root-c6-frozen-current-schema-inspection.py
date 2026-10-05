from pathlib import Path
import os,stat,json,gzip,hashlib,datetime
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';C=Q/'task04-native-c6-closed-launcher-c6';W=R/'work/resume/task04-model-drift-native-preparation-c6/closed-launcher-c6';T=Path('/dev/shm/cortex-native-c6-closed-launcher-c6');E=Path('/tmp/cortex-native-c6-independent-review-87eb6f28-3812-499b-ab08-09282d98678d')
H=lambda b:hashlib.sha256(b).hexdigest()
K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s):return {k:getattr(s,'st_'+k) for k in K}
def held(p,retain=False):
 p=Path(p);a=p.lstat();assert stat.S_ISREG(a.st_mode) and a.st_nlink==1
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);h=hashlib.sha256();chunks=[]
 try:
  assert identity(a)==identity(os.fstat(fd))
  while True:
   b=os.read(fd,1048576)
   if not b:break
   h.update(b)
   if retain:chunks.append(b)
  assert identity(a)==identity(os.fstat(fd))==identity(p.lstat())
 finally:os.close(fd)
 return h.hexdigest(),a,b''.join(chunks) if retain else None
def bound(row,retain=False):
 h,s,b=held(row['path'],retain);assert h==row['sha256'] and s.st_size==row['bytes']
 if 'identity' in row:assert identity(s)==row['identity']
 return b
subjects=[('QA',C,'1e9a4dfc94509ccaeaeef9cf1de424e5dcaed57fa583bab5b9d43bc63775926a'),('work',W,'7d4c0048114ca756d7cfe0ae42ed81e6fcfdec7237f780511b07a2b252f82606'),('temporary',T,'451993ad4dfad8b6c30d22e8ddc637eab2efe18b86f8ce18e0625baf9b00038b'),('external',E,'2e976f8c3453e39bb09a77253761d187719a3d930a2a6809028bcc7e1fecc318')]
checks=[]
for scope,root,pin in subjects:
 h,_,b=held(root/'seal.json',True);assert h==pin;d=json.loads(b)
 assert d['root']==str(root) and d['exclusion']=='ONLY_OWN_ROOT_seal.json' and d['literalNoLinkTraversal']
 rows={};size=0;links=0
 for row in d['rows']:
  rel=Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts and row['path'] not in rows
  rows[row['path']]=row;p=root/rel;s=p.lstat();assert identity(s)==row['identity'],(scope,row['path'],'identity')
  if row['kind']=='file':
   actual,s,_=held(p);assert actual==row['sha256'] and s.st_size==row['bytes'];size+=s.st_size
  elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode)
  elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['target'];links+=1
  else:raise AssertionError(row['kind'])
 actual={'.'}
 for parent,dirs,files in os.walk(root,followlinks=False):
  for name in dirs+files:
   p=Path(parent)/name
   if p!=root/'seal.json':actual.add(str(p.relative_to(root)))
  dirs[:]=[name for name in dirs if not (Path(parent)/name).is_symlink()]
 assert actual==set(rows) and size==d['regularBytes']
 children={}
 for n in rows:
  if n!='.':children.setdefault(str(Path(n).parent),set()).add(Path(n).name)
 for rel,row in rows.items():
  if row['kind']=='directory':
   expected=children.get(rel,set()).copy()
   if rel=='.':expected.add('seal.json')
   assert set(os.listdir(root/rel))==expected
 checks.append({'scope':scope,'root':str(root),'sealSHA256':pin,'rows':len(rows),'regularBytesVerified':size,'literalLinksNeverFollowed':links})
reportHash,_,report=held(C/'report.md',True);assert reportHash=='f570f02dc5b9032fda9826d558a5eb730f86ff29fac3bdeeb6ff1e559f9adb11';report.decode('utf-8')
sourceHash,_,b=held(C/'sourcepins.json',True);pins=json.loads(b)
pre=json.loads(bound(pins['exactFinalBatchSourcePRE'],True));assert isinstance(pre,list)
preMap={r['path']:r for r in pre};admin=[];consumed=0
for row in pins['W']:
 bound(row)
 before=row['actualFinalBatchBeforeByteEvidence']
 if before is None:
  assert Path(row['path']).suffix=='.pyc' and row['classification']=='ADMINISTRATIVE_BYTECODE_LATE_OBSERVATION_NOT_FINAL_NODE_CONSUMED_SOURCE';admin.append(row['path']);continue
 assert before==preMap[row['path']] and (row['bytes'],row['sha256'])==(before['bytes'],before['sha256'])
 encHash,encStat,enc=held(before['beforeByteBacking'],True);assert encHash==before['encodedSHA256'] and encStat.st_size==before['encodedBytes']
 dec=gzip.decompress(enc);assert len(dec)==before['bytes'] and H(dec)==before['sha256'];consumed+=1
assert len(admin)==3
bound(pins['exactFinalBatchReceipt'])
bindingHash,_,b=held(C/'prepared122bindings.json',True);bindings=json.loads(b)
contract=json.loads(bound(bindings['contract'],True));mirror=json.loads(bound(bindings['mirrorMap'],True));bound(bindings['finiteProducerRules'])
mapping={r['source']:r for r in mirror['inputs']}
profileRoots=[str(R/'_goals/convex-backend-runtime-2026-10-02/qa'/('task04-model-drift-native-'+k+'-preparation-c5')) for k in ('extension','regression','extra')]
def mapped(value):
 if value in mapping:return mapping[value]['destination']
 if any(value==r or value.startswith(r+'/') for r in profileRoots):return str(T/'mirror')+value[len(str(R)):]
 return value
assert len(bindings['commands'])==len(contract['commands'])==122 and len({r['id'] for r in bindings['commands']})==122
for a,c in zip(bindings['commands'],contract['commands']):
 assert a['id']==c['id'] and c['status']=='PROPOSAL_ONLY_NOT_EXECUTION_RELEASE'
 assert a['originalArgv']==c['proposedArgv'] and a['originalEntry']==c['proposedArgv'][2] and a['originalEntrySHA256']==c['entrySha256']
 assert held(a['originalEntry'])[0]==a['originalEntrySHA256'];bound(a['ownedEntry'])
 m=mapping[a['originalEntry']];assert m['destination']==a['ownedEntry']['path'] and m['destinationSHA256']==a['ownedEntry']['sha256'] and m['sha256']==a['originalEntrySHA256']
 assert a['preparedArgv']==['/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node','--experimental-vm-modules',*[mapped(v) for v in a['originalArgv'][2:]]]
refs=json.loads(held(C/'external-backing-refs.json',True)[2]);assert refs['ownedTemporaryRoot']==str(T) and refs['executedExternalRoot']==str(E)
for row in refs['exactRefs']:bound(row)
approval=Q/'task04-native-c6-closed-launcher-c6-root-approval';assert not os.path.lexists(approval/'approval.json') and not os.path.lexists(approval/'approval-pin.json')
assert held(W/'route-policy.mjs')[0]=='72eedf1f80bcca600319e690605d29675389fbb6dda371246293f63ee242ec03'
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_FROZEN_PACKET_AND_SOURCE_BINDINGS_VERIFIED_NOT_ACCEPTANCE','checks':checks,'reportSHA256':reportHash,'sourcePinsSHA256':sourceHash,'bindingsSHA256':bindingHash,'sourcePinsVerified':len(pins['W']),'nonPycFinalBeforeEvidenceVerified':consumed,'lateAdministrativePyc':admin,'exact122IdsArgvOriginalAndMirrorSourceHashesVerified':122,'exactExternalRefsVerified':len(refs['exactRefs']),'actualApproval':'ABSENT','original122SourceParentNativePrivatePaidTiming':'HELD','limits':'Full literal membership/identities/hash checked. Directory members derived from complete rows and checked against actual entries. Historical custody is not restored; no body execution, independent acceptance, full122 scopes/caps feasibility or whole-route success inferred.'}
with (Q/'task04-native-c6-root-frozen-current-schema-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(out))
