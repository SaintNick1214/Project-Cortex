import sys,json,gzip,hashlib,datetime,os,copy,subprocess,traceback
from pathlib import Path
ROOT=Path('/workspace/Project-Cortex');Q=ROOT/'_goals/convex-backend-runtime-2026-10-02/qa';O=Q/'task04-native-source-tier-design-c2';OLD=Q/'task04-native-source-tier-design-c1';J=Q/'task04-native-source-tier-c1-fresh-review';W=ROOT/'work/resume/task04-native-source-tier-design-c2'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
R={'argv':sys.argv,'cwd':str(ROOT),'utcPre':now(),'failures':[],'commands':[]}
def closure(p,pin=None):
 b=(p/'qa-manifest.json').read_bytes();h=sha(b)
 if pin:assert h==pin
 m=json.loads(b);rows=m['rows'];expected={r['path'] for r in rows}|{'qa-manifest.json'};actual=set()
 for base,ds,fs in os.walk(p,followlinks=False):
  for n in ds+fs:assert not (Path(base)/n).is_symlink()
  actual.update((Path(base)/n).relative_to(p).as_posix() for n in fs)
 assert len(rows)==len(expected)-1 and actual==expected
 for r in rows:
  b=(p/r['path']).read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256']
 return {'path':str(p.relative_to(ROOT)),'manifestSha256':h,'files':len(actual),'rows':len(rows),'utc':now()}
def save(b):
 h=sha(b);p=O/'preimages'/ (h+'.gz');p.parent.mkdir(exist_ok=True);packed=gzip.compress(b,mtime=0);assert len(packed)<=5*1024*1024
 if not p.exists():p.write_bytes(packed)
 return {'bytes':len(b),'sha256':h,'preimage':str(p.relative_to(O))}
