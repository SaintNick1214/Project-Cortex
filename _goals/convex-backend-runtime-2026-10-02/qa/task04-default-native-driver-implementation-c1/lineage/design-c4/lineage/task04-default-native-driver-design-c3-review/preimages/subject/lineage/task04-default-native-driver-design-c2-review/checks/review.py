import ast,copy,hashlib,json,pathlib,shutil,subprocess,datetime
R=pathlib.Path('/workspace/Project-Cortex')
Q=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-design-c2-review'
S=Q.parent/'task04-default-native-driver-design-c2'
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def h(b):return hashlib.sha256(b).hexdigest()
def write(n,x):
 p=Q/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,indent=2)+'\n')
start=utc();m=json.loads((S/'qa-manifest.json').read_text());rows=m['files']
actual={p.relative_to(S).as_posix() for p in S.rglob('*') if p.is_file()}-{'qa-manifest.json'}
assert len(rows)==101 and len({x['path'] for x in rows})==101 and actual=={x['path'] for x in rows}
for x in rows:
 b=(S/x['path']).read_bytes();assert len(b)==x['bytes'] and h(b)==x['sha256']
assert h((S/'report.md').read_bytes())=='a939795057bc298a6a9a0ed121f211fe3b5eb9301af5dda6427a371e22ae50bc'
assert h((S/'qa-manifest.json').read_bytes())=='f1313f6c1f68953ba2e1a5301c7dc1425c2fba428de2b66662cc27a56df22bfb'
shutil.copytree(S,Q/'preimages/subject')
sources=json.loads((S/'source-matrix.json').read_text())['sources'];assert len(sources)==50 and len({x['path'] for x in sources})==50
for x in sources:
 b=(R/x['path']).read_bytes();assert len(b)==x['bytes'] and h(b)==x['sha256']
 p=Q/'preimages/sources'/x['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
for p in S.rglob('*.py'):ast.parse(p.read_text())
# Static source review precedes execution; this copied pure model only prints to stdout.
model=Q/'checks/design-model.py';model.parent.mkdir(exist_ok=True);shutil.copyfile(S/'checks/design-model.py',model)
t0=utc();argv=['python3','-B',str(model)];p=subprocess.run(argv,cwd=R,capture_output=True,text=True);t1=utc()
(Q/'raw').mkdir(exist_ok=True);(Q/'raw/design-model.stdout').write_text(p.stdout);(Q/'raw/design-model.stderr').write_text(p.stderr)
assert p.returncode==0;result=json.loads(p.stdout);assert result['groups']==25 and result['actualProofRegistry']=='EMPTY'
write('command-receipts.json',[{'start':t0,'end':t1,'argv':argv,'cwd':str(R),'exit':p.returncode,'classification':'ILLUSTRATIVE_DESIGN_SUBSET_ONLY'}])
# Adversarial integrity checks on in-memory manifest copies, never subject mutation.
def valid(rs,aset):return len(rs)==len({x['path'] for x in rs}) and aset=={x['path'] for x in rs} and all(len((S/x['path']).read_bytes())==x['bytes'] and h((S/x['path']).read_bytes())==x['sha256'] for x in rs)
assert not valid(rows[:-1],actual);assert not valid(rows,actual|{'injected'});assert not valid(rows+[rows[0]],actual)
bad=copy.deepcopy(rows);bad[0]['sha256']='0'*64;assert not valid(bad,actual)
write('verification.json',{'start':start,'end':utc(),'subjectRows':101,'subjectExactSetBytesHashes':'PASS','sourceRows':50,'sourceUniqueAndPreHashes':'PASS','independentIntegrityControls':['missing row rejected','extra file rejected','duplicate row rejected','changed hash rejected'],'modelGroups':25,'modelScope':'PURE_DESIGN_SUBSET_ONLY','nativeServicesPaid':'NOT_RUN','contractCounterexamples':[{'case':'C09 committed revoke then exact stage replay','required':'replay zero writes','universalFence':'denies inactive grant/revoked account; replay precedence unspecified'},{'case':'same text/stage hash, different partSequence/rawPartDigest','required':'part identity must be compared','storedSchema':'neither argument stored and stageHash hashes only text'},{'case':'STOP/revoked account then owned delete; repeat tombstone','required':'bounded owned deletion and deterministic denial/replay','universalFence':'denies closed authority and tombstone; delete return only tombstoned true'}]})
write('failures-history.json',{'newExecutionFailures':[],'historicalFailures':'Complete subject/lineage retained unchanged; no original UTC fabricated','readToolNote':'Some initial combined read output was truncated; decisive contract and source sections reread. Initial read calls have tool receipts but no fabricated shell UTC timestamps.'})
print(json.dumps({'verification':'PASS','modelGroups':25,'rows':101,'sourceRows':50,'scope':'DESIGN_ONLY','reviewDirectory':str(Q)},indent=2))
