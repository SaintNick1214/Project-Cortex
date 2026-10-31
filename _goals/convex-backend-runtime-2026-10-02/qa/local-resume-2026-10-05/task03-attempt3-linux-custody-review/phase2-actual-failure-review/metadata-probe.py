"""Read metadata only; never open or consume a credential file."""
import json
import os
from pathlib import Path
import stat
import sys

FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
def identity(s):return {k:str(getattr(s,k)) for k in FIELDS}
def metadata(path):
 s=path.lstat();return {'path':str(path),'identityDecimal':identity(s),'mode':oct(stat.S_IMODE(s.st_mode)),'directory':stat.S_ISDIR(s.st_mode),'regular':stat.S_ISREG(s.st_mode),'symlink':stat.S_ISLNK(s.st_mode)}
assert os.getuid()==501 and os.getgid()==20
assert Path('/sys/fs/cgroup/memory.max').read_text().strip()=='536870912'
assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip()=='0'
before=metadata(Path('/owned/private'))
destination=[]
for path in Path('/owned/private').iterdir():destination.append(metadata(path))
parent=metadata(Path('/export'))
try:child=metadata(Path('/export/selected'))
except OSError as error:child={'path':'/export/selected','metadata':'UNAVAILABLE','failureClass':type(error).__name__}
observations={}
try:
 names=sorted(p.name for p in Path('/export/selected').iterdir())
 observations['members']=names
 observations['files']=[metadata(Path('/export/selected')/name) for name in names]
except OSError as error:
 observations={'memberEnumeration':'UNAVAILABLE','failureClass':type(error).__name__,'privateFilesOpened':0}
if 'identityDecimal' in child:
 s=Path('/export/selected').lstat()
 source_directory_fences={'canonical':Path('/export/selected').resolve()==Path('/export/selected'),'directory':stat.S_ISDIR(s.st_mode),'notSymlink':not stat.S_ISLNK(s.st_mode),'uid501':s.st_uid==501,'gid20':s.st_gid==20,'mode0700':stat.S_IMODE(s.st_mode)==0o700}
 first_fence='SOURCE_OWNED_DIRECTORY' if not all(source_directory_fences.values()) else 'NONE_METADATA_FENCES_PASS_LATER_BYTE_OR_BINDING_STAGE_UNEXAMINED'
else:
 source_directory_fences={'metadataAvailable':False,'selectedOwnership':'UNKNOWN'}
 first_fence='SOURCE_PLACEMENT_ANCESTOR_PERMISSION_OR_METADATA_UNAVAILABLE'
baseline=json.loads(Path('/public-baseline.json').read_bytes())
private_old=next(r['identityDecimal'] for r in baseline['directories'] if r['path']=='private')
private_equal=private_old==before['identityDecimal']
rows={r['path']:r for r in baseline['files']}
seen=[];public_deltas=[]
for root,dirs,files in os.walk('/owned/candidate',followlinks=False):
 for name in files:
  path=Path(root)/name;rel=str(path.relative_to('/owned/candidate'));seen.append(rel)
  current=identity(path.lstat())
  assert rel in rows
  if current!=rows[rel]['identityDecimal']:public_deltas.append({'path':rel,'changedFields':[k for k in FIELDS if current[k]!=rows[rel]['identityDecimal'][k]],'cause':'UNKNOWN'})
assert set(seen)==set(rows) and len(seen)==972
assert metadata(Path('/owned/private'))==before
if 'identityDecimal' in child:assert metadata(Path('/export/selected'))==child
print(json.dumps({'status':'OBSERVED','scope':'ACTUAL_POST_FAILURE_METADATA_ONLY','uid':os.getuid(),'gid':os.getgid(),'exportPlacementParent':parent,'selectedChildCurrent':child,'selectedChildMetadataFences':source_directory_fences,'currentFirstMetadataFence':first_fence,'selectedChildObservation':observations,'destinationPrivate':before,'destinationPrivateEntryCount':len(destination),'destinationPrivateFiles':destination,'destinationPrivateAll9EqualsPhase1EmptyBaseline':private_equal,'publicCandidateMetadataFiles':972,'publicCandidateMetadataDeltas':public_deltas,'privateCredentialByteReads':0,'receiverReplay':False,'sourceOrVolumeWrites':0,'actualServiceRequests':0,'actualCliDispatches':0,'originalReceiverFailingTuple':'UNAVAILABLE_NOT_RECONSTRUCTED','originalFailureStage':'UNKNOWN_FIXED_FENCE_OUTPUT_ONLY','cause':'UNKNOWN','operationRetiredNeverRetry':True}));sys.stdout.flush()
assert metadata(Path('/owned/private'))==before
if 'identityDecimal' in child:assert metadata(Path('/export/selected'))==child
