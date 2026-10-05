import pathlib,os,stat,json,hashlib,datetime
R=pathlib.Path.cwd();Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';checks=[]
def digest(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
 return h.hexdigest()
for label,pin,p in [('QA','90c01d1dbad8c7f1235851721507c6edd9d48d719639dd484b2e2fd0e02dcc7c',Q/'task04-native-c5-composition-c3-fresh-review/literal-self-seal.json'),('work','24462871bb2b19f00f75f078872748d6ba98ae9989e079203aec1777438a2dc9',R/'work/resume/task04-native-c5-composition-c3-fresh-review/literal-self-seal.json'),('tmp','3dcb7c459b4f0bce8a2d13494b0b1243715e55fb577ece9f9cac6d9645421567',pathlib.Path('/tmp/cortex-native-c5-independent-review-c3-fresh-20261004a/literal-self-seal.json'))]:
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

r={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reportReadFully':True,'status':'ROOT_VERIFIED_FRESH_REVIEW_REJECT_2.2','checks':checks,'original122':'HELD','positiveOwnControls':'PASS','injectedRestoreFailure':'FAIL_PRIMARY_MASKED_HOOKS_REMAINED','joinRejection':'UNREACHABLE_IN_CURRENT_NORMALIZED_IMPLEMENTATION_DEFENSIVE_ORDERING_GAP','partialInstallRollback':'SOURCE_INSPECTED_NOT_REPRODUCED','rootInitialReadFailure':'glob matched seal.py as JSON; corrected exact literal-self-seal.json paths, no subject mutation'}
(Q/'task04-native-c5-composition-c3-fresh-review-root-inspection.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
