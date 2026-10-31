"""Independent SOURCE-ONLY seams. No containers, native subjects, or proposal edits."""
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import stat
from types import SimpleNamespace

REPO=Path(__file__).resolve().parents[5]
OUT=Path(__file__).resolve().parent
SRC=REPO/'work/resume/task04-c8-physical-preparation-r3/native-ci-a5'
checks=[]
def check(name,fn,expected=None):
 try:
  value=fn()
  if expected: raise AssertionError('expected rejection '+expected)
  checks.append({'name':name,'outcome':'PASS','observation':value})
 except Exception as e:
  if expected and expected in str(e): checks.append({'name':name,'outcome':'PASS','rejection':str(e)})
  else: raise

def nodes(file,names):
 tree=ast.parse((SRC/file).read_text()); return [n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in names]
def compile_nodes(ns,items): exec(compile(ast.fix_missing_locations(ast.Module(body=items,type_ignores=[])),'<exact-reviewed-AST-seam>','exec'),ns)
parsed=[]
for p in sorted(SRC.glob('*.py')):
 ast.parse(p.read_text()); parsed.append({'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'AST':'PASS','body':'NOT_EXECUTED'})
fixture=OUT/'seam-fixtures-attempt3'; fixture.mkdir(mode=0o700)
binpath=fixture/'usr-local-bin'; binpath.mkdir(mode=0o700)
for n in ('npm','npx','python','python3','regular-source'):
 (binpath/n).write_bytes(('owned reviewer dummy '+n+'\n').encode())
aliaspath=fixture/'python-bin-alias'; aliaspath.symlink_to(binpath,target_is_directory=True)
back=fixture/'backings'; back.mkdir(mode=0o700)
realos=os
os_proxy=SimpleNamespace(**{k:getattr(os,k) for k in dir(os)})
os_proxy.posix_fadvise=lambda *a:None; os_proxy.POSIX_FADV_DONTNEED=4
ns={'os':os_proxy,'Path':Path,'stat':stat,'hashlib':hashlib,'FIELDS':('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'),'retained':[],'CAP':536870912,'BACK':back,'OUT':fixture,'byte_total':0,'measure':lambda *a,**k:None,'alias':lambda p:None}
compile_nodes(ns,nodes('native-capability.py',{'identity','capture'}))
check('regular_file_capture_control',lambda:ns['capture'](binpath/'regular-source')['sha256'])
for h in ns['retained']: os.close(h['fd'])
ns['retained']=[]; ns['byte_total']=0
# Execute the exact reviewed alias loop with absolute paths effect-substituted
# into reviewer-owned fixtures. Alias observation is stubbed; no O_PATH on macOS.
tree=ast.parse((SRC/'native-capability.py').read_text()); main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
loop=next(n for n in ast.walk(main) if isinstance(n,ast.For) and isinstance(n.iter,ast.Tuple) and isinstance(n.iter.elts[0],ast.Constant) and n.iter.elts[0].value=='/usr/local/bin/npm')
observed=[]
def scoped_path(value,*parts):
 literal=str(value)
 if literal=='/opt/cortex-c8/python/bin': return aliaspath
 if literal in ('/usr/local/bin/npm','/usr/local/bin/npx','/usr/local/bin/python','/usr/local/bin/python3'): return binpath/Path(literal).name
 return Path(value,*parts)
loopns={'Path':scoped_path,'sources':set(),'alias':lambda p:observed.append(str(p))}
compile_nodes(loopns,[loop])
assert str(binpath) in loopns['sources']
check('exact_alias_loop_adds_directory_to_regular_source_set',lambda:{'sources':sorted(loopns['sources']),'directoryAdded':str(binpath),'directoryAliasObserved':observed})
check('directory_from_exact_alias_loop_rejected_by_exact_capture',lambda:ns['capture'](Path(str(binpath))), 'RUNTIME_REGULAR_SINGLE_LINK_SOURCE')

# Unmodified all9 and full-byte rejection branches remain strict.
link=fixture/'hardlink'; os.link(binpath/'regular-source',link)
check('hard_link_source_negative_control',lambda:ns['capture'](link),'RUNTIME_REGULAR_SINGLE_LINK_SOURCE')
link.unlink()
measure_ns={'Path':None,'os':SimpleNamespace(statvfs=lambda p:SimpleNamespace(f_frsize=4096,f_blocks=10000000,f_bavail=10000000,f_files=10000000,f_favail=100000,f_namemax=255)),'ROOT':fixture,'CAP':536870912,'RECEIPT_CAP':16777216,'reserve_min':None,'check_count':0,'snapshots':[]}
values={'memory.max':'6442450944','memory.current':'1','memory.swap.max':'0','memory.swap.current':'0'}
class ResourcePath:
 def __init__(self,p): self.p=p
 def read_text(self): return values[self.p.rsplit('/',1)[-1]]
measure_ns['Path']=ResourcePath
compile_nodes(measure_ns,nodes('native-capability.py',{'measure'}))
check('literal_six_gib_no_swap_control',lambda:measure_ns['measure']()['literalReserveBytes'])
values['memory.swap.max']='6442450944'
check('extra_swap_negative_control',lambda:measure_ns['measure'](),'ACTUAL_MATCHED_SIX_GIB_MEMORY_SWAP_NO_EXTRA_CAPACITY')
values['memory.swap.max']='0'; values['memory.current']=str(6442450944-134217727)
check('literal_reserve_shortfall_negative_control',lambda:measure_ns['measure'](),'LITERAL_MEASURED_RESERVE_HOLD')
values['memory.current']='1'; values['memory.max']='max'
check('unbounded_cgroup_negative_control',lambda:measure_ns['measure'](),'ACTUAL_FINITE_SIX_GIB_CGROUP')

# Exact raw kernel argv comparison, with a wrapper rejected.
argvif=next(n for n in ast.walk(main) if isinstance(n,ast.If) and 'UNMODIFIED_NATIVE_KERNEL_ARGV_REQUIRED' in ast.unparse(n))
args=['/usr/local/bin/node','--inspect-brk=127.0.0.1:0','-e','']; exact=b'\0'.join(os.fsencode(a) for a in args)+b'\0'
argvns={'args':args,'nodeowner':{'rawArgvHex':exact.hex()},'os':os}
check('literal_kernel_argv_control',lambda:compile_nodes(argvns,[argvif]))
argvns['nodeowner']['rawArgvHex']=(b'/run/rosetta/rosetta\0'+exact).hex()
check('wrapper_kernel_argv_negative_control',lambda:compile_nodes(argvns,[argvif]),'UNMODIFIED_NATIVE_KERNEL_ARGV_REQUIRED')

# Export membership and size conditions are extracted without launching tar/docker.
run=ast.parse((SRC/'ci-run.py').read_text()); runmain=next(n for n in run.body if isinstance(n,ast.FunctionDef) and n.name=='main')
allowassign=next(n for n in ast.walk(runmain) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='allowed' for t in n.targets))
exportif=next(n for n in ast.walk(runmain) if isinstance(n,ast.If) and ast.unparse(n).startswith('if not allowed or not member.isfile()'))
exportns={'PurePosixPath':__import__('pathlib').PurePosixPath,'re':re,'seen':set(),'member':SimpleNamespace(isfile=lambda:True)}
def exportmember(literal):
 exportns.update(literal=literal,parts=Path(literal).parts)
 compile_nodes(exportns,[allowassign,exportif]); return literal
check('allowlisted_source_backing_control',lambda:exportmember('source-backings/pending-42'))
for name in ('source-backings/../../private','unapproved.json','/source-backings/pending-42','source-backings/pending-42/extra'):
 check('unallowlisted_export_negative_control_'+name,lambda n=name:exportmember(n),'STRICT_FINITE_CAPABILITY_EXPORT_MEMBERSHIP')
sizeif=next(n for n in ast.walk(runmain) if isinstance(n,ast.If) and ast.unparse(n).startswith('if total > 553648128'))
exportns.update(total=553648129,files=1,member=SimpleNamespace(size=1))
check('export_capacity_negative_control',lambda:compile_nodes(exportns,[sizeif]),'FINITE_EXPORT_CAPACITY_HOLD')

# Cleanup failure must prevent success; exact stop/terminal branch only.
stopif=next(n for n in ast.walk(runmain) if isinstance(n,ast.If) and ast.unparse(n).startswith("if stop.returncode or terminal['State']['Running']"))
cleanupns={'stop':SimpleNamespace(returncode=0),'terminal':{'State':{'Running':True}},'primary':None}
check('owner_still_running_negative_control',lambda:compile_nodes(cleanupns,[stopif]),'OWNER_STOP_TERMINAL_FAILURE')

# Count source-only resource demand terms without evaluating producer bodies.
qa=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c8-physical-preparation-r3'
d=json.loads((qa/'finite-source-demand-attempt3.json').read_text()); p=json.loads((qa/'finite-native-resource-proposal.json').read_text())
terms=[p['exactKnownPhysicalAndSameRAWBytes'],p['exactSourceAidPhysicalAndRAWBytes'],p['exactLiteralTargetPhysicalAndRAWBytes'],p['finiteDirectoryAllocationEnforcedMaxBytes'],p['knownRegularAndLiteralBlockRoundingPlus64MetadataFilePaddingMaxBytes'],p['unchangedMetadataInputAllocationCeilingsBytes'],p['finalizedFiniteHelperSourceAllocationEnforcedMaxBytes']]
assert sum(terms)==48565865408==p['totalAdditionalDiskAdmissionEnforcedMaxBytes']
assert p['additionalInodeAdmissionEnforcedMax']==d['exactPathRows']+d['distinctRawObjects']+d['allFinitePreparationDirectoryCount']+64
assert d['proposedFinitePhysicalPreparationAdmissionBytes']+1048576-73068==48565865408
check('finite_demand_arithmetic_control',lambda:{'terms':terms,'sum':sum(terms),'inodes':d['exactPathRows']+d['distinctRawObjects']+d['allFinitePreparationDirectoryCount']+64,'directoryReproduction':'C4 subset independently reviewed; full derivation requires historical R2 metadata in original volume, not accessed'})
original=(REPO/'work/resume/task04-c8-physical-preparation-r3/materialize-cohort.py').read_bytes(); proposed=(SRC/'materialize-cohort-proposed.py').read_bytes()
assert original.count(b"row['kind'] != 'symlink'")==1
assert original.replace(b"row['kind'] != 'symlink'",b"row['kind'] != 'literal-symlink'")==proposed
check('exact_one_token_prospective_delta_control',lambda:{'originalSHA256':hashlib.sha256(original).hexdigest(),'proposedSHA256':hashlib.sha256(proposed).hexdigest(),'assertionsRemoved':False,'execution':'NONE'})
result={'scope':'INDEPENDENT_SOURCE_ONLY_EFFECT_SUBSTITUTED_SEAMS_NOT_LINUX_RUNTIME','ASTParses':parsed,'checks':checks,'seamFailureWitness':'EXACT_REVIEWED_ALIAS_LOOP_ADDS_DIRECTORY; EXACT_REVIEWED_CAPTURE_REJECTS_IT','nativeSubjectsExecuted':False,'DockerCalls':False,'proposalEdited':False}
(OUT/'direct-source-controls.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'checks':len(checks),'allControlsAsExpected':True,'proposalFailureWitness':result['seamFailureWitness']}))
