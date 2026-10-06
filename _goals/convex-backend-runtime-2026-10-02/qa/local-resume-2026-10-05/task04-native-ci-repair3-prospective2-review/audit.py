import ast, hashlib, json, os, stat, sys, time
from pathlib import Path
sys.dont_write_bytecode = True
R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = Path(__file__).parent
L = P.parent
W = R / 'work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair3'
FIELDS = dict(dev='st_dev', ino='st_ino', mode='st_mode', uid='st_uid', gid='st_gid', nlink='st_nlink', size='st_size', mtime_ns='st_mtime_ns', ctime_ns='st_ctime_ns')
held, rows = {}, {}
def identity(s): return {k: str(getattr(s, v)) for k, v in FIELDS.items()}
def read(path, pin=None, kind='regular', target=None, members=None):
    path = Path(path); key = str(path); before = identity(path.lstat())
    if key not in held:
        flags = os.O_RDONLY | (os.O_SYMLINK if kind == 'alias' else os.O_NOFOLLOW | (os.O_DIRECTORY if kind == 'directory' else 0))
        held[key] = os.open(path, flags)
    fd = held[key]
    assert before == identity(os.fstat(fd))
    if pin is not None: assert before == pin, (key, before, pin)
    row = dict(path=key, identityDecimal=before, kind=kind)
    if kind == 'regular':
        assert stat.S_ISREG(path.lstat().st_mode)
        os.lseek(fd, 0, 0); chunks=[]
        while True:
            block = os.read(fd, 1048576)
            if not block: break
            chunks.append(block)
        raw=b''.join(chunks)
        assert len(raw) == int(before['size'])
        row.update(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(), EOF=True)
    elif kind == 'directory':
        assert stat.S_ISDIR(path.lstat().st_mode)
        actual=sorted(os.listdir(fd)); assert actual == members, (key, actual, members)
        row.update(members=actual); raw=None
    else:
        assert stat.S_ISLNK(path.lstat().st_mode)
        actual=os.readlink(os.fsencode(path)).hex(); assert actual == target
        row.update(targetHex=actual); raw=None
    assert before == identity(os.fstat(fd)) == identity(path.lstat())
    if key in rows: assert rows[key] == row, (key, 'changed during independent review')
    rows[key]=row
    return raw
def load(path, sha=None, size=None):
    raw=read(path)
    if sha: assert hashlib.sha256(raw).hexdigest() == sha
    if size is not None: assert len(raw) == size
    return json.loads(raw)
def store(name, obj): (P/name).write_text(json.dumps(obj, indent=2)+'\n')
baseline=load(L/'task04-native-ci-repair3-prospective2/source-baseline.json', '40a3b05b9f171f0d1b8229ff8bf0cc52016e6101990ea0f20005e56e904c69bc', 173706)
dirs=load(L/'task04-native-ci-repair3-prospective2/directory-baseline.json', 'aac855a9f2fafcd8244dcf36c71531a345ca7fe2e58460cc6337c73908e9f61a', 39962)
assert baseline['scope']=='DISTINCT_PROSPECTIVE_CURRENT_SOURCE_BASELINE_NOT_HISTORICAL_SEAL_REPAIR'
assert dirs['sourceBaselineSHA256']=='40a3b05b9f171f0d1b8229ff8bf0cc52016e6101990ea0f20005e56e904c69bc'
assert len(baseline['files'])==140 and len(dirs['directories'])==dirs['currentDirectories']==32
assert len(baseline['dummyAliases'])==len(baseline['hardlinkGroups'])==1
for x in baseline['files']:
    assert x['PRE']==x['POST']==x['pathPOST'] and x['EOF']
    raw=read(R/x['path'], x['PRE'])
    assert len(raw)==x['bytes'] and hashlib.sha256(raw).hexdigest()==x['sha256']
    assert int(x['PRE']['nlink']) == (2 if x['kind']=='owned-control-hardlink' else 1)
