import pathlib,os,stat,json,hashlib,datetime
R=pathlib.Path.cwd();Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';checks=[]
def digest(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
 return h.hexdigest()
for label,pin,p in [('QA','cc2af2eb7935d217a1e9eeb674603814921ab01b477673a5f2300bdcc07b8a6a',Q/'task04-native-c5-closed-launcher-c4/literal-self-seal.json'),('work','dbe875a439e0d464e8377db33cd26832f3cc77ef944032bb2267defbaa572a7d',R/'work/resume/task04-model-drift-native-preparation-c5/closed-launcher-c4/literal-self-seal.json'),('tmp','f47f9ae7675e44ad4c4cccd272bc85e550e12ba6ea542f235839285fd1b1203e',pathlib.Path('/tmp/cortex-native-c5-closed-launcher-c4/literal-self-seal.json'))]:
 assert digest(p)==pin;j=json.loads(p.read_text());root=pathlib.Path(j['root']);assert pathlib.Path(j['selfOnlyExclusion'])==p.resolve();rs=root.lstat();assert stat.S_ISDIR(rs.st_mode)and rs.st_uid==os.getuid()and not(rs.st_mode&0o077)
 expected={};total=0;links=0
 for x in j['rows']:
  rel=pathlib.PurePosixPath(x['path']);assert not rel.is_absolute()and '..'not in rel.parts and x['path']not in expected;expected[x['path']]=x;s=(root/rel).lstat()
  for k,field in [('mode','st_mode'),('uid','st_uid'),('dev','st_dev'),('ino','st_ino'),('nlink','st_nlink')]:assert getattr(s,field)==x[k],(label,str(rel),k)
  if x['type']=='file':assert stat.S_ISREG(s.st_mode)and s.st_size==x['bytes']and digest(root/rel)==x['sha256'];total+=s.st_size
  elif x['type']=='directory':assert stat.S_ISDIR(s.st_mode)
  elif x['type']=='symlink':assert stat.S_ISLNK(s.st_mode)and os.readlink(root/rel)==x['target'];links+=1
  else:raise AssertionError(('unexpected type',label,x['type']))
 actual=set()
 for parent,dirs,files in os.walk(root,followlinks=False):
  for name in dirs+files:
   child=pathlib.Path(parent)/name
   if child!=p:actual.add(str(child.relative_to(root)))
  dirs[:]=[x for x in dirs if not(pathlib.Path(parent)/x).is_symlink()]
 assert actual==set(expected),(label,'membership',len(actual),len(expected))
 checks.append({'scope':label,'sealSHA256':pin,'exactRows':len(expected),'literalSymlinksNeverFollowed':links,'regularBytesVerified':total,'recordedMetadataVerified':['mode','uid','dev','ino','nlink'],'timestampsAndGidNotInSubjectSeal':'NOT_ASSERTED'})

def verify_ref(x):
 p=pathlib.Path(x['path']);s=p.lstat();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_size==x['bytes']and digest(p)==x['sha256']
 for k,v in x.get('identity',{}).items():assert getattr(s,'st_'+k)==v,(str(p),k)
refs=json.loads((Q/'task04-native-c5-closed-launcher-c4/owned-seal-references.json').read_text())
for k in ['work','temporary']:verify_ref(refs[k])
e=json.loads((Q/'task04-native-c5-closed-launcher-c4/external-backing.json').read_text())
for x in [e['fullReferences'],e['currentPreparedInputs'],*e['externalSubjectReferences']]:verify_ref(x)
f=json.loads(pathlib.Path(e['fullReferences']['path']).read_text())
for x in f['references']:verify_ref(x)
r={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reportReadFully':True,'status':'ROOT_VERIFIED_FROZEN_REVIEW_PENDING_NOT_GATE_PASS','checks':checks,'externalReferencesVerified':len(f['references']),'original122':'HELD','actualRootApproval':'ABSENT','sourceParentNativePaidTiming':'HELD','timestampsAndGidInSubjectSeal':'NOT_ASSERTED'}
(Q/'task04-native-c5-c4-frozen-packet-root-inspection.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
