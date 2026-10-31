"""Own finite fixture only; unchanged public source bytes, no protected key or service."""
import hashlib,importlib.util,importlib._bootstrap_external,json,os,pathlib,sys,types
R=pathlib.Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06'
J=R/'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-source-review1'
assert sys.dont_write_bytecode is True
fixture=J/'finite-cached-dependent-import-fixture';fixture.mkdir(mode=0o700);(fixture/'attempt5').mkdir(mode=0o700);(fixture/'transport-prep').mkdir(mode=0o700)
originalA=(Q/'attempt5/source-acquisition.py').read_bytes();originalT=(Q/'transport-prep/private-transport.py').read_bytes()
a=fixture/'attempt5/source-acquisition.py';t=fixture/'transport-prep/private-transport.py'
for p,b in ((a,originalA),(t,originalT)):
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'wb')as f:f.write(b);f.flush();os.fsync(f.fileno())
# Source was byte qualified and no dependency cache existed at the preceding gate.
assert hashlib.sha256(t.read_bytes()).digest()==hashlib.sha256(originalT).digest()
assert not (fixture/'transport-prep/__pycache__').exists()
s=t.stat();code=compile("CACHED_UNREVIEWED_CODE_EXECUTED=True\nNAMES=('jwt-private.pem','target.json','deploy.env')\nMANIFEST='transport-stage.json'\n",str(t),'exec')
pyc=importlib._bootstrap_external._code_to_timestamp_pyc(code,int(s.st_mtime),s.st_size)
cache=pathlib.Path(importlib.util.cache_from_source(str(t)));cache.parent.mkdir(mode=0o700);cache.write_bytes(pyc)
# All accepted .py source bytes/identities are unchanged. The new initial loader
# compiles A from verified bytes, but A's transitive SourceFileLoader can read .pyc.
assert t.read_bytes()==originalT
m=types.ModuleType('independent_original_source_acquisition');m.__file__=str(a);m.__package__=''
exec(compile(originalA,str(a),'exec',dont_inherit=True),m.__dict__)
assert getattr(m.T,'CACHED_UNREVIEWED_CODE_EXECUTED',False) is True
out={'scope':'OWN_FINITE_FIXTURE_UNCHANGED_TRANSITIVE_DEPENDENT_IMPORT_ONLY','status':'UNSAFE_CACHED_CODE_ACCEPTANCE_REPRODUCED','pythonB':sys.dont_write_bytecode,'originalASha256':hashlib.sha256(originalA).hexdigest(),'originalTSha256':hashlib.sha256(originalT).hexdigest(),'compiledAFromReviewedBytes':True,'precedingSourceQualificationPassed':True,'precedingCacheAbsencePassed':True,'transitiveUnreviewedPycExecuted':True,'sourceAAndTBytesUnchanged':True,'sourceLocation':'attempt5/source-acquisition.py:17-19','callerLocation':'integrated/private-coordinate.py:263-264','privateReads':0,'DockerCalls':0,'serviceCalls':0,'CLIExecuted':False,'nativeQualificationExecuted':False,'fixtureOnlyWrites':True}
fd=os.open(J/'cached-dependent-import-control.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w')as f:json.dump(out,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
print(json.dumps({'unreviewedDependentPycExecuted':True,'originalSourceBytesUnchanged':True,'pythonB':True,'privateReads':0,'runtimeEffects':0}))