for x in dirs['directories']:
    assert x['PRE']==x['POST']==x['pathPOST']
    read(R/x['path'], x['PRE'], 'directory', members=x['members'])
for x in baseline['dummyAliases']:
    assert x['PRE']==x['POST']==x['pathPOST']
    read(R/x['path'], x['PRE'], 'alias', target=x['targetHex'])
pair=baseline['hardlinkGroups'][0]
assert len(pair)==2
stats=[(R/name).lstat() for name in pair]
assert stats[0].st_dev==stats[1].st_dev and stats[0].st_ino==stats[1].st_ino and all(s.st_nlink==2 for s in stats)
assert sorted(x['path'] for x in baseline['files'] if x['kind']=='owned-control-hardlink')==sorted(pair)
historical=load(R/baseline['historicalRejectedSeal']['path'], 'c0bbe275e84754f8523350c670b79657e39f3ad7b6af359b92538fb140ba2c26', 240082)
assert len(historical['files'])==140
assert sorted(x['path'] for x in historical['files'])==sorted(x['path'] for x in baseline['files'])
drift=[]
for x in historical['files']:
    current=rows[str(R/x['path'])]
    assert current['bytes']==x['bytes'] and current['sha256']==x['sha256']
    original=x['PRE'].get('fields', x['PRE'])
    changes=[k for k in FIELDS if current['identityDecimal'][k]!=original[k]]
    if changes: drift.append(dict(path=x['path'], changedFields=changes, historical=original, current=current['identityDecimal'], cause='UNKNOWN', oldSealRemains='REJECT'))
assert drift==[dict(path=x['path'], changedFields=x['changedFields'], historical=x['historical'], current=x['current'], cause='UNKNOWN', oldSealRemains='REJECT') for x in baseline['historicalDrift']]
assert len(drift)==2 and all(x['changedFields']==['ctime_ns'] for x in drift)
assert {x['path']:x['members'] for x in historical['directories']}=={x['path']:x['members'] for x in dirs['directories']}
old_audit=load(L/'task04-native-ci-repair3-review/source-audit.json')
old_final=load(L/'task04-native-ci-repair3-review/final-source-recheck.json')
assert old_audit['status']=='FAIL_SEAL_IDENTITY' and len(old_audit['sealMismatches'])==2
assert old_final['allNineFullBytesEOFCurrent'] and len(old_final['files'])==295
assert len(old_final['originalSealMismatchUnwaived'])==2
for x in old_final['files']:
    raw=read(x['path'], x['identityDecimal'], x['kind'], x.get('targetHex'), x.get('members'))
    if x['kind']=='regular': assert len(raw)==x['bytes'] and hashlib.sha256(raw).hexdigest()==x['sha256'] and x['EOF']
manifest=load(W/'ci-source-manifest.json', '6defab180fcaa3ba09ab3f2c0933b5a84fd2af481e3650eccd20b7cff683e09a')
assert len(manifest['files'])==16 and sum(x['bytes'] for x in manifest['files'])==154536
assert len(manifest['files'])<=64 and sum(x['bytes'] for x in manifest['files'])<=1048576
for x in manifest['files']:
    raw=read(W/x['path']); assert len(raw)==x['bytes'] and hashlib.sha256(raw).hexdigest()==x['sha256']
    if x['path'].endswith('.py'): ast.parse(raw)
