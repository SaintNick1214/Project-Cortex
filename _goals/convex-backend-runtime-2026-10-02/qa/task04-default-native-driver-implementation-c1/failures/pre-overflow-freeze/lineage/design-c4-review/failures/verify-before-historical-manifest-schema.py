import pathlib,json,hashlib,shutil,datetime,subprocess
R=pathlib.Path('/workspace/Project-Cortex');S=R/'_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-design-c4';Q=S.with_name(S.name+'-review')
def h(b):return hashlib.sha256(b).hexdigest()
def save(n,x):(Q/n).write_text(json.dumps(x,indent=2)+'\n')
def inv(p):return [{'path':str(f.relative_to(p)),'bytes':len(f.read_bytes()),'sha256':h(f.read_bytes())} for f in sorted(p.rglob('*')) if f.is_file()]
def closure(p):
 m=json.loads((p/'qa-manifest.json').read_text());a=inv(p);a=[x for x in a if x['path']!='qa-manifest.json'];assert a==m['files'];return len(a)
assert h((S/'report.md').read_bytes())=='50cc9f2fc0b3425250864a99a25fb1157dd98fd4194ee7bdc56373a3328941a0'
assert h((S/'qa-manifest.json').read_bytes())=='3b9039257349434c09d9d52ae4bc2232fa7358ff8f4ca6b9caff59af7a93a086'
pre=inv(S);save('subject-pre.json',pre);assert closure(S)==675
lineage=[]
for p in sorted((S/'lineage').rglob('qa-manifest.json')):
 lineage.append({'path':str(p.parent.relative_to(S)),'rows':closure(p.parent)})
shutil.copytree(S,Q/'preimages/subject')
source=json.loads((S/'source-matrix.json').read_text())['sources'];errors=[]
for x in source:
 f=R/x['path'];b=f.read_bytes();assert len(b)==x['bytes'] and h(b)==x['sha256'],x['path'];d=Q/'preimages/sources'/x['path'];d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b)
save('source-pre.json',source)
x=json.loads((S/'initial14-identities.json').read_text());p=R/x['source'];assert h(p.read_bytes())==x['sourceSha256'];y=json.loads(p.read_text());assert x['cases']==[{k:c[k] for k in x['cases'][0]} for c in y['expectedCalls']]
assert len(x['cases'])==14 and len({c['normalizedNativeRequestHash'] for c in x['cases']})==13 and sum(c['candidateReservationKMicroUSD'] for c in x['cases'])==314310
receipts=[]
for n in ['design-model.py','replay-cleanup-model.py','hash-recovery-model.py']:
 shutil.copy2(S/'checks'/n,Q/'checks'/n);(Q/'raw').mkdir(exist_ok=True)
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();argv=['python',str(Q/'checks'/n)];p=subprocess.run(argv,cwd=R,capture_output=True)
 (Q/'raw'/f'{n}.stdout').write_bytes(p.stdout);(Q/'raw'/f'{n}.stderr').write_bytes(p.stderr)
 receipts.append({'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv,'cwd':str(R),'exit':p.returncode});assert p.returncode==0
save('command-receipts.json',receipts);save('verification.json',{'subjectRows':675,'nestedLineageClosures':lineage,'sourcePins':len(source),'sourceErrors':errors,'initial14Exact':True,'groups':[json.loads((Q/'raw'/f'{n}.stdout').read_text())['groups'] for n in ['design-model.py','replay-cleanup-model.py','hash-recovery-model.py']],'skips':0,'discovery':'Three explicitly selected pure illustrative scripts, not Jest/Vitest/Convex/provider discovery','limits':'No installed/native/provider/managed/paid/OCC/security/UI claim.'})
assert inv(S)==pre
save('subject-post.json',inv(S));save('source-post.json',[{'path':x['path'],'bytes':len((R/x['path']).read_bytes()),'sha256':h((R/x['path']).read_bytes())} for x in source]);assert json.loads((Q/'source-post.json').read_text())==source
print(json.dumps({'subjectRows':675,'nestedClosures':len(lineage),'sources':len(source),'models':'25+19+19 PASS','sourceAndSubjectUnchanged':True}))
