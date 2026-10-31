"""Finite current regular-source baseline/consumer/closure; no enclosing Mac seal."""
import hashlib,json,os,stat,subprocess,sys,traceback
from pathlib import Path
N=Path(__file__).resolve().parents[1];P=N.parent;R=P.parents[3]
O=P/'task04-current-producer-native-public-preparation1';J=P/'task04-current-producer-native-public-preparation-source-review1'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def dump(path,obj):
 raw=(json.dumps(obj,sort_keys=True,indent=2)+'\n').encode()
 with open(path,'xb')as f:f.write(raw);f.flush();os.fsync(f.fileno())
 return {'path':str(path.relative_to(N)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def failure_hook(kind,error,tb):
    failure={'scope':'FAILED_FINITE_CLOSURE_NO_AUTHORITY','type':kind.__name__,'error':str(error),
             'failedPRERefreshed':False,'allPreviousOutputsRemain':True,'runtimeAuthority':False}
    try:dump(N/'evidence/closing-failure1.json',failure)
    finally:traceback.print_exception(kind,error,tb)
sys.excepthook=failure_hook

def openone(path):
 pre=ident(os.lstat(path))
 if int(pre['mode'])&0o170000!=0o100000 or pre['nlink']!='1' or path.resolve()!=path:raise ValueError('FINITE_REGULAR_LITERAL_ONLY:'+str(path))
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);opened=ident(os.fstat(fd))
 if opened!=pre:os.close(fd);raise ValueError('OPEN_NINE_DRIFT')
 return {'path':str(path),'PRE':pre,'OPEN':opened,'fd':fd}
def hashone(row,backing=None,expected=None):
 path=Path(row['path']);fd=row['fd'];os.lseek(fd,0,os.SEEK_SET);h=hashlib.sha256();count=0
 out=open(backing,'xb')if backing else None
 try:
  while b:=os.read(fd,65536):
   count+=len(b)
   if count>16777216:raise ValueError('FINITE16M_CURRENT_READ_CAP')
   h.update(b)
   if out:out.write(b)
  if out:out.flush();os.fsync(out.fileno())
 finally:
  if out:out.close()
 post=ident(os.fstat(fd));final=ident(os.lstat(path));sha=h.hexdigest()
 if row['PRE']!=post or row['PRE']!=final or count!=int(row['PRE']['size']):raise ValueError('CURRENT_FULL_EOF_NINE_DRIFT')
 if expected is not None:
  pin=expected['identity']if 'identity'in expected else expected['PRE']
  if row['PRE']!=pin or (count,sha)!=(expected.get('size',expected.get('bytes')),expected['sha256']):raise ValueError('UNCHANGED_LITERAL_PRIOR_PIN:'+str(path))
 return {'path':str(path),'PRE':row['PRE'],'OPEN':row['OPEN'],'POST':post,'pathFINAL':final,'bytes':count,'sha256':sha,'EOF':True}
def fence(row):
 if ident(os.fstat(row['fd']))!=row['PRE']or ident(os.lstat(row['path']))!=row['PRE']:raise ValueError('FINAL_CURRENT_NINE_DRIFT:'+row['path'])
def closeall(rows):
 closed=[]
 for row in rows:
  returned=os.close(row['fd']);closed.append({'path':row['path'],'return':returned})
 return closed
def git():
 def c(*args):
  return subprocess.run(['git',*args],cwd=R,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'},capture_output=True,check=True,text=True,timeout=15).stdout
 return {'HEAD':c('rev-parse','HEAD').strip(),'branch':c('branch','--show-current').strip(),'trackedStatus':c('status','--porcelain=v1','--untracked-files=no')}
# These closing programs/outputs are the sole remaining writer. All source/control/docs writers stopped.
stop={'schema':'SOURCE_CONTROL_DOC_WRITERS_STOPPED_BEFORE_FIRST_PROSPECTIVE_BASELINE_V1',
      'sourceWritersStopped':True,'controlWritersStopped':True,'reportVerdictDocsFinal':True,
      'closureWriterOnlyOutputs':['source-baseline1.json','source-consumer1.json','source-digests.sha256','external-current1.json','packet-manifest1.json','final-current-closure.json','closed-handoff.json'],
      'noFurtherSourceWrites':True,'noHistoricalPinRefresh':True,'wholeMacSealAttempted':False,'runtimeAuthority':False}
dump(N/'writer-stop.json',stop)
initial_git=git()
if initial_git['HEAD']!='36c43a5fb4adcb0ea5965bdf4526070c4622a138'or initial_git['branch']!='feat/convex-backend-runtime-completion':raise ValueError('KNOWN_GIT_QUIESCENCE_BASELINE')
book_paths=[R/'_goals/convex-backend-runtime-2026-10-02/qa/execution-progress.md',P/'current-state.md',R/'_goals/convex-backend-runtime-2026-10-02/qa/outcome-matrix.md']
books=[openone(p)for p in book_paths]
source_files=sorted((N/'source').rglob('*'));source_files=[p for p in source_files if p.is_file()]
if len(source_files)!=113:raise ValueError('EXACT112_PLUS_MF_SOURCE_MEMBERSHIP')
# Open every source and MF before consuming any source bytes.
source_held=[openone(p)for p in source_files];baseline=[]
# Manifest FD is already held before its first parse or any source-body reads.
manifest_held=next(r for r in source_held if r['path']==str(N/'source/source-manifest.json'))
manifest_observed=hashone(manifest_held)
os.lseek(manifest_held['fd'],0,os.SEEK_SET)
def pairs(items):
 obj={}
 for key,value in items:
  if key in obj:raise ValueError('DUPLICATE_SOURCE_MANIFEST_KEY')
  obj[key]=value
 return obj
manifest=json.loads(os.read(manifest_held['fd'],65537),object_pairs_hook=pairs)
fence(manifest_held)
if manifest['fileCount']!=112 or manifest['sourceBytes']!=2136695 or len(manifest['files'])!=112:raise ValueError('FINAL_SOURCE_MANIFEST_COUNTS')
manifest_rows={r['path']:r for r in manifest['files']}
if len(manifest_rows)!=112 or sorted(manifest_rows)!=sorted(p.relative_to(N/'source').as_posix()for p in source_files if p.name!='source-manifest.json'):raise ValueError('EXACT_SOURCE_MEMBERSHIP')
raw=N/'evidence/source-baseline-raw1';raw.mkdir()
try:
 for index,row in enumerate(source_held):
  backing=raw/str(index).zfill(4);value=hashone(row,backing=backing)
  rel=Path(row['path']).relative_to(N/'source').as_posix()
  if rel!='source-manifest.json':
   pin=manifest_rows[rel]
   if(value['bytes'],value['sha256'])!=(pin['bytes'],pin['sha256']):raise ValueError('FINAL_SOURCE_MANIFEST_BYTE_PIN:'+rel)
  elif(value['bytes'],value['sha256'])!=(manifest_observed['bytes'],manifest_observed['sha256']):raise ValueError('HELD_MANIFEST_BYTE_DRIFT')
  baseline.append({**value,'relativePath':rel,'backing':str(backing.relative_to(N))})
 for row in source_held:fence(row)
finally:source_closes=closeall(source_held)
baseline_pin=dump(N/'evidence/source-baseline1.json',{'scope':'DISTINCT_NEW_CURRENT_REGULAR_SOURCE_BASELINE_NOT_HISTORICAL','files':baseline,'count':113,'totalBytes':sum(r['bytes']for r in baseline),'sourceFDCloses':source_closes,'writerStopPrecedesBaseline':True,'wholeMacPhysicalAuthority':False})
# Distinct consumer: reopen every literal current source against that new baseline, never old failed pins.
consumer_held=[openone(Path(row['path']))for row in baseline];consumer=[]
try:
 for row,pin in zip(consumer_held,baseline):consumer.append(hashone(row,expected=pin))
 for row in consumer_held:fence(row)
finally:consumer_closes=closeall(consumer_held)
consumer_pin=dump(N/'evidence/source-consumer1.json',{'scope':'DISTINCT_NEW_BASELINE_CONSUMER_CURRENT_FILES_ONLY','baseline':baseline_pin,'files':consumer,'count':113,'sourceFDCloses':consumer_closes,'mismatches':0,'historicalCustodyRepaired':False,'nativeExecuted':False})
digests=''.join(r['sha256']+'  source/'+r['relativePath']+'\n'for r in baseline).encode()
with open(N/'source-digests.sha256','xb')as f:f.write(digests)
# Prior closed metadata is pinned before parse. Preserve its rejected state and unknown own ctime failures.
known={'report.md':('cfdd5fdb3f22ced76ba8c6df8cc082fc2bf531b3d4d0c15654690a987246e02f',11828),
 'verdict.json':('d694a2f7922198ac4dba4a83ac4b8d8f655d18df8508f19fa1a05b0c4db481a4',2072),
 'final-current-closure.json':('b5643db46edc71f6fa4a0da144da1c40d78252395797c49bee7fa7cfb2779bb8',1166735),
 'writer-stop.json':('3c3d71642cb54065cbb15db0427e52a054781297a56c560068bc3537d75ac61d',611),
 'independent-control-results1.json':('548821edbdccc6bbd435018b256bcbbb904f86b87ca6dddf9175a9e856f23e17',2709)}
metadata_held=[openone(J/name)for name in known];metadata=[]
try:
 for row,(name,(sha,size))in zip(metadata_held,known.items()):
  value=hashone(row)
  if(value['sha256'],value['bytes'])!=(sha,size):raise ValueError('EXACT_REVIEW_CLOSED_PIN')
  metadata.append(value)
 closure=json.loads((J/'final-current-closure.json').read_bytes())
 if closure['externalFileCount']!=336 or len(closure['externalFiles'])!=336:raise ValueError('EXACT336_PRIOR_PIN_VECTOR')
 external_held=[openone(R/row['expected']['path'])for row in closure['externalFiles']];external=[]
 try:
  for row,pin in zip(external_held,closure['externalFiles']):external.append(hashone(row,expected=pin['expected']))
  for row in external_held:fence(row)
 finally:external_closes=closeall(external_held)
 for row in metadata_held:fence(row)
finally:metadata_closes=closeall(metadata_held)
external_pin=dump(N/'evidence/external-current1.json',{'scope':'CURRENT_MATCHING336_LITERAL_CLOSED_EXTERNAL_PINS_ONLY','files':external,'count':336,'bytes':sum(r['bytes']for r in external),'closes':external_closes,
 'priorRejectedReviewMetadata':metadata,'metadataCloses':metadata_closes,'priorOwnUnknownCtimeFailuresPreserved':closure['errors'],
 'noPriorOwnFailedPinReused':True,'N4EnclosingFailuresPreserved':True,'historicalCustodyRepaired':False})
# Finite raw packet files; manifest and closure/handoff are excluded from their own cycles.
packet_paths=sorted(p for p in N.rglob('*')if p.is_file())
packet_held=[openone(p)for p in packet_paths];packet=[]
try:
 for row in packet_held:
  v=hashone(row);v['relativePath']=Path(row['path']).relative_to(N).as_posix();packet.append(v)
 for row in packet_held:fence(row)
finally:packet_closes=closeall(packet_held)
packet_pin=dump(N/'packet-manifest1.json',{'scope':'FINITE_CURRENT_REGULAR_PACKET_MEMBERS_NOT_ROOT_PHYSICAL_SEAL','files':packet,'count':len(packet),'bytes':sum(v['bytes']for v in packet),'closeReturns':packet_closes,
 'excludedCycleFiles':['packet-manifest1.json','final-current-closure.json','closed-handoff.json'],'enclosingRootSeal':'NOT_ATTEMPTED','nativeAuthority':False})
# Final fences independently reopen source and regular packet pins; no source/report edits follow.
all_pins=consumer+packet
unique={v['path']:v for v in all_pins}
final_held=[openone(Path(path))for path in sorted(unique)];final=[]
try:
 for row in final_held:final.append(hashone(row,expected=unique[row['path']]))
 for row in final_held:fence(row)
 for row in books:fence(row)
 final_git=git()
 if final_git!=initial_git:raise ValueError('GIT_NOT_QUIESCENT')
 book_rows=[hashone(row)for row in books]
finally:
 final_closes=closeall(final_held);book_closes=closeall(books)
final_pin=dump(N/'final-current-closure.json',{'schema':'FINITE_SOURCE_REPAIR_CLOSED_CURRENT_V1','status':'CURRENT_REGULAR_FILES_MATCH','scope':'FINITE_CURRENT_SOURCE_PACKET_EXTERNAL_ONLY_NO_NATIVE_RELEASE',
 'sourceBaseline':baseline_pin,'sourceConsumer':consumer_pin,'external336':external_pin,'packetManifest':packet_pin,
 'regularFiles':final,'closeReturns':final_closes,'rootBooks':book_rows,'rootBookCloses':book_closes,'gitBefore':initial_git,'gitAfter':final_git,
 'sourceCountExcludingMF':112,'sourceBytesExcludingMF':2136695,'rootBooksAndGitQuiescent':True,
 'oldFailuresUnknownPreserved':True,'failedPRERefreshed':False,'historicalCustodyRepaired':False,'wholeMacSealAttempted':False,
 'sourceEligibility':'PENDING_NEW_FRESH_INDEPENDENT_JUDGE','runtimeAuthority':False,'task04FunctionalAccepted':False,'full17GoalAccepted':False})
important=['report.md','verdict.json','writer-stop.json','source/source-manifest.json','source-digests.sha256','controls/repair-control-results5.json',
 'controls/python-syntax-results2.json','controls/js-syntax-results1.json','evidence/old-to-new-delta-map1.json','evidence/original-conservation-proof1.json',
 'qualification-map.json','admission-proposal.json','task04-current-producer-native-public.yml.proposed']
pins=[]
for rel in important:
 raw=(N/rel).read_bytes();pins.append({'path':rel,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
handoff={'schema':'NON_ENABLING_CLOSED_SOURCE_REPAIR_HANDOFF_V1','scope':'BOUNDED_PUBLIC_SOURCE_REPAIR_ONLY','implementationStatus':'PREPARED_CLOSED_PENDING_NEW_FRESH_INDEPENDENT_JUDGE',
 'exactPins':pins+[baseline_pin,consumer_pin,external_pin,packet_pin,final_pin],
 'allWritersStoppedAfterThisReceipt':True,'sourceWritersStoppedBeforeBaseline':True,'rootBooksAndGitQuiescentDuringCapture':True,
 'sourceCountExcludingMF':112,'sourceBytesExcludingMF':2136695,'sourceDelta':'106 byte-exact+5 repaired+1 new; all100 original bytes conserved',
 'sourceEligibility':'PENDING_NEW_FRESH_INDEPENDENT_JUDGE','independentPASS':False,'activation':'HELD','publicationBinding':'HELD',
 'nativeExecuted':False,'DockerExecuted':False,'networkExecuted':False,'lifecycleInstallExecuted':False,'GitMutated':False,'productEdited':False,
 'finalMockStaticPASS':83,'finalMockStaticFAIL':0,'PythonASTPASS':19,'JavaScriptSyntaxPASS':87,
 'originalBootstrap48And20BytesUnchanged':True,'twoSeparatePID1Owners':True,'crossPhaseNativeCustody':'ABSENT','trustedStartupCacheFirstUseClosure':'NOT_CLAIMED',
 'all336PriorExternalPinsMatched':True,'N4FailedEnclosingMacSealsPreserved':True,'independentReviewOwnTwoUnknownCtimeFailuresPreserved':True,
 'wholeMacSealAttempted':False,'failedPRERefreshed':False,'historicalCustodyRepaired':False,
 'sixOriginalTask04Outcomes':'OPEN','full17Goal':'OPEN','original122':'HELD','eightCompiler20':'HELD','whole120':'HELD','FULL_RPC':'HELD','ROOT':'ABSENT',
 'nativeSkipped':['Linux pidfd/O_PATH/maps/cgroup','actualDockerBindings','currentOWN20','currentPublic48','originalFullQualification','allTask04Functional'],
 'nativeResourceRelease':'UNOBSERVED_HOLD','newInfrastructureImageBuildAllowance720':'PROPOSAL_ONLY','originalDeadlinesWeakened':False,
 'nextStep':'NEW_FRESH_INDEPENDENT_JUDGE_BEFORE_ANY_WORKFLOW_ACTIVATION_OR_NATIVE_EFFECT'}
handoff_pin=dump(N/'closed-handoff.json',handoff)
print(json.dumps({'handoff':handoff_pin,'closure':final_pin,'sourceMF':next(x for x in pins if x['path']=='source/source-manifest.json'),'packet':packet_pin,'writerStop':next(x for x in pins if x['path']=='writer-stop.json')}))
