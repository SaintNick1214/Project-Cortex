import json,gzip,hashlib,datetime,os,sys,copy,traceback
from pathlib import Path
R=Path('/workspace/Project-Cortex'); Q=R/'_goals/convex-backend-runtime-2026-10-02/qa'; O=Q/'task04-native-source-tier-c2-fresh-review'; C=Q/'task04-native-source-tier-design-c2'; W=R/'work/resume/task04-native-source-tier-c2-fresh-review'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b):return hashlib.sha256(b).hexdigest()
receipt={'argv':sys.argv,'cwd':str(R),'utcPre':now(),'scope':'INDEPENDENT STATIC DESIGN ONLY','controls':[],'pre':{},'post':{}}
def check(name,condition):
 if not condition:raise AssertionError(name)
 receipt['controls'].append(name)
def retain(p):
 b=p.read_bytes(); h=sha(b); dest=O/'preimages'/f'{h}.gz';dest.parent.mkdir(exist_ok=True)
 if not dest.exists():dest.write_bytes(gzip.compress(b,mtime=0))
 return {'bytes':len(b),'sha256':h,'preimage':str(dest.relative_to(O))}
inputs={}
def read(p):
 if str(p) not in inputs:inputs[str(p)]=retain(p)
 return p.read_bytes()
def closure(p,pin=None):
 m=json.loads(read(p/'qa-manifest.json'));h=sha(read(p/'qa-manifest.json'))
 if pin:check('manifest pin '+str(p.relative_to(R)),h==pin)
 rows=m['rows'];names=[x['path'] for x in rows]; actual=[]
 for base,ds,fs in os.walk(p,followlinks=False):
  for n in ds+fs:
   if (Path(base)/n).is_symlink():raise AssertionError('symlink '+n)
  actual.extend((Path(base)/n).relative_to(p).as_posix() for n in fs)
 check('exact recursive closure '+str(p.relative_to(R)),len(names)==len(set(names)) and set(actual)==set(names)|{'qa-manifest.json'})
 for x in rows:
  b=(p/x['path']).read_bytes()
  if len(b)!=x['bytes'] or sha(b)!=x['sha256']:raise AssertionError(x['path'])
 return {'path':str(p.relative_to(R)),'manifestSha256':h,'rows':len(rows),'filesIncludingSelf':len(actual)}
def walk(edges,entries):
 seen=set();todo=list(entries)
 while todo:
  x=todo.pop()
  if x in seen:continue
  if x not in edges:raise ValueError('unresolved graph row')
  seen.add(x);todo.extend(edges[x])
 return seen
