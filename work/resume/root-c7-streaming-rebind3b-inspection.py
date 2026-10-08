from pathlib import Path
import os,stat,json,hashlib,datetime
W=Path('/workspace/Project-Cortex/work/resume/task04-c7-exact-identity-repair');Q=Path('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa');K=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);b=b''
  while True:
   c=os.read(fd,1048576)
   if not c:break
   b+=c
  ids=lambda s:{x:str(getattr(s,'st_'+x)) for x in K}
  assert stat.S_ISREG(a.st_mode) and a.st_nlink==1 and ids(a)==ids(os.fstat(fd))==ids(os.lstat(p));return b,{'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'identity':ids(a)}
 finally:os.close(fd)
b,pin=held(W/'rebind3b-PRE.json');pre=json.loads(b);b,zpin=held(W/'rebind3b-receipt.json');post=json.loads(b);b,gpin=held(W/'rebind3b-group-PRE.json');group=json.loads(b)
a=dict(x.split() for x in pre['resourcePRE']['memory.events'].splitlines());b=dict(x.split() for x in post['resourcePOST']['memory.events'].splitlines());assert post['actualExit']==0 and post['signal'] is None and not post['timeout'] and post['deadlineSeconds']==pre['deadlineSeconds']==120 and post['sourceToolsExactEqual'] and post['finalGroupCensus']['rows']==[] and post['finalGroupCensus']['effectfulRows']==[] and post['groupBinding']==group and post['argv']==pre['argv'];assert int(b['oom'])-int(a['oom'])==int(b['oom_kill'])-int(a['oom_kill'])==0
raws=[]
for row in post['raws']:
 content,r=held(Path(row['path']));assert r['bytes']==row['bytes'] and r['sha256']==row['sha256'];raws.append(r)
for name in ('owner','initial'):
 row=group[name];raw,p=held(Path(row['rawBeforeByteBacking']['path']));expected=row['rawBeforeByteBacking'];assert raw.decode()==row['raw'] and p['sha256']==expected['sha256'] and p['bytes']==expected['bytes'] and p['identity']==expected['identity']['fields'];tail=row['raw'][row['raw'].rfind(')')+2:].split();assert tail[19]==row['startTime'] and int(tail[1])==row['ppid'] and int(tail[2])==row['pgid'];raws.append(p)
assert group['initial']['pid']==group['pgid']==group['initial']['pgid'] and group['initial']['startTime']==group['startTime'];assert bytes.fromhex(group['rawArgvHex']).split(b'\0')[:-1]==[x.encode() for x in group['argv']]
pid=group['pgid'];p=Path('/proc')/str(pid)/'stat';fresh='ABSENT'
try:
 s=p.read_text();start=s[s.rfind(')')+2:].split()[19];fresh='SAME_BOUND_PROCESS_STILL_PRESENT' if start==group['startTime'] else 'PID_REUSED_DIFFERENT_STARTTIME';assert fresh!='SAME_BOUND_PROCESS_STILL_PRESENT'
except FileNotFoundError:pass
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'ROOT_RECORDED_STREAMING_REBIND3B_EXIT0_PROCESS_EVIDENCE_VERIFIED_NOT_ACCEPTANCE','sourcePRE':pin,'receipt':zpin,'groupPRE':gpin,'raws':raws,'recordedExit':0,'signal':None,'elapsedSeconds':post['elapsedSeconds'],'timeout':False,'deadlineSeconds':120,'OOMDelta':0,'OOMKillDelta':0,'recordedFinalGroupCensusEmpty':True,'freshBoundProcessObservation':fresh,'sourceToolPOST':'Recorded exact equality; full preimage inspection reserved for frozen packet review','limits':'Recorded streaming producer execution and raw process evidence only. Current consumer controls, source audits and full candidate qualification remain incomplete. Initial and failed/OOM versions preserved; no original122/whole/native/private/paid/ROOT approval release.'}
(Q/'task04-c7-streaming-rebind3b-root-inspection.json').open('x').write(json.dumps(out,indent=2)+'\n');print({x:y for x,y in out.items() if x not in ['sourcePRE','receipt','groupPRE','raws']})
