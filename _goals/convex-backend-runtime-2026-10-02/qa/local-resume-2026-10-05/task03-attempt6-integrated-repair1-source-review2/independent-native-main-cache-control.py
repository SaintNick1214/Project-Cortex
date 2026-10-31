"""Own finite public original A/T fixture; invalid CLI argv blocks all protected paths."""
import pathlib,os,hashlib,json,types,importlib.util,importlib._bootstrap_external,sys,io,contextlib
R=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';Q=QA/'task03-local-native-attempt6-2026-10-06';F=QA/'local-resume-2026-10-05/task03-attempt6-integrated-repair1';J=F.parent/'task03-attempt6-integrated-repair1-source-review2';fields=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns');ad=types.ModuleType('native_control_adapter');exec(compile((F/'held-acquisition.py').read_bytes(),'held_actual_adapter','exec'),ad.__dict__)
fixture=J/'native-as-main-cache-fixture';fixture.mkdir(mode=0o700);a=fixture/'attempt5/source-acquisition.py';t=fixture/'transport-prep/private-transport.py'
for p,source in [(a,Q/'attempt5/source-acquisition.py'),(t,Q/'transport-prep/private-transport.py')]:p.parent.mkdir(mode=0o700,exist_ok=True);p.write_bytes(source.read_bytes());p.chmod(0o600)
def pin(p):return {'PRE':{k:str(getattr(p.stat(),'st_'+k))for k in fields},'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
ap,tp=pin(a),pin(t);calls=[];original=ad.VerifiedDependencyLoader.exec_module
def first_use(self,module):
 st=t.stat();code=compile("UNREVIEWED_CACHE_EXECUTED=True\n",str(t),'exec');pc=pathlib.Path(importlib.util.cache_from_source(str(t)));pc.parent.mkdir(mode=0o700);pc.write_bytes(importlib._bootstrap_external._code_to_timestamp_pyc(code,int(st.st_mtime),st.st_size))
 calls.append('cache-inserted-at-native-T-first-use');result=original(self,module);assert not getattr(module,'UNREVIEWED_CACHE_EXECUTED',False);assert module.NAMES==('jwt-private.pem','target.json','deploy.env');calls.append('original-T-executed');return result
ad.VerifiedDependencyLoader.exec_module=first_use
out=io.StringIO();exit_code=None
try:
 with contextlib.redirect_stdout(out):ad.load_acquisition(a,t,ap,tp,fixture,as_main=True,argv=[str(a)])
except SystemExit as e:exit_code=e.code
assert exit_code==1 and calls==['cache-inserted-at-native-T-first-use','original-T-executed'];assert json.loads(out.getvalue())['failureClass']=='native_source_fence';assert pin(a)==ap and pin(t)==tp
receipt={'scope':'OWN_FINITE_NATIVE_AS_MAIN_ORIGINAL_A_T_FIRST_USE_CACHE_RACE_ONLY','status':'PASS','originalAAndTUnchanged':True,'nativeAsMain':True,'cacheInsertedAtActualTFirstUse':True,'unreviewedCacheExecuted':False,'invalidArgvDeniedBeforePrivatePath':True,'observedExitCode':1,'privateReads':0,'services':0,'Docker':0,'actualNativeOutcomeAccepted':False}
with (J/'independent-native-main-cache-result.json').open('x')as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({'status':'PASS_SOURCE_ONLY','nativeAsMainOriginalDependencyCacheRaceDenied':True,'privateReads':0}))
