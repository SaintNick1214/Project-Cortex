"""Finite read-only attempt6 public observer. Never traverses private paths."""
import base64, gzip, hashlib, json, os, stat, sys, time
from pathlib import Path

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q = R / '_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06'
F = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt6-integrated-repair1'
FREEZE = '115e417419ab7b55e9fdbad97e51513f9f24a8e523c7b344168a63c92d8e968c'
FIELDS = ('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
MAX = 4 * 1024 * 1024
AGE = 60_000_000_000
output_bytes = 0
held = []

def strict(raw):
    def pairs(items):
        result = {}
        for k,v in items:
            assert k not in result, 'duplicate_key'
            result[k] = v
        return result
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite')))

def nine(value):
    return {k:str(getattr(value,k)) for k in FIELDS}

def canonical(path, base, layout=False):
    assert path == base or path.is_relative_to(base)
    current = base
    for part in ('.', *path.relative_to(base).parts):
        if part != '.': current /= part
        value = current.lstat()
        assert not stat.S_ISLNK(value.st_mode) and current.resolve() == current
        if current != path: assert stat.S_ISDIR(value.st_mode)
        if layout:
            assert value.st_uid == 501 and value.st_gid == 20
            assert stat.S_IMODE(value.st_mode) == (0o700 if stat.S_ISDIR(value.st_mode) else 0o600)

def capture(path, base, kind, original=None, layout=False):
    canonical(path, base, layout)
    pre = path.lstat()
    now = time.time_ns()
    assert stat.S_ISREG(pre.st_mode) and pre.st_nlink == 1
    assert pre.st_uid == 501 and pre.st_gid == 20
    assert 0 <= pre.st_size <= 16 * 1024 * 1024
    assert max(pre.st_mtime_ns,pre.st_ctime_ns) + AGE <= now, 'immature_before_first_capture:' + str(path)
    fd = os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    pin = {'path':str(path),'fd':fd,'closeAttempted':False}
    held.append(pin) # immediate owner registration before pin construction/fstat
    pin.update(kind=kind,PRE9=nine(pre),capturedUnixNs=str(now))
    assert nine(os.fstat(fd)) == pin['PRE9']
    if original is not None: assert pin['PRE9'] == original, 'original_transfer_nine_changed:' + str(path)
    return pin

def qualify(pin, collect=False):
    fd,path,pin9 = pin['fd'],Path(pin['path']),pin['PRE9']
    assert nine(os.fstat(fd)) == pin9
    os.lseek(fd,0,os.SEEK_SET)
    digest = hashlib.sha256(); size = 0; body = []
    while data := os.read(fd,65536):
        size += len(data); assert size <= int(pin9['st_size'])
        digest.update(data)
        if collect:
            assert size <= MAX
            body.append(data)
    assert size == int(pin9['st_size'])
    assert nine(os.fstat(fd)) == nine(path.lstat()) == pin9
    return {'path':str(path),'sha256':digest.hexdigest(),'bytes':size,'PRE9':pin9,'fullEOF':True,'finalDescriptorAndPathNineEqual':True}, b''.join(body)

def emit(obj):
    global output_bytes
    raw = json.dumps(obj,separators=(',',':')).encode(); assert len(raw) <= MAX
    env = {'encoding':'gzip+base64','decodedBytes':len(raw),'decodedSha256':hashlib.sha256(raw).hexdigest(),'body':base64.b64encode(gzip.compress(raw,compresslevel=9,mtime=0)).decode()}
    out = json.dumps(env,separators=(',',':')).encode()+b'\n'
    output_bytes += len(out); assert output_bytes <= 262144, 'finite_export_ceiling'
    os.write(1,out)

primary_error=None;close_errors=[]
def close_owned_inputs():
    for pin in held:
        if pin.get('closeAttempted')is True:continue
        pin['closeAttempted']=True
        try:os.close(pin['fd'])
        except BaseException as error:close_errors.append(error)

try:
    assert sys.dont_write_bytecode and os.getuid() == 501 and os.getgid() == 20 and sys.platform == 'linux'
    assert Path('/sys/fs/cgroup/memory.max').read_text().strip() == '2147483648'
    assert Path('/sys/fs/cgroup/memory.swap.max').read_text().strip() == '0'
    assert sys.argv[1] in ('collect','custody')
    receipt_pin = capture(Path('/owned/public-transfer-receipt.json'),Path('/owned'),'transfer-receipt',layout=True)
    receipt_meta,receipt_raw = qualify(receipt_pin,True)
    receipt = strict(receipt_raw)
    assert receipt['scope'] == 'NEW_PROSPECTIVE_LINUX_PUBLIC_CANDIDATE_CUSTODY_ONLY'
    assert receipt['sourceFreezeSha256'] == FREEZE and receipt['actualServiceRequests'] == 0
    assert receipt['baselineGeneratedCompared'] is True and receipt['qualificationAccepted'] is False and receipt['privateBytesCopied'] is False
    rows = receipt['files']; names = [r['path'] for r in rows]
    assert len(rows) == len(set(names)) == 1914
    assert all(isinstance(n,str) and not Path(n).is_absolute() and '..' not in Path(n).parts for n in names)
    for row in rows:
        assert set(row['sourceIdentityDecimal']) == set(row['destinationIdentityDecimal']) == set(FIELDS)
        assert all(isinstance(v,str) and v.isdecimal() for v in [*row['sourceIdentityDecimal'].values(),*row['destinationIdentityDecimal'].values()])
        assert type(row['bytes']) is int and 0 <= row['bytes'] <= 16*1024*1024
        assert len(row['sha256']) == 64 and all(c in '0123456789abcdef' for c in row['sha256'])
    if sys.argv[1] == 'collect':
        assert len(sys.argv) == 2
        emit({'scope':'FULL_CURRENT_PUBLIC_TRANSFER_RECEIPT_COLLECTION','receiptMetadata':receipt_meta,'receiptBody':receipt_raw.decode(),'publicMembers':1914})
    else:
        assert len(sys.argv) == 4
        assert receipt_meta['sha256'] == sys.argv[2] and receipt_meta['PRE9'] == strict(sys.argv[3])
        candidate = Path('/owned/candidate')
        actual = []; directories = 0
        for root,dirs,files in os.walk(candidate,followlinks=False):
            root = Path(root); canonical(root,candidate,True); assert root.is_dir(); directories += 1
            for n in dirs: canonical(root/n,candidate,True); assert stat.S_ISDIR((root/n).lstat().st_mode)
            for n in files:
                path = root/n; canonical(path,candidate,True); assert stat.S_ISREG(path.lstat().st_mode)
                actual.append(str(path.relative_to(candidate)))
        assert sorted(actual) == sorted(names)
        pairs = []
        for row in rows:
            name = row['path']
            source = F/name if name == 'independent-preparation-review.json' else Q/name
            base = F if name == 'independent-preparation-review.json' else Q
            a = capture(source,base,'source',row['sourceIdentityDecimal'])
            b = capture(candidate/name,candidate,'destination',row['destinationIdentityDecimal'],True)
            pairs.append((row,a,b))
        # Every one of the3828 original source/destination descriptors is held before any candidate content qualification.
        emit({'scope':'ALL1914_ORIGINAL_TRANSFER_SOURCE_DESTINATION_PRE9_BEFORE_FIRST_CONTENT_QUALIFICATION','files':[{'path':row['path'],'sourcePRE9':a['PRE9'],'destinationPRE9':b['PRE9']} for row,a,b in pairs],'descriptors':3828,'captureBeforeQualification':True})
        observed = []; bodies = {}
        body_names = {'candidate-freeze-attempt6.json','managed-fixture-copy-manifest.json','independent-preparation-review.json'}
        for row,a,b in pairs:
            src,_ = qualify(a)
            dst,body = qualify(b,row['path'] in body_names)
            assert src['sha256'] == dst['sha256'] == row['sha256']
            assert src['bytes'] == dst['bytes'] == row['bytes']
            if row['path'] in body_names: bodies[row['path']] = body
            observed.append({'path':row['path'],'sha256':dst['sha256'],'bytes':dst['bytes'],'sourceAndDestinationOriginalNineEqual':True,'fullEOF':True})
        frozen = strict(bodies['candidate-freeze-attempt6.json'])
        assert hashlib.sha256(bodies['candidate-freeze-attempt6.json']).hexdigest() == FREEZE
        assert len(frozen['files']) == 1907 and frozen['actualExternalRequests'] == frozen['actualDeployments'] == 0
        by = {r['path']:r for r in frozen['files']}; assert len(by) == 1907
        generated = {'managed-fixture/fixture/convex/_generated/'+n for n in ['api.d.ts','api.js','dataModel.d.ts','server.d.ts','server.js']}
        assert set(names) == set(by)|generated|{'candidate-freeze-attempt6.json','independent-preparation-review.json'}
        baseline = {r['copy']:r for r in strict(bodies['managed-fixture-copy-manifest.json'])['files'] if r.get('officialCodegenMutable') is True}
        assert set(baseline) == generated and generated.isdisjoint(by)
        for row in rows:
            expected = by.get(row['path'],baseline.get(row['path']))
            if expected: assert row['sha256'] == expected['sha256'] and row['bytes'] == expected['bytes']
        prep = strict(bodies['independent-preparation-review.json'])
        assert prep['verdict'] == 'PASS' and prep['independent'] is True and prep['candidateSha256'] == FREEZE and prep['candidateMembers'] == 1907
        assert prep['scope'] == 'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION'
        for pin in held:
            final,_ = qualify(pin)
            assert final['PRE9'] == pin['PRE9']
        emit({'scope':'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY','status':'PASS','receiptMetadata':receipt_meta,'publicMembers':1914,'directoryCount':directories,'observed':observed,'allCurrentDestinationIdentities':'PASS_ALL9','currentSourceDestinationFullContent':'PASS','transferSourceOriginalNine':'PASS_ALL9','heldThroughFinalFullEOFAndPathDescriptorNine':True,'privateReads':0,'volumeWrites':0,'serviceCalls':0,'nativeFoundationAccepted':False,'fullTask03':False})
except BaseException as error:
    primary_error=error
finally:
    close_owned_inputs()
if primary_error is not None or close_errors:
    chain=([primary_error]if primary_error is not None else[])+close_errors
    raise BaseExceptionGroup('public observer sticky primary and owned-close failure chain',chain)