try:
 refs=[(C,'da6c8ee6eaed45c6664ca60297f3cdb776ebaa4c9e3489f3bd1c011656775bbd'),(R/'work/resume/task04-native-source-tier-design-c2','8f8308692593a0a920c1d2701a3c5d89d2d81faab18252757a38e313af140a11')]
 for x in json.loads(read(C/'immutable-reference-map.json'))['references']:refs.append((R/x['path'],x['manifestSha256']))
 receipt['referenceBefore']=[closure(p,h) for p,h in refs]
 check('subject report exact pin',sha(read(C/'report.md'))=='c3fafbee8af6b97659c761ae2442041508111765da42c6cd5392989bb67c2c40')
 check('prior NEEDS FIXES retained',sha(read(Q/'task04-native-source-tier-c1-fresh-review/report.md'))=='41b8739c2a9df2841736be4cab61a7c72bca016d4d79080a90eb1b0e0941986e')
 old=Q/'task04-native-source-tier-design-c1';index=json.loads(read(old/'source-before.json'))['rows'];check('1112 unique historical paths',len(index)==len({x['path'] for x in index})==1112)
 for x in index:
  b=gzip.decompress((old/x['preimage']).read_bytes())
  if len(b)!=x['bytes'] or sha(b)!=x['sha256']:raise AssertionError('historical '+x['path'])
 check('1112 complete gzip preimages independently validated',True)
 selected={x['path']:x for x in json.loads(read(C/'selected-historical-sources.json'))['rows']}
 def source(path):
  x=selected[path];b=gzip.decompress(read(C/x['preimage']));check('historical tuple '+path,len(b)==x['bytes'] and sha(b)==x['sha256']);return b.decode()
 result={};sites={}
 compiler='node_modules/typescript/lib/typescript.js';expected={'extra':(99,19,118,100,87),'extension':(97,19,116,98,85),'regression':(96,17,113,97,84)}
 for profile,(nr,nb,nf,nu,nd) in expected.items():
  g=json.loads(read(C/f'{profile}-graph.json'));base=g['base'];edges=g['edges'];tiers=json.loads(source(base+'/dependency-tiers.json'));full=json.loads(source(base+'/runner-dependency-inventory.json'))['inputs'];a=copy.deepcopy(tiers['rpc']['runner']);b=copy.deepcopy(tiers['boundaryOnly']['runner']);row=next(x for x in a if x['path']==compiler);a.remove(row);b.append(row)
  canonical=lambda z:sorted(z,key=lambda x:x['path'])
  def equal(z):return len(z)==len({x['path'] for x in z}) and canonical(z)==canonical(full)
  check(profile+' exact one-row partition',equal(a+b) and (len(a),len(b),len(full))==(nr,nb,nf) and row=={'path':compiler,'bytes':9144216,'sha256':'569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39'})
  check(profile+' unchanged other membership',canonical(a)==canonical([x for x in tiers['rpc']['runner'] if x['path']!=compiler]) and canonical([x for x in b if x['path']!=compiler])==canonical(tiers['boundaryOnly']['runner']))
  check(profile+' unchanged tool partition',len(tiers['rpc']['tools'])==4 and len(tiers['boundaryOnly']['tools'])==14)
  for mutation in ['loss','duplicate','hash','bytes','path']:
   bad=copy.deepcopy(a+b)
   if mutation=='loss':bad.pop()
   elif mutation=='duplicate':bad.append(copy.deepcopy(row))
   else:bad[-1][mutation if mutation!='hash' else 'sha256']='wrong' if mutation!='bytes' else 0
   check(profile+' denies '+mutation,not equal(bad))
  dispatch=walk(edges,g['dispatchEntries']);runtime=walk(edges,g['runtimeEntries']);complete=walk(edges,list(k for k in edges if k.startswith(base+'/scripts/')))
  check(profile+' complete and dispatch graphs',dispatch==set(g['dispatchGraph']) and runtime==set(g['runtimeUnionGraph']) and complete==set(g['fullGraph']) and (len(complete),len(runtime),len(dispatch))==(nf,nu,nd) and compiler not in dispatch and compiler in runtime)
  check(profile+' exact graph tuple paths',set(x['path'] for x in full)==complete)
  for consumer in g['dispatchEntries']+[base+'/scripts/peer.mjs']:
   for new in [compiler,base+'/scripts/cli-prerequisites.mjs','NEW_UNRESOLVED_IMPORT']:
    bad=copy.deepcopy(edges);bad[consumer].append(new)
    try:denied=compiler in walk(bad,g['dispatchEntries'])
    except ValueError:denied=True
    check(profile+' graph denial '+consumer.rsplit('/',1)[-1]+' '+new.rsplit('/',1)[-1],denied)
  texts={name:source(base+'/scripts/'+name) for name in ['guard.mjs','driver.mjs','peer.mjs','process-owner.mjs','cli-prerequisites.mjs','parent-inputs.mjs','task04-native-c8-parent-inputs.mjs','management-transport.mjs','publication.mjs']};guard=texts['guard.mjs']
  check(profile+' first rpc default FULL',"sourcePreflight(firstReviewedBinding===undefined?undefined:tier,freezeDigest)" in guard)
  check(profile+' only trusted explicit rpc narrow',"tier==='rpc'&&firstReviewedBinding!==undefined?[...tiers.rpc.runner,...tiers.rpc.tools]:[...runner.inputs,...tools.files]" in guard)
  check(profile+' immutable latches',all(t in guard for t in ['firstFreezeDigest!==freezeDigest','digest!==firstReviewedBinding','expected!==firstExpectedReview','const finalTrusted=trustedReview()']))
  check(profile+' each rpc exact runner tools equality',all(t in guard for t in ['[...tiers.rpc.runner,...tiers.boundaryOnly.runner]','[...tiers.rpc.tools,...tiers.boundaryOnly.tools]','QA_DEPENDENCY_TIER_CLOSURE']))
  check(profile+' actual SDK callback',"const deadline=Math.min(freshDispatch(),lane.deadline)" in texts['driver.mjs'] and "await owned.client[type]" in texts['driver.mjs'])
  check(profile+' peer after ticket',texts['peer.mjs'].index('await reserveTicket')<texts['peer.mjs'].index('const deadline=Math.min(freshPeer(session),requestDeadline)')<texts['peer.mjs'].index('await fetch'))
  check(profile+' process compiler FULL',"reviewed();" in texts['process-owner.mjs'][texts['process-owner.mjs'].index('spawn(args, options)'):texts['process-owner.mjs'].index('const child = spawn')] and 'reviewed();const run=spawnSync' in texts['cli-prerequisites.mjs'])
  check(profile+' legacy same main',"export * from './parent-inputs.mjs'" in texts['task04-native-c8-parent-inputs.mjs'] and "import{main}from './parent-inputs.mjs'" in texts['task04-native-c8-parent-inputs.mjs'])
  check(profile+' management final full', 'const check=()=>{reviewed();' in texts['management-transport.mjs'] and 'guard.check();if(Date.now()>=deadline)' in texts['management-transport.mjs'])
  check(profile+' publication actual callback full', 'const current=livePreflight();' in texts['publication.mjs'] and 'const deadline=Math.min(fresh(true)' in texts['publication.mjs'])
  check(profile+' final full', 'reviewed();preservationPreflight();' in texts['driver.mjs'])
  inputsjson=json.loads(source(base+'/runtime-inputs.json'));check(profile+' literal contract conflict preserved','every script' in inputsjson['rootLoaderClosure'] and 'each native RPC' in inputsjson['rootLoaderClosure'])
  sites[profile]={name:[{'line':i,'text':line} for i,line in enumerate(text.splitlines(),1) if any(t in line for t in ['reviewed(','livePreflight(','await import','await build','freshDispatch','freshPeer','spawn(','spawnSync','await fetch'])] for name,text in texts.items()}
  result[profile]={'rpc':nr,'boundary':nb,'full':nf,'runtimeUnion':nu,'dispatch':nd,'tools':[4,14],'compiler':row,'compilerParents':g['compilerParents'],'dynamicSites':g['dynamicAndRequireAndProcessSites']}
 (O/'derived-profiles.json').write_text(json.dumps(result,indent=2)+'\n');(O/'boundary-sites.json').write_text(json.dumps(sites,indent=2)+'\n')
 for name in ['fresh33-rerun.py','original39-rerun.py','repair.py','repair-receipt.json','fresh33-rerun.stdout','original39-rerun.stdout','bootstrap-limits.json','current-source-before.json','current-source-after.json']:read(C/name)
 receipt['referenceAfter']=[closure(p,h) for p,h in refs];check('reference unchanged',receipt['referenceBefore']==receipt['referenceAfter'])
 receipt['pre']=inputs
 for p,x in inputs.items():
  receipt['post'][p]={'bytes':len(Path(p).read_bytes()),'sha256':sha(Path(p).read_bytes())}
  if receipt['post'][p]!={k:x[k] for k in ['bytes','sha256']}:raise AssertionError('input changed '+p)
 receipt['exitCode']=0
except BaseException:
 receipt['failure']=traceback.format_exc();receipt['pre']=inputs;receipt['exitCode']=1
receipt['utcPost']=now();(O/'audit-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'exitCode':receipt['exitCode'],'controls':len(receipt['controls']),'references':receipt.get('referenceAfter'),'failure':receipt.get('failure')}));sys.exit(receipt['exitCode'])
