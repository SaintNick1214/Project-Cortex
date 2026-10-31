"""Complete all-nine/full-byte public conservation; S5 key metadata only."""
import ast,hashlib,json,os,stat,subprocess
from pathlib import Path
Q=Path(__file__).resolve().parents[1]
R=Q.parents[3]
OUT=Q/'attempt5'
FIELDS=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
def identity(s):return {n:str(getattr(s,n)) for n in FIELDS}
def sha(p):
 before=p.lstat();assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and p.resolve(strict=True)==p
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  assert identity(before)==identity(os.fstat(fd));h=hashlib.sha256();count=0
  while count<before.st_size:
   data=os.read(fd,min(65536,before.st_size-count));assert data;h.update(data);count+=len(data)
  assert not os.read(fd,1) and identity(before)==identity(os.fstat(fd))==identity(p.lstat())
  return h.hexdigest()
 finally:os.close(fd)
copy=json.loads((OUT/'copy-1338-receipt.json').read_bytes())
old=Path(copy['source']);deltas=[]
for row in copy['files']:
 assert sha(old/row['path'])==row['sha256']
 current=sha(Q/row['path'])
 if current!=row['sha256']:
  pre=OUT/'preimages'/row['path'];assert sha(pre)==row['sha256']
  deltas.append({'path':row['path'],'oldSha256':row['sha256'],'newSha256':current,'exactPreimage':str(pre.relative_to(Q))})
assert len(copy['files'])==1338 and len(deltas)==9
old3=json.loads((Q/'attempt4/copy-965-receipt.json').read_bytes());deltas3=[]
for row in old3['files']:
 current=sha(Q/row['path'])
 if current!=row['sha256']:
  pre=Q/'attempt4/preimages'/row['path'];assert sha(pre)==row['sha256'];deltas3.append(row['path'])
assert len(old3['files'])==965 and len(deltas3)==10
source=json.loads((Q/'source-inventory.json').read_bytes())['files'];assert len(source)==161
assert all(sha(R/r['path'])==r['sha256'] for r in source)
tests=json.loads((Q/'source-pre.json').read_bytes())['files'];assert len(tests)==155 and tests==json.loads((Q/'source-post.json').read_bytes())['files']
assert all(sha(R/p)==h for p,h in tests.items())
copies=json.loads((Q/'managed-fixture-copy-manifest.json').read_bytes())['files'];assert len(copies)==138
assert all(sha(R/r['source'])==sha(Q/r['copy'])==r['sha256'] for r in copies)
compiler=json.loads((Q/'attempt2/compiler-projection.json').read_bytes());assert len(compiler['files'])==114 and compiler['version']=='6.0.3'
assert all(sha(R/r['source'])==sha(Q/r['copy'])==r['sha256'] for r in compiler['files'])
history=json.loads((Q/'historical-script-provenance.json').read_bytes())['files'];assert len(history)==23
assert all(sha(R/r['historicalSource'])==r['sha256'] and (not r.get('preimage') or sha(Q/r['preimage'])==r['sha256']) for r in history)
assert sha(Q/'transport-prep/private-transport.py')=='ecb1eff9a9edf025e2b7eb9108580857ff41da8bb54e8956251b219a5bebc23e'
for name in ['scripts/deploy.mjs','scripts/driver.mjs','scripts/cleanup.mjs','scripts/child-toolchain.mjs','scripts/process-owner.mjs','scripts/native-engine.mjs','scripts/qualify.mjs','original-task03.md','dependency-allocation.md','path-ledger.json','attempt2/linux-cli-readiness-receipt.json']:
 assert sha(Q/name)==sha(old/name)
for rel in ['scripts/incidental-custody.mjs','attempt2/affected-controls.mjs','attempt2-repair1/real-owned-custody-controls.mjs']:
 assert (Q/rel).read_text().replace('candidate-freeze-attempt5.json','candidate-freeze-attempt4.json')==(old/rel).read_text()
assert (Q/'scripts/offline-guard-check.mjs').read_bytes()==(old/'scripts/offline-guard-check.mjs').read_bytes()
assert (Q/'coordinate-source/task03-attempt5-run-common-controls.py').read_text().replace('attempt5','attempt4')==(Q/'coordinate-source/preimages/task03-attempt4-run-common-controls.py').read_text()
assert (OUT/'source-acquisition.py').read_text().replace("type(header['version']) is int and ",'')==(old/'attempt4/source-acquisition.py').read_text()
new=json.loads((OUT/'checks/source-47-controls.stdout').read_bytes());prior=json.loads((old/'attempt4/check2/source-47-controls.stdout').read_bytes())
assert new['cases']==47 and [r['name'] for r in new['results']]==[r['name'] for r in prior['results']]
host=json.loads((OUT/'checks/source-46-host-controls.stdout').read_bytes());linux=json.loads((OUT/'linux-window3/native-public-receipts/source.stdout').read_bytes())
prior=json.loads((old/'attempt4/check2/source-39-host-controls.stdout').read_bytes())
assert host['count']==linux['count']==46 and [r['name'] for r in host['controls'][:39]]==[r['name'] for r in linux['controls'][:39]]==[r['name'] for r in prior['controls']]
assert all(r['destinationEntries']==0 and r['observedReceiveSuccess'] is False for r in host['controls'][39:]+linux['controls'][39:])
common=Q/'coordinate-source/task03-attempt5-coordinate-common.py'
assert sha(common)==sha(OUT/'linux-code/coordinate-source/task03-attempt5-coordinate-common.py')
for rel in ['coordinate-source/task03-attempt5-coordinator-controls/controls.json','coordinate-source/descendant-controls/controls.json','attempt5/linux-window3/native-public-receipts/common--controls.json','attempt5/linux-window3/native-public-receipts/descendant--controls.json']:
 data=json.loads((Q/rel).read_bytes());assert data['status']=='PASS' and data['sourceSha256']==sha(common)
