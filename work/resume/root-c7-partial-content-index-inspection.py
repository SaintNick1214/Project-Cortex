import pathlib,os,json,gzip,hashlib,datetime,stat
R=pathlib.Path('/workspace/Project-Cortex');T=pathlib.Path('/dev/shm/cortex-root-c7-partial-content-backing');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-partial-content-backing';F=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def ident(s):return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in F}}
def held(p,expected=None):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_nlink==1;h=hashlib.sha256();n=0
  while b:=os.read(fd,262144):h.update(b);n+=len(b)
  out={'bytes':n,'sha256':h.hexdigest(),'identity':ident(a)};assert ident(a)==ident(os.fstat(fd))==ident(os.lstat(p))
  if expected:assert all(out[k]==expected[k] for k in ('bytes','sha256','identity'))
  return out
 finally:os.close(fd)
receipt=json.loads((Q/'final-partial-receipt.json').read_text());p=T/'partial-index.json.gz';encoded=held(p,receipt['index']['encoded']);h=hashlib.sha256();n=0
with gzip.open(p,'rb') as f:
 while b:=f.read(65536):h.update(b);n+=len(b)
assert n==9052828==receipt['index']['decodedBytes'] and h.hexdigest()=='1810bb1f7646d62c3d4c4e3964bff2543f4c8ddb0f2e000d66d00fd16a346f96'==receipt['index']['decodedSHA256']
namespace={'__name__':'root_static_parser'};source=(R/'work/resume/root-c7-static-stream-json.py').read_bytes();exec(compile(source,'root-c7-static-stream-json.py','exec'),namespace)
counts={'sourceRows':0,'files':0,'fileBytes':0,'objects':0,'newObjects':0,'priorObjects':0};seen=set()
def row(key,r):
 counts[key]+=1
 if key=='sourceRows':
  p=pathlib.Path(r['literalPath']);a=os.lstat(p);assert ident(a)==r['identity']
  if r['kind']=='file':held(p,r);counts['files']+=1;counts['fileBytes']+=r['bytes'];assert r['availability']==('CURRENT_FROZEN_SOURCE_ONLY_NO_COMPLETE_PUBLISHED_DELTA' if r['backing']=='NEW_UNALLOCATED' else 'AUTHENTICATED_PRIOR_CONTENT_ONLY')
  elif r['kind']=='directory':assert sorted(os.listdir(p))==r['members']
  elif r['kind']=='symlink':assert os.readlink(p)==r['literalTarget'] and hashlib.sha256(os.fsencode(r['literalTarget'])).hexdigest()==r['literalTargetSHA256']
  else:raise AssertionError(r['kind'])
  assert ident(a)==ident(os.lstat(p))
 else:
  assert r['sha256'] not in seen;seen.add(r['sha256']);counts['newObjects' if r['backing']=='NEW_UNALLOCATED' else 'priorObjects']+=1
  assert r['availability']==('CURRENT_FROZEN_SOURCE_ONLY_NO_COMPLETE_PUBLISHED_DELTA' if r['backing']=='NEW_UNALLOCATED' else 'AUTHENTICATED_PRIOR_CONTENT_ONLY')
with gzip.open(p,'rb') as f:
 def chunks():
  while b:=f.read(16384):yield b
 parser=namespace['Reader'](chunks(),valueLimit=4*1024*1024);header=parser.top(arrayKeys=('sourceRows','objects'),item=row)
assert counts=={'sourceRows':9590,'files':9395,'fileBytes':956563182,'objects':7798,'newObjects':4224,'priorObjects':3574}
transport=header['transport'];assert transport['completeArchive'] is False and transport['completeGzipEOFCRC'] is False and transport['newDeltaObjectsClaimedFullyPublished']==0 and transport['verifiedRemotePartCount']==5 and transport['unverifiedPlannedParts']==31 and transport['notProducedParts']==30
for entry in transport['verifiedRemoteParts']:
 ack=entry['remoteAck'];assert ack['schema']=='C7_REMOTE_PART_ACK_V2' and ack['fetchedImmutableBlobBytesCompared'] and ack['immutableStoredContentCompared'] and ack['fetchGitSHA']==ack['storedGitBlobSHA']==ack['uploadReturnedGitSHA'];assert not pathlib.Path(entry['rawPart']['path']).exists() or pathlib.Path(entry['rawPart']['path']).name=='objects.part-0005'
for entry in transport['preservedUnackedLocalParts']:held(pathlib.Path(entry['rawPart']['path']),entry['currentRawSpoolProof'])
result={'scope':'ROOT_PARTIAL_CONTENT_INDEX_CURRENT_SOURCES_AND_EXPLICIT_GAPS_NOT_COMPLETE_ARCHIVE','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'encoded':encoded,'decodedBytes':n,'decodedSHA256':h.hexdigest(),'counts':counts,'verifiedRemoteParts':5,'unverifiedPlannedParts':31,'wholeArchiveComplete':False,'historicalGaps':header['historicalGaps'],'remoteVerification':'Individual actual ROOT upload/fetch exactASCII comparisons recorded separately; complete gzip archive unavailable.','original122':'HELD','whole120':'UNQUALIFIED'}
out=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c7-partial-content-index-root-inspection.json';assert not out.exists();out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'counts':counts,'decodedBytes':n,'wholeArchiveComplete':False,'verifiedRemoteParts':5,'unverifiedPlannedParts':31}))
