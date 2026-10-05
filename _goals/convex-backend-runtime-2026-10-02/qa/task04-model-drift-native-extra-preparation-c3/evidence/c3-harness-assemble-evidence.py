from pathlib import Path
import hashlib,json,shutil,datetime
repo=Path('/workspace/Project-Cortex');w=repo/'work/resume/task04-model-drift-native-preparation-c3';q=repo/'_goals/convex-backend-runtime-2026-10-02/qa';store={p.stem:p for p in (w/'source-byte-store').glob('*.bytes')};H=lambda b:hashlib.sha256(b).hexdigest()
for area in [w/'operation-source-preimages',w/'prior-runs']:
 for p in area.rglob('*'):
  if p.is_file() and p.name!='index.json':
   b=p.read_bytes();d=H(b)
   if d not in store:store[d]=p
commands=[]
for p in sorted([*w.glob('*.receipt.json'),*(w/'prior-runs').rglob('*.receipt.json'),*(w/'immutable-operation-runs').rglob('*.receipt.json')]):
 data=json.loads(p.read_text());commands.append((p,data))
for kind in ['extension','regression','extra']:
 r=q/f'task04-model-drift-native-{kind}-preparation-c3';dest=r/'evidence/c3-command-runs';dest.mkdir(exist_ok=True);byteDest=r/'evidence/c3-source-byte-store';byteDest.mkdir(exist_ok=True);rows=[];missing=[];copied=set()
 for p,data in commands:
  rel=p.relative_to(w);out=dest/rel;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(p.read_bytes());base=p.name.removesuffix('.receipt.json')
  for ext in ['stdout','stderr']:
   f=p.with_name(base+'.'+ext)
   if f.exists():out.with_name(base+'.'+ext).write_bytes(f.read_bytes())
  refs=[]
  before=data.get('sourceBefore')
  if isinstance(before,list):
   for source in before:
    d=source['sha256'];refs.append({'path':source['path'],'sha256':d,'bytes':source['bytes'],'packetBytePath':'evidence/c3-source-byte-store/'+d+'.bytes'})
    if d in store:
     if d not in copied:shutil.copyfile(store[d],byteDest/(d+'.bytes'));copied.add(d)
     assert H((byteDest/(d+'.bytes')).read_bytes())==d
    else:missing.append({'receipt':str(rel),'source':source,'status':'GENUINE_PREIMAGE_MISSING_NOT_BACKFILLED'})
  rows.append({'receipt':'evidence/c3-command-runs/'+str(rel),'argv':data['argv'],'cwd':data['cwd'],'startedAt':data.get('startedAt','NOT_CAPTURED'),'observedAt':data.get('observedAt','NOT_CAPTURED'),'exitCode':data['exitCode'],'sourceBeforeScope':data.get('sourceBeforeScope','PRIMARY_AND_CAPSULE_SCRIPTS_ONLY_OR_NOT_CAPTURED'),'preimageRefs':refs,'laterHashesDoNotBackfillHistoricalPrestate':True})
 for incident in ['full-graph-recorder-shadow-failure.json']:
  shutil.copyfile(w/incident,r/'evidence'/incident)
 for p in w.glob('*'):
  if p.is_file() and (p.suffix in ['.py','.mjs'] or p.name.endswith('.text') or p.name.endswith('.txt')):shutil.copyfile(p,r/'evidence'/('c3-harness-'+p.name))
 for name in ['actual-chain.mjs','adversarial-chain.mjs','independent-watch17.mjs','legacy-controls.mjs']:
  p=w/kind/'parent-proof'/name;shutil.copyfile(p,r/'evidence'/('c3-own-'+name+'.text'))
 for filename in ['final-extra-hostile.receipt.json','final-extra-hostile.stdout','final-extra-hostile.stderr']:
  p=w/filename
  if p.exists():shutil.copyfile(p,r/'failures'/('c3-'+filename))
 for name in ['outcomes-operative-source-validator.json','outcomes-source-final.json']:
  p=w/'extra'/name;shutil.copyfile(p,r/'evidence'/('c3-'+name))
 (r/'evidence/c3-command-custody-index.json').write_text(json.dumps({'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commands':rows,'missingPreimages':missing,'earlierMissingData':'Earlier primary-only/no prehash/null source receipts retained honestly; no historical FULL-graph certification','native':'NOT_RUN'},indent=2)+'\n')
 assert not missing,missing[:2]
 print(kind,len(rows),'receipts',len(copied),'unique exact byte preimages')