try:
 R['referencesBefore']=[closure(OLD,'353a1fe4a7402880d299f8ca1c65bd03a732514bb6c6283c4246901b64e06ebe'),closure(ROOT/'work/resume/task04-native-source-tier-design-c1','de2bce1a3920e4e26ac248e29968bea65f0a3aa70f94dadab16802bde3848229'),closure(J),closure(ROOT/'work/resume/task04-native-source-tier-c1-fresh-review')]
 assert sha((J/'report.md').read_bytes())=='41b8739c2a9df2841736be4cab61a7c72bca016d4d79080a90eb1b0e0941986e'
 original=json.loads((OLD/'source-before.json').read_text());index={r['path']:r for r in original['rows']};assert len(index)==1112
 for row in index.values():
  b=gzip.decompress((OLD/row['preimage']).read_bytes());assert len(b)==row['bytes'] and sha(b)==row['sha256']
 selected={};profiles={}
 scripts=['guard.mjs','process-owner.mjs','driver.mjs','peer.mjs','cli-prerequisites.mjs','parent-inputs.mjs','task04-native-c8-parent-inputs.mjs','management-transport.mjs','publication.mjs']
 for kind in ['extra','extension','regression']:
  g=json.loads((OLD/(kind+'-graph.json')).read_text());base=g['base'];(O/(kind+'-graph.json')).write_bytes((OLD/(kind+'-graph.json')).read_bytes())
  for suffix in ['dependency-tiers.json','runner-dependency-inventory.json','runtime-inputs.json',*['scripts/'+s for s in scripts]]:
   path=base+'/'+suffix;row=index[path];b=gzip.decompress((OLD/row['preimage']).read_bytes());selected[path]=save(b)
  tiers=json.loads(gzip.decompress((O/selected[base+'/dependency-tiers.json']['preimage']).read_bytes()));runner=json.loads(gzip.decompress((O/selected[base+'/runner-dependency-inventory.json']['preimage']).read_bytes()))
  a=copy.deepcopy(tiers['rpc']['runner']);b=copy.deepcopy(tiers['boundaryOnly']['runner']);compiler=next(r for r in a if r['path']=='node_modules/typescript/lib/typescript.js')
  a.remove(compiler);b.append(compiler)
  canonical=lambda rows:sorted(rows,key=lambda r:r['path'])
  assert canonical(a+b)==canonical(runner['inputs']) and len({r['path'] for r in a+b})==len(runner['inputs'])
  assert (len(a),len(b),len(a+b))=={'extra':(99,19,118),'extension':(97,19,116),'regression':(96,17,113)}[kind]
  assert (len(tiers['rpc']['tools']),len(tiers['boundaryOnly']['tools']))==(4,14)
  profiles[kind]={'originalRunner':{'rpc':len(tiers['rpc']['runner']),'boundary':len(tiers['boundaryOnly']['runner']),'full':len(runner['inputs'])},'proposedRunner':{'rpc':len(a),'boundary':len(b),'full':len(a+b)},'toolsUnchanged':{'rpc':4,'boundary':14,'full':18},'compilerTupleUnchanged':compiler,'fullTuplesUnchanged':True}
 (O/'selected-historical-sources.json').write_text(json.dumps({'rows':[{'path':p,**r} for p,r in selected.items()]},indent=2)+'\n')
 (O/'profile-partitions.json').write_text(json.dumps(profiles,indent=2)+'\n')
 # Preserve original successful controls and genuine failure history by exact
 # immutable closure reference rather than duplicating the source corpus.
 refs={'references':R['referencesBefore'],'subjectReport':{'path':str((OLD/'report.md').relative_to(ROOT)),**save((OLD/'report.md').read_bytes())},'priorJudgment':{'path':str((J/'report.md').relative_to(ROOT)),**save((J/'report.md').read_bytes()),'verdict':'NEEDS FIXES DESIGN ONLY','score':3.8},'source1112Pin':{'path':str((OLD/'source-before.json').relative_to(ROOT)),'sha256':sha((OLD/'source-before.json').read_bytes()),'rows':1112},'original39Results':{'path':str((OLD/'design-adversaries-receipt.json').relative_to(ROOT)),'sha256':sha((OLD/'design-adversaries-receipt.json').read_bytes())},'fresh33Results':{'path':str((J/'commands/independent-model-corrected/stdout').relative_to(ROOT)),'sha256':sha((J/'commands/independent-model-corrected/stdout').read_bytes())},'failureRoots':[str((OLD/'failures').relative_to(ROOT)),str((J/'commands/independent-model').relative_to(ROOT))],'allReferenceClosuresVerified':True}
 assert len(json.loads((OLD/'design-adversaries-receipt.json').read_text())['controls'])==39
 assert json.loads((J/'commands/independent-model-corrected/stdout').read_text())['count']==33
 (O/'immutable-reference-map.json').write_text(json.dumps(refs,indent=2)+'\n')
 # Collect genuine new operation source-before bytes. These current sources
 # are drift context only and never replace the 1,112 historical source pins.
 liveBefore={}
 for p in index:
  liveBefore[p]=save((ROOT/p).read_bytes()) if p.endswith('/scripts/cli-prerequisites.mjs') else {'bytes':(ROOT/p).stat().st_size,'sha256':sha((ROOT/p).read_bytes())}
 (O/'current-source-before.json').write_text(json.dumps({'utc':now(),'rows':[{'path':p,**r} for p,r in liveBefore.items()]},indent=2)+'\n')
 # Reexecute the original39 source-model assertions using own retained bytes;
 # only their input/output routing is changed.
 model=(OLD/'design-adversaries.py').read_text()
 model=model.replace("sources={r['path']:r for r in json.loads((O/'source-before.json').read_text())['rows']}","sources={r['path']:r for r in json.loads((O/'selected-historical-sources.json').read_text())['rows']};sources['node_modules/typescript/lib/typescript.js']={'bytes':9144216}")
 model=model.replace("O/'design-adversaries-receipt.json'","O/'original39-rerun-receipt.json'")
 (O/'original39-rerun.py').write_text(model)
 # Fresh33 reviewer assertions use retained historical source and exact own
 # newly observed CLI bytes; no live subject module is executed.
 model33=(ROOT/'work/resume/task04-native-source-tier-c1-fresh-review/static-model.py').read_text()
 model33=model33.replace("p=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-native-source-tier-design-c1');idx={x['path']:x for x in json.loads((p/'source-before.json').read_text())['rows']}; out=[]", "p=Path(__file__).absolute().parent;idx={x['path']:x for x in json.loads((p/'selected-historical-sources.json').read_text())['rows']};live={x['path']:x for x in json.loads((p/'current-source-before.json').read_text())['rows']};out=[]")
 model33=model33.replace("now=Path(path).read_text()", "now=gzip.decompress((p/live[path]['preimage']).read_bytes()).decode()")
 (O/'fresh33-rerun.py').write_text(model33)
 for name in ['original39-rerun','fresh33-rerun']:
  cmd=[sys.executable,'-B',str(O/(name+'.py'))];pre=now();v=subprocess.run(cmd,cwd=ROOT,capture_output=True);(O/(name+'.stdout')).write_bytes(v.stdout);(O/(name+'.stderr')).write_bytes(v.stderr);R['commands'].append({'name':name,'argv':cmd,'cwd':str(ROOT),'utcPre':pre,'utcPost':now(),'exitCode':v.returncode});assert v.returncode==0,(name,v.stderr.decode())
  if name=='fresh33-rerun':assert json.loads(v.stdout)['count']==33
  else:assert len(json.loads(v.stdout)['controls'])==39
 currentAfter=[];during=[];historical=[]
 for p,old in index.items():
  b=(ROOT/p).read_bytes();h=sha(b);row={'path':p,'bytes':len(b),'sha256':h};currentAfter.append(row)
  if len(b)!=liveBefore[p]['bytes'] or h!=liveBefore[p]['sha256']:during.append({'path':p,'before':liveBefore[p],'after':save(b)})
  if len(b)!=old['bytes'] or h!=old['sha256']:historical.append({'path':p,'historicalBefore':{'bytes':old['bytes'],'sha256':old['sha256'],'referencePreimage':old['preimage']},'currentAfter':save(b)})
 R['currentDriftDuringCommands']=during;R['historicalDriftPaths']=len(historical)
 (O/'current-source-after.json').write_text(json.dumps({'utc':now(),'rows':currentAfter,'duringCommandsDrift':during,'historicalDrift':historical,'historicalPinsNotReplaced':True},indent=2)+'\n')
 R['referencesAfter']=[closure(ROOT/r['path'],r['manifestSha256']) for r in R['referencesBefore']];R['profiles']=profiles;R['exitCode']=0
except BaseException:
 R['failures'].append(traceback.format_exc());R['exitCode']=1
finally:
 R['utcPost']=now();(O/'repair-receipt.json').write_text(json.dumps(R,indent=2)+'\n')
print(json.dumps(R));sys.exit(R['exitCode'])
