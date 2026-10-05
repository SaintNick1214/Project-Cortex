from pathlib import Path
import os, stat, json, hashlib, datetime
T=Path('/dev/shm/cortex-native-c6-closed-launcher-c6')
Q=Path('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa')
def held(p):
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  a=os.fstat(fd);assert stat.S_ISREG(a.st_mode) and a.st_uid==os.getuid() and a.st_nlink==1
  with os.fdopen(os.dup(fd),'rb') as f:b=f.read()
  keys=('st_dev','st_ino','st_mode','st_uid','st_gid','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
  i={k:getattr(a,k) for k in keys};assert i=={k:getattr(os.fstat(fd),k) for k in keys}=={k:getattr(os.lstat(p),k) for k in keys}
  return b,hashlib.sha256(b).hexdigest(),i
 finally:os.close(fd)
raw,h,i=held(T/'owner-loss-control-P7yz4q/proof.json');p=json.loads(raw);o=p['observations'];m=p['message']
assert o['signal']=='SIGKILL_MIDDLE_PID_ONLY' and p['actualExit'] is None and p['signal']=='SIGKILL'
b,c,d,s=(o[k] for k in ('middle','launcher','inner','service'))
assert c['ppid']==b['pid'] and d['ppid']==c['pid'] and s['ppid']==d['pid']
assert b['pgid']==c['pgid']==b['pid'] and d['pgid']==s['pgid']==d['pid']
assert all(r['state'] not in ('Z','X') for r in (b,c,d,s))
assert s['argv']==['/workspace/Project-Cortex/node_modules/@esbuild/linux-x64/bin/esbuild','--service=0.27.0','--ping']
for r in (b,c,d,s):assert r['argvHex']==(('\0'.join(r['argv'])+'\0').encode()).hex()
assert m['signal']=='SIGTERM' and m['exitCode'] is None and m['evidenceComplete'] is False
assert m['quiescence']['complete'] and m['quiescence']['observations'][-1]['rows']==[]
assert {r['stage'] for r in m['secondary']}=={'outer.owner.loss','child.restoration'}
rb,rh,ri=held(m['receiptPath']);receipt=json.loads(rb)
assert receipt['signal']==m['signal'] and receipt['exitCode']==m['exitCode'] and receipt['evidenceComplete'] is False
assert receipt['quiescence']['complete'] and receipt['quiescence']['observations'][-1]['rows']==[]
streams=[]
for r in p['raw']:
 data,dh,di=held(r['path']);assert len(data)==r['bytes'] and dh==r['sha256']
 streams.append(dict(path=r['path'],bytes=len(data),sha256=dh,freshIdentity=di))
census=[]
for r in (b,c,d,s):
 try:
  text=Path('/proc')/str(r['pid'])/'stat';f=text.read_text().rsplit(')',1)[1].strip().split()
  assert f[0] in ('Z','X') or f[19]!=r['startTime']
  census.append(dict(pid=r['pid'],observedState=f[0],observedStartTime=f[19],originalBindingNoLongerLive=True))
 except FileNotFoundError:census.append(dict(pid=r['pid'],absent=True))
out=dict(utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='ROOT_ACTUAL_RETAINED_OWNER_LOSS_CHAIN_AND_FRESH_CENSUS_VERIFIED',proofSHA256=h,proofFreshIdentity=i,receiptSHA256=rh,receiptFreshIdentity=ri,beforeSignalRecordedBindings=o,streams=streams,freshProcessCensus=census,actualMiddleExit=None,actualMiddleSignal='SIGKILL',actualChildExit=None,actualChildSignal='SIGTERM',evidenceComplete=False,secondaryFailures=m['secondary'],qualification='FOCUSED_OWNER_LOSS_ONLY_ORIGINAL122_AND_FULL_GATE_HELD',limitation='Before-signal process bindings are historical recorded observations; current census independently establishes those bound processes are no longer live. Missing child restoration is retained, not repaired retroactively.')
with (Q/'task04-native-c6-root-owner-loss-proof-inspection.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps(dict(status=out['status'],proofSHA256=h,processesChecked=len(census))))