assert read(W/'bounded_process.py')==read(W/'preimages/bounded_process.py')
proposal=read(W/'task04-c8-native-infrastructure.yml.proposed')
prior=read(W/'preimages/task04-c8-native-infrastructure.yml.proposed')
actual=read(R/'.github/workflows/task04-c8-native-infrastructure.yml')
assert len(proposal)==3516 and proposal==prior.replace(b'native-ci-a5-repair2',b'native-ci-a5-repair3')
assert actual==prior and hashlib.sha256(actual).hexdigest()=='7bfe0fc1344ae4fd5d7782a25cb1d99ae688f50728c2aab8bb1b65b97aabd2f5'
assert hashlib.sha256(proposal).hexdigest()=='7d60e79cdb3cb89b4744cd433aadc7c3354bd4fa1ec4231e7e430042109b56ac'
review = L/'task04-native-ci-repair3-review'
prior_verdict=load(review/'verdict.json'); assert prior_verdict['verdict']=='REJECT' and prior_verdict['score']==3.4
prior_parser=load(review/'fresh-parser-controls.json'); assert prior_parser['status']=='PASS' and prior_parser['checks']==len(prior_parser['rows'])==22
prior_export=load(review/'fresh-export-ast-controls/controls.json'); assert prior_export['status']=='PASS' and prior_export['checks']==len(prior_export['rows'])==6
assert prior_parser['sources']['tar_export.py']==hashlib.sha256(read(W/'tar_export.py')).hexdigest()
assert prior_parser['sources']['bounded_process.py']==hashlib.sha256(read(W/'bounded_process.py')).hexdigest()
assert prior_export['sourceSHA256']==hashlib.sha256(read(W/'ci-run.py')).hexdigest()
assert prior_export['helperSHA256']==hashlib.sha256(read(W/'tar_export.py')).hexdigest()
for rel in ['report.md','fresh-parser-controls.py','static-quota-guards.json','controls-setup-failure.json','controls-count-setup-failure.json','fresh-parser-first-failure.json','evidence-manifest.json']:
    read(review/rel)
assert old_audit['currentHelperBytes']==154536 and old_audit['workflow3516NamespaceOnly'] and old_audit['actualWorkflowRemainsRepair2']
assert old_audit['actualCI']=='FAIL_STREAM_TRAILING_STDOUT' and old_audit['originalTail']=='UNKNOWN' and old_audit['ownerBinding']=='EXPIRED'
initial=dict(status='PASS_CURRENT_PROSPECTIVE_SOURCE_BINDINGS_ONLY', baselineRegularFiles=140, baselineDirectories=32, baselineLiteralAliases=1, baselineHardlinkGroups=1, priorJudgeCurrentBindingsRechecked=295, allNineFullBytesEOF=True, directoriesMembershipExact=True, oldSealDrift=drift, oldSealRemainsRejected=True, currentHelperFiles=16, currentHelperBytes=154536, actualWorkflowRepair2=True, exactProposedWorkflowSHA256=hashlib.sha256(proposal).hexdigest(), priorParserControls=22, priorExportASTControls=6, priorControlsNotRerun=True, nativeAccepted=False, Task04Accepted=False, goalAccepted=False, actualDocker=False, files=list(rows.values()), descriptorsHeldUntilFinalRecheck=True)
store('source-audit.json', initial)
print(json.dumps({k:v for k,v in initial.items() if k not in ['files','oldSealDrift']}), flush=True)
signal=sys.stdin.readline().strip()
assert signal=='finish', 'explicit reviewer completion required'
for x in list(rows.values()):
    raw=read(x['path'], x['identityDecimal'], x['kind'], x.get('targetHex'), x.get('members'))
    if x['kind']=='regular': assert len(raw)==x['bytes'] and hashlib.sha256(raw).hexdigest()==x['sha256']
final=dict(status='PASS_CURRENT_PROSPECTIVE_BINDINGS_STABLE', allNineFullBytesEOF=True, directoryMembershipsExact=True, literalAliasesExact=True, originalRejectedSealRemainsRejected=True, initialWorkflowStillRepair2=True, files=list(rows.values()), descriptorsHeldThroughoutReview=True, nativeAccepted=False, Task04Accepted=False, goalAccepted=False)
store('final-source-recheck.json', final)
for fd in held.values(): os.close(fd)
print(json.dumps(dict(status=final['status'], bindings=len(rows), allDescriptorsClosed=True)), flush=True)
