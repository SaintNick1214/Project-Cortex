"""Finite historical public receipts; read only, never repeat operations."""
from pathlib import Path
import hashlib, json, sys
sys.dont_write_bytecode=True
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');G=R/'_goals/convex-backend-runtime-2026-10-02/qa'
P=G/'local-resume-2026-10-05';Q=G/'task03-local-native-attempt5-2026-10-06';I=P/'task03-attempt5-mount-translation-repair3';J=P/'task03-attempt5-repair3-current-source-review'
from importlib.util import spec_from_file_location,module_from_spec
s=spec_from_file_location('finite_reader',J/'verify-receipts.py');v=module_from_spec(s);s.loader.exec_module(v)
receipts=[]
def load(p):raw,row=v.read(p);receipts.append(row);return json.loads(raw)
def raw(p):content,row=v.read(p);receipts.append(row);return content
old=Q/'coordinate-source/repair2/task03-attempt5-public-acquisition'
failed=load(old/'commands.json');assert failed['status']=='FAIL' and failed['failureClass']=='AssertionError' and failed['cleanupErrors']==[]
assert all(x['terminal'] is True and x['failureClass'] is None and x['closeErrors']==[] for x in failed['commands'])
assert not any(x['label']=='copy-run' for x in failed['commands']) and any(x['label']=='init-run' for x in failed['commands'])
obj=json.loads(raw(old/'copy-initial-inspect.stdout'))[0]
host=obj['HostConfig']['Mounts'];actual={x['Destination']:x for x in obj['Mounts']}
assert host[1]['Source']=='/host_mnt'+str(Q) and host[2]['Source']=='/host_mnt'+str(Q/'coordinate-source/repair2')
assert actual['/input']['Source']==host[1]['Source'] and actual['/helper']['Source']==host[2]['Source']
qual=load(I/'raw/actual-absence-protocol-evidence.json')
for expected in qual['sources']:
    content,current=v.read(R/expected['path']);receipts.append(current)
    assert current['sha256']==expected['sha256'] and current['bytes']==expected['bytes'] and current['identityDecimal']==expected['identityDecimal']
stdout=raw(old/'final-inspect-init.stdout');stderr=raw(old/'final-inspect-init.stderr');row=load(old/'final-inspect-init.receipt.json')
assert stdout==b'[]\n' and hashlib.sha256(stdout).hexdigest()=='37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570'
assert stderr==b'error: no such object: cortex-task03-attempt5-public-init-ba2253a8\n'
assert type(row['exitCode']) is int and row['exitCode']==1 and row['terminal'] is True and row['closeErrors']==[] and row['failureClass'] is None
diagnostic=I/'raw/mount-diagnostic';outcome=load(diagnostic/'outcome.json')
assert outcome['status']=='PASS' and outcome['operation']=='714fa877-8417-4dd3-aedb-eef4cb2fc41d' and outcome['selectedDaemonSourceMapping']=='literal'
assert outcome['cleanupErrors']==[] and all(outcome[k]==0 for k in ('privateReads','privateStats','serviceCalls','volumesCreatedOrMutated'))
assert outcome['public1912Acquisition'] is False and outcome['Task03Accepted'] is False
for command in outcome['commands']:
    label=command['label'];saved=load(diagnostic/(label+'.receipt.json'));assert saved==command
    stdout=raw(diagnostic/(label+'.stdout'));stderr=raw(diagnostic/(label+'.stderr'))
    assert command['stdoutSha256']==hashlib.sha256(stdout).hexdigest() and command['stderrSha256']==hashlib.sha256(stderr).hexdigest()
    assert command['streamByteCounts']=={'stdout':len(stdout),'stderr':len(stderr)}
    assert command['terminal'] is True and command['closeErrors']==[] and command['failureClass'] is None
    assert command['pipeLimits']==262144 and command['stdinLimit']==327692 and command['stdinDeadlineSeconds']==12
    assert command['exitCode']==(1 if label=='cleanup-absence' else 0)
    assert 'volume' not in command['argv'] and not any(x in ('exec','deploy','provision') for x in command['argv'])
initial=json.loads(raw(diagnostic/'initial-inspect.stdout'))[0];terminal=json.loads(raw(diagnostic/'terminal-inspect.stdout'))[0]
assert initial['Id']==terminal['Id']==outcome['containerId']
for o in (initial,terminal):
    assert o['State']['Running'] is False and o['Config']['User']=='501:20'
    by={x['Destination']:x for x in o['Mounts']}
    assert len(o['HostConfig']['Mounts'])==len(by)==2
    assert set(by)=={'/input','/helper'}
    for mount,source in zip(o['HostConfig']['Mounts'],(Q,Q/'coordinate-source/repair3')):
        assert mount['Source']==str(source) and mount['ReadOnly'] is True
    assert by['/input']['Source']==str(Q) and by['/helper']['Source']==str(Q/'coordinate-source/repair3')
    assert all(x['RW'] is False for x in by.values())
body=load(diagnostic/'public-readonly-run.stdout')
assert body['status']=='PASS'
failed_writer=load(I/'raw/finalization-source-failure.json');assert failed_writer['status']=='FAIL' and failed_writer['autoReseal'] is False
before=load(I/'raw/writer-finalization-before-manifest.json');assert before['status']=='PASS' and len(before['observations'])==3 and all(len(x['files'])==14 for x in before['observations'])
assert before['observations'][0]['files']==before['observations'][1]['files']==before['observations'][2]['files']
later=load(I/'raw/post-finalization-failure-observation.json');assert later['failedWriterObservationRemains']=='FAILED' and later['cause']=='UNKNOWN' and later['beforeManifest14CurrentComparison']['deltas']==[]
final15=load(I/'raw/final-current-operative-observation.json');assert final15['bindings']==15 and final15['deltas']==[] and final15['failed15WriterObservationStill']=='FAILED'
source=load(J/'identity-initial.json');current={x['path']:x for x in source['sourceFiles']}
differences=v.compare(v.exact(final15['files']),{p:current[p] for p in v.exact(final15['files'])});assert differences==[]
old_writer=load(I/'raw/absence-evidence-writer-failure-1.json');assert old_writer['status']=='FAIL'
result={'scope':'RETAINED_PUBLIC_RECEIPT_BYTES_AND_DISTINCT_FAILURE_CHRONOLOGY_ONLY','status':'PASS',
 'repair2ActualAcquisition':'FAIL_BEFORE_COPY_START','oldRetainedVolumeCurrentState':'NOT_AUDITED','repair3Diagnostic':'ONE_READONLY_PASS_THREE_FILES_ONLY',
 'daemonRepresentationChangeCause':'UNKNOWN','qualifiedActualAbsenceStdoutHex':'5b5d0a','qualifiedExitCode':1,
 'initial14Writer':'PASS_THREE_EQUAL_OBSERVATIONS','next15Writer':'FAIL_PRESERVED_PHASE0_AND1_FIFTEENTH_IDENTITY_ROWS_MISSING',
 'missingOriginalDeltaAndCause':'UNKNOWN_UNRECOVERABLE_FROM_LATER_CHECKS','later14and15':'DISTINCT_CURRENT_ZERO_DELTA_ONLY','final15Differences':differences,
 'evidenceWriterCapitalizationFailure':'FAIL_PRESERVED_WRITER_ONLY_RUNTIME_ALREADY_LOWERCASES','readReceipts':receipts,
 'actualOperationsRepeated':0,'privateScratchReads':0,'privateScratchStats':0,'Task03Accepted':False}
(J/'retained-evidence-assessment.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='readReceipts'}))
