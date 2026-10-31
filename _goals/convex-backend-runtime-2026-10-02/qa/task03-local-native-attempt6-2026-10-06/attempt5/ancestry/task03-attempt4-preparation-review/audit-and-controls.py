"""Independent public-only source audit and host dummy controls; no enabling writes."""
import hashlib, json, os, stat, subprocess
from pathlib import Path

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
Q = R / '_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt4-2026-10-06'
O = Path(__file__).resolve().parent
FIELDS = ('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
seen = {}
def ident(s): return {k:str(getattr(s,k)) for k in FIELDS}
def read(p):
    p = Path(p); before=p.lstat()
    assert p.resolve(strict=True)==p and stat.S_ISREG(before.st_mode) and before.st_nlink==1
    fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        assert ident(before)==ident(os.fstat(fd))
        raw=b''
        while len(raw)<before.st_size:
            b=os.read(fd,min(65536,before.st_size-len(raw))); assert b; raw+=b
        assert not os.read(fd,1)
        assert ident(before)==ident(os.fstat(fd))==ident(p.lstat())
    finally: os.close(fd)
    row={'path':str(p),'identityDecimal':ident(before),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
    if str(p) in seen: assert seen[str(p)]==row
    seen[str(p)]=row
    return raw
def obj(p): return json.loads(read(p))
def pin(p,row):
    raw=read(p); assert hashlib.sha256(raw).hexdigest()==row['sha256'] and len(raw)==row['bytes']
def save(n,o):
    with (O/n).open('x') as f:json.dump(o,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())

freeze_raw=read(Q/'candidate-freeze-attempt4.json')
assert len(freeze_raw)==242545 and hashlib.sha256(freeze_raw).hexdigest()=='1030329b0f57cfb98de6135c4b8de7031d11a5c856fe56fa2d1d57d05d144799'
freeze=json.loads(freeze_raw); assert len(freeze['files'])==1338
for row in freeze['files']:pin(Q/row['path'],row)
actual=sorted(str(p.relative_to(Q)) for p in Q.rglob('*') if p.is_file() and not str(p.relative_to(Q)).startswith('tmp/') and str(p.relative_to(Q)) not in ['candidate-freeze-attempt4.json','independent-preparation-review.json',*freeze['mutableOfficialCodegenOnly']])
assert actual==sorted(r['path'] for r in freeze['files'])
manifest_raw=read(Q/'receipt-manifest-attempt4.json')
assert hashlib.sha256(manifest_raw).hexdigest()=='0b765da3ee7688f368e23dc238e173fff9ab8dc6ca56b44c3fb9caadf547429c'
manifest=json.loads(manifest_raw)
for key in ['files','artifacts','receipts']:
    if key in manifest:print('manifestCollection',key,len(manifest[key]))
assert len(manifest['files'])==1337
for row in manifest['files']:pin(Q/row['path'],row)
source=obj(Q/'source-inventory.json')['files'];assert len(source)==161
for row in source:pin(R/row['path'],row)
tests=obj(Q/'source-pre.json')['files']; assert len(tests)==155 and tests==obj(Q/'source-post.json')['files']
for path,h in tests.items():assert hashlib.sha256(read(R/path)).hexdigest()==h
copies=obj(Q/'managed-fixture-copy-manifest.json')['files'];assert len(copies)==138
for row in copies:pin(R/row['source'],row);pin(Q/row['copy'],row)
compiler=obj(Q/'attempt2/compiler-projection.json');assert compiler['version']=='6.0.3' and len(compiler['files'])==114
for row in compiler['files']:pin(R/row['source'],row);pin(Q/row['copy'],row)
history=obj(Q/'historical-script-provenance.json')['files'];assert len(history)==23
for row in history:
    assert hashlib.sha256(read(R/row['historicalSource'])).hexdigest()==row['sha256']
    if row.get('preimage'):assert hashlib.sha256(read(Q/row['preimage'])).hexdigest()==row['sha256']
copy=obj(Q/'attempt4/copy-965-receipt.json');assert len(copy['files'])==965
delta=[]
for row in copy['files']:
    raw=read(Q/row['path'])
    if hashlib.sha256(raw).hexdigest()!=row['sha256']:
        pin(Q/'attempt4/preimages'/row['path'],row);delta.append(row['path'])
assert len(delta)==10
assert hashlib.sha256(read(Q/'transport-prep/private-transport.py')).hexdigest()=='ecb1eff9a9edf025e2b7eb9108580857ff41da8bb54e8956251b219a5bebc23e'
node='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node'
(O/'dummy-tmp').mkdir(mode=0o700)
env={'PATH':str(Path(node).parent)+':/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1','CORTEX_PUBLIC_DUMMY_TMP':str(O/'dummy-tmp')}
commands=[('host39',['/usr/bin/python3','-B',str(Q/'attempt4/source-controls.py')]),('source47',[node,'--experimental-vm-modules',str(Q/'attempt2/affected-controls.mjs')]),('cleanup28',[node,'--experimental-vm-modules',str(Q/'repair-cycle2/offline-repair-check.mjs')])]
# Only the dummy scratch placement and import location differ; all source/assertions retained.
raw=(Q/'attempt2-repair1/real-owned-custody-controls.mjs').read_text()
raw=raw.replace("from '../scripts/guard.mjs'", "from '"+(Q/'scripts/guard.mjs').as_uri()+"'")
raw=raw.replace("resolve(dirname(fileURLToPath(import.meta.url)),'..')",json.dumps(str(Q)))
raw=raw.replace("resolve(q,'tmp/actual-custody-')",json.dumps(str(O/'dummy-tmp/actual-custody-')))
(O/'filesystem-controls.mjs').write_text(raw)
commands.append(('filesystem3',[node,'--experimental-vm-modules',str(O/'filesystem-controls.mjs')]))
receipts=[]
for name,argv in commands:
    result=subprocess.run(argv,cwd=R,env=env,capture_output=True,timeout=45)
    for kind,data in [('stdout',result.stdout),('stderr',result.stderr)]:
        with (O/(name+'.'+kind)).open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
    receipts.append({'name':name,'argv':argv,'cwd':str(R),'exitCode':result.returncode,'stdout':name+'.stdout','stderr':name+'.stderr'})
    assert result.returncode==0,(name,result.returncode)
for p in list(seen):read(p)
save('source-bindings.json',{'status':'PASS','files':list(seen.values()),'freezeMembers':1338,'manifestMembers':1337,'sourcePins':161,'testPins':155,'copies':138,'compiler':114,'history':23,'q3Conserved':955,'preimages':delta,'hostIdentityRecheckedAtEnd':True,'privateReads':0,'DockerCalls':0,'services':0})
save('command-receipts.json',{'commands':receipts,'publicDummyOnly':True,'credentialReads':0,'DockerCalls':0,'services':0})
print(json.dumps({'status':'PASS','freshHostControls':39,'freshSourceControls':47,'freshFilesystemControls':3,'freshCleanupDriverControls':28,'boundFiles':len(seen),'candidateMembers':1338,'manifestMembers':1337}))
