import pathlib,os,stat,json,hashlib,datetime
R=pathlib.Path.cwd();Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';checks=[]
def digest(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
 return h.hexdigest()
for label,pin,p in [('QA','71f1f525169d1f079c63d4f7cfefc473701d9c59092cedc505c6f683836b4229',Q/'task04-native-c5-composition-c4-fresh-review/literal-self-seal.json'),('work','d1926306059943c557d315c5bfe1f93a6e0c525bd28c9b75fab8814cd3b2b881',R/'work/resume/task04-native-c5-composition-c4-fresh-review/literal-self-seal.json'),('tmp','ae486f5d737c9af4872393517c03030b648ceb0a0a5476f44602a7ee9c3916fc',pathlib.Path('/tmp/cortex-native-c5-independent-review-c4-fresh-20261004b/literal-self-seal.json'))]:
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


r={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reportReadFully':True,'status':'ROOT_VERIFIED_FRESH_REVIEW_REJECT_3.0','checks':checks,'original122':'HELD','confirmedBlockingIssues':['consumed generatedmetadata excluded fromcapturedclosure','historical FS reads admitted outsidecapture/sourceFence'],'fixedSurrogateAndCleanupControls':'PASS_BOUNDED_ONLY','earlyReviewerFailures':'RETAINED_NOT_CANDIDATE_FAILURE_CLAIMS','ownedProcesses':'NO_LIVE_PROCESSES_TERMINAL_Z_RETAINED','sourceParentNativePrivatePaidTiming':'HELD'}
(Q/'task04-native-c5-composition-c4-fresh-review-root-inspection.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