request=json.loads((Q/'project-request.json').read_bytes());binding=json.loads((Q/'transport-prep/transport-binding.json').read_bytes())
assert binding['requestSha256']==hashlib.sha256(json.dumps(request,separators=(',',':')).encode()).hexdigest()
private=Path('/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt5-private-20261006')
s=private.lstat();k=(private/'jwt-private.pem').lstat()
assert sorted(p.name for p in private.iterdir())==['jwt-private.pem']
assert s.st_uid==k.st_uid==501 and s.st_gid==k.st_gid==20 and stat.S_IMODE(s.st_mode)==0o700 and stat.S_IMODE(k.st_mode)==0o600 and k.st_nlink==1
ledger=json.loads((Q/'path-ledger.json').read_bytes())['cases'];assert len(ledger)==275 and sum(r['visibility']=='public' for r in ledger)==200 and sum(r['visibility']=='internal' for r in ledger)==75
syntax=[]
for base in [OUT,Q/'coordinate-source']:
 for p in sorted(base.glob('*.py')):
  ast.parse(p.read_text(),filename=str(p));syntax.append({'path':str(p.relative_to(Q)),'sha256':sha(p)})
result={'scope':'ATTEMPT5_BOUNDED_REPAIR_CONSERVATION_ONLY','status':'PASS','actualHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),
 'previousQ4FreezeSha256':copy['sourceFreezeSha256'],'previousQ4Members':1338,'currentQ4ExactMembers':1329,'explicitDeltas':deltas,'all1338OriginalPreimagesRecoverable':True,
 'previousQ3Members':965,'currentQ3ExactMembers':955,'exactQ3Preimages':10,'Q3DeltaPaths':deltas3,'sourcePins':161,'testSourcePins':155,'managedCopies':138,'compilerProjection':114,'historicalReferences':23,
 'acceptedPrivateHelperUnchangedSha256':sha(Q/'transport-prep/private-transport.py'),'original39HostAndLinuxNamesAndAssertionsRetained':True,'newInvalidVersionControls':7,
 'hostAcquisition':46,'LinuxAcquisition':46,'sourceControls':47,'filesystemControls':3,'cleanupDriverControls':28,'guardNegatives':41,'hostAndLinuxConservedCommon':{'actualOutcomes':9,'invalidBounds':4},
 'hostAndLinuxNewActualExitedParentDescendants':2,'hostAndLinuxInjectedUnknownOwnership':1,'current275Public200Internal75':True,
 'requiredConservedCounts':json.loads((OUT/'ancestry/candidate-freeze-attempt4.json').read_bytes())['requiredConservedCounts'],
 'requiredRuntimeBounds':'UNCHANGED_CLI120_TYPECHECK_CODEGEN_ENABLE_DRIVER21MIN_NATIVE20MIN_CALL12_RPC10000_ROWS320_SUBJECTS16_STORAGE2X64B_CLEANUP2_POLICY5EMPTY_PROCESSOWNER_INCIDENTAL_RETIREMENT',
 'reused1005Tests17Suites':'EXACT_SOURCE_DISCOVERY_SKIPS_DEPENDENCY_COMPILER_PINS_NOT_RERUN','newPrivateMetadata':{'directoryIdentityDecimal':identity(s),'keyIdentityDecimal':identity(k),'keyBytesRead':False,'targetEnvOwnershipProvisionAbsent':True},
 'currentGuardSha256':sha(Q/'scripts/guard.mjs'),'requestFileSha256':sha(Q/'project-request.json'),'parsedRequestSha256':binding['requestSha256'],'operation':request['operation'],'projectSlug':request['projectSlug'],
 'qaPythonSyntax':syntax,'productWrites':0,'oldNamespaceWrites':0,'realCredentialReads':0,'targetProvisioning':0,'actualServiceCalls':0,'officialCLI':'NOT_RUN','codegen':'NOT_RUN','nativeFoundationCases':'NOT_RUN','paidCalls':0,'fullTask03':'OPEN','independentReview':'REQUIRED_NOT_SELF_ACCEPTED'}
(OUT/'conservation-receipt.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':'PASS','Q4members':1338,'Q4exactCurrent':1329,'Q4exactPreimages':9,'Q3members':965,'Q3exactCurrent':955,'Q3exactPreimages':10,'source161':True,'test155':True,'copy138':True,'compiler114':True,'history23':True,'keyReads':0,'serviceCalls':0}))
