from pathlib import Path
import copy,importlib.util,json,os
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06';P=Q.parent/'local-resume-2026-10-05/task03-attempt6-integrated-preparation'
spec=importlib.util.spec_from_file_location('public_mock_phase_controls',Q/'integrated/official-dispatcher.py');D=importlib.util.module_from_spec(spec);spec.loader.exec_module(D)
rows=[]
class Clock:
 def __init__(self):self.now=0
 def monotonic(self):return self.now
 def sleep(self,n):self.now+=n

def case(name,key,late=None,foreign=False):
 clock=Clock();D.time=clock;D.DEADLINE=2400;cid='a'*64;container='cortex-task03-attempt6-'+key+'-'+D.OP[:8];D.owned={container:cid};D.recipes={key:{'name':container,'containerId':cid,'cmd':[], 'requestedMounts':[], 'selectedLiteralMapping':''}};effects=[]
 def metadata(label):
  if '-poll-'in label:clock.now=late if late is not None else 1
  return {'Name':'/'+container,'Id':('b'*64 if foreign else cid),'Image':D.IMAGE,'Config':{'Image':D.IMAGE,'Labels':{'cortex.operation':D.OP,'cortex.goal':'convex-backend-runtime-2026-10-02','cortex.scope':'official-current-foundation-execution'}},'State':{'Running':False,'Status':'created'if'pre-start'in label else'exited','Pid':0,'ExitCode':0,'OOMKilled':False,'Error':''}}
 def inspect(cid,label):effects.append(('inspect',label));return metadata(label)
 def recipe(o,name,cmd,mounts,mapping):D.owner(o,name);return mapping
 def run(label,argv,timeout=30,required=True):
  effects.append(('run',argv));out={'phase':'deploy','status':'PASS'}if key=='deploy'else{'status':'PASS','cleanupComplete':True}
  return {'exitCode':0},(json.dumps(out)+'\n').encode(),b''
 def absence(cid,label):effects.append(('absence',cid))
 D.inspect=inspect;D.recipe=recipe;D.run=run;D.absence=absence
 passed=False
 try:out=D.phase(key);passed=out['status']=='PASS'
 except AssertionError:pass
 expected=late is None and not foreign
 assert passed is expected
 if foreign:assert not any(x[0]=='run'for x in effects)
 if late is not None:assert not any(x[0]=='run'and x[1][:2]==['docker','logs']for x in effects)
 rows.append({'name':name,'status':'PASS','observedAcceptance':passed,'effectSubstitution':True,'realEffects':0})
case('deploy-success-complete-phase','deploy');case('native-success-complete-phase','driver');case('late-terminal1261-denied-before-logs','driver',1261);case('foreign-pre-start-denied-without-start','driver',foreign=True)
# Entire minimum admission check runs before any mocked metadata/effect.
for key,remaining in [('deploy',2019),('driver',1709)]:
 D.DEADLINE=D.time.monotonic()+remaining
 D.recipes[key]={'name':'x','containerId':'x','cmd':[], 'requestedMounts':[], 'selectedLiteralMapping':''}
 effects=[];D.inspect=lambda *args:effects.append(args)
 try:D.phase(key);raise AssertionError('Admission accepted')
 except AssertionError as e:assert str(e)=='complete_phase_and_cleanup_windows_not_admitted'
 assert effects==[];rows.append({'name':key+'-whole-window-shortfall-no-effect','status':'PASS','realEffects':0})
result={'scope':'EXACT_PHASE_EXECUTION_EFFECT_SUBSTITUTED_ONLY','status':'PASS','count':len(rows),'rows':rows,'privateReads':0,'DockerCalls':0,'actualNativeAccepted':False}
fd=os.open(P/'phase-control-results.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w')as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:result[k]for k in('scope','status','count','privateReads','actualNativeAccepted')}))
