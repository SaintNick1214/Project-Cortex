"""Authorized fixed metadata receipts and public retirement records, no credentials."""
import hashlib
import json
import os
from pathlib import Path
import stat

REPO=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
Q=P.parent/'task03-local-native-attempt3-2026-10-05'
S=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt3-private-20261005')
EXPORT=Q/'tmp/actual-private-export-d98bad88-5157-4816-b458-4160e7945361'
OUT=Path(__file__).resolve().parent
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
held=[];pins=[]
def ident(s):return {k:str(getattr(s,k)) for k in FIELDS}
def read_metadata(path,limit=65536):
 assert path.resolve()==path and not path.is_symlink()
 assert path.name not in ['jwt-private.pem','target.json','deploy.env']
 before=path.lstat();assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_uid==501 and before.st_gid==20 and stat.S_IMODE(before.st_mode)==0o600 and before.st_size<=limit
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);held.append((path,fd,ident(before)))
 assert ident(os.fstat(fd))==ident(before);data=os.read(fd,limit+1);assert len(data)==before.st_size
 assert ident(before)==ident(os.fstat(fd))==ident(path.lstat())
 pins.append({'path':str(path),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'currentIdentityDecimal':ident(before)})
 return data
try:
 records={}
 for name in ['provision.receipt.json','host-stage.receipt.json','private-receiver.receipt.json','retire.receipt.json','coordinator-terminal.json']:
  data=read_metadata(S/'coordination'/name);records[name]=json.loads(data)
  (OUT/(name+'.metadata-copy.json')).write_bytes(data)
 for name in ['provision','host-stage','private-receiver','retire']:
  row=records[name+'.receipt.json']
  for stream in ['stdout','stderr']:
   data=read_metadata(S/'coordination'/(name+'.'+stream),262144)
   assert len(data)==row['streamByteCounts'][stream] and hashlib.sha256(data).hexdigest()==row[stream+'Sha256']
   # Each of these exact helper streams is fixed status/count text, never a credential payload.
   (OUT/(name+'.original-'+stream)).write_bytes(data)
 stage=json.loads(read_metadata(EXPORT/'selected/transport-stage.json'))
 assert stage['scope']=='NEW_PROSPECTIVE_PRIVATE_STAGE' and stage['operation']=='d98bad88-5157-4816-b458-4160e7945361'
 assert len(stage['files'])==3 and stage['sourceDescriptorHeld'] is True
 assert {r['path'] for r in stage['files']}=={'jwt-private.pem','target.json','deploy.env'}
 (OUT/'host-stage-custody.metadata-copy.json').write_text(json.dumps(stage,indent=2)+'\n')
 host=[]
 for root in [S,EXPORT,EXPORT/'selected']:
  s=root.lstat();host.append({'path':str(root),'identityDecimal':ident(s),'kind':'directory','mode':oct(stat.S_IMODE(s.st_mode))})
 for row in stage['files']:
  for root,key in [(S,'sourceIdentityDecimal'),(EXPORT/'selected','destinationIdentityDecimal')]:
   path=root/row['path'];s=path.lstat();now=ident(s);host.append({'path':str(path),'identityDecimal':now,'kind':'credential_metadata_only_no_open','equalsStageTuple':now==row[key],'changedFields':[k for k in FIELDS if now[k]!=row[key][k]],'cause':'UNKNOWN_UNLESS_EXPLICIT_RETIREMENT_TARGET_REPLACEMENT'})
 retirement=json.loads(read_metadata(P/'task03-attempt3-target-retirement.json'))
 provision=json.loads(read_metadata(P/'task03-attempt3-target-provision.json'))
 assert retirement['operation']==provision['operation']==stage['operation']
 assert retirement['projectId']==provision['projectId']==3156409 and retirement['deploymentName']==provision['deploymentName']=='gallant-mastiff-565'
 assert retirement['deletionHttpStatus']==200 and retirement['verificationHttpStatus']==404 and retirement['retired'] is True and retirement['deleted'] is True
 assert retirement['managementCalls']==5 and provision['managementCalls']==6
 assert records['private-receiver.receipt.json']['exitCode']==1
 assert records['private-receiver.receipt.json']['streamByteCounts']=={'stdout':149,'stderr':0}
 failure=json.loads((OUT/'private-receiver.original-stdout').read_bytes());assert failure['status']=='FAIL' and failure['failureClass']=='private_transport_fence'
 terminal=records['coordinator-terminal.json'];assert terminal['retired'] is True and terminal['completedSignal'] is False and terminal['failureClass']=='RuntimeError'
 for path,fd,before in held:assert before==ident(os.fstat(fd))==ident(path.lstat())
 result={'status':'AUDITED','scope':'RETIRED_ACTUAL_RECEIVER_FAILURE_METADATA_ONLY','inputPins':pins,'hostMetadataOnly':host,'publicProvisionReceipt':provision,'publicRetirementReceipt':retirement,'hostStageCount':3,'linuxReceiver':'FAIL_PRIVATE_TRANSPORT_FENCE','linuxReceiverOriginalFailingTuple':'UNAVAILABLE_NOT_RECONSTRUCTED','preciseOriginalReceiverFailureStage':'UNKNOWN','operationRetiredNeverRetry':True,'privateCredentialByteReads':0,'copiesOrReplays':0,'sourceOrVolumeWrites':0,'reviewerServiceRequests':0,'reviewerCliDispatches':0,'actualPrivateCustodyAccepted':False,'fullTask03':'OPEN'}
 (OUT/'record-audit.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'status':'AUDITED','hostStageCount':3,'originalLinuxReceiver':'FAIL','projectRetired':True,'managementCalls':11,'privateCredentialByteReads':0,'reviewerServiceRequests':0}))
finally:
 for _,fd,_ in held:os.close(fd)
