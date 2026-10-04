import json,datetime,sys,copy,hashlib,gzip
from pathlib import Path
O=Path(__file__).absolute().parent
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
R={'argv':sys.argv,'utcPre':now(),'scope':'SOURCE_DERIVED_GRAPH_AND_PLACEMENT_DESIGN_MODEL_ONLY','controls':[],'failures':[]}
sources={r['path']:r for r in json.loads((O/'source-before.json').read_text())['rows']}
def text(path):return gzip.decompress((O/sources[path]['preimage']).read_bytes()).decode()
def reach(edges,entries):
 seen=set();todo=list(entries)
 while todo:
  p=todo.pop()
  if p in seen:continue
  if p not in edges:raise ValueError('unknown import requires FULL and fresh graph review')
  seen.add(p);todo.extend(edges[p])
 return seen
def check(name,fn):fn();R['controls'].append({'name':name,'outcome':'PASS','utc':now()})
def deny(fn):
 try:fn()
 except ValueError:return
 raise AssertionError('unsafe proposed classification accepted')
try:
 for profile in ['extra','extension','regression']:
  g=json.loads((O/(profile+'-graph.json')).read_text());edges=g['edges'];compiler='node_modules/typescript/lib/typescript.js';active=reach(edges,g['dispatchEntries']);full=set(g['fullGraph'])
  def classify(es):
   used=reach(es,g['dispatchEntries'])
   if compiler in used:raise ValueError('compiler consumed by dispatch entry')
   return used
  check(profile+':existing-dispatch-closure-excludes-compiler',lambda:classify(edges))
  assert compiler in full and g['compilerParents']==[g['base']+'/scripts/cli-prerequisites.mjs']
  check(profile+':compiler-remains-full-and-only-cli-parent',lambda:None)
  altered=copy.deepcopy(edges);altered[g['dispatchEntries'][0]].append(compiler)
  check(profile+':injected-direct-driver-compiler-import-denied',lambda:deny(lambda:classify(altered)))
  trans=copy.deepcopy(edges);trans[g['base']+'/scripts/peer.mjs'].append(g['base']+'/scripts/cli-prerequisites.mjs')
  check(profile+':injected-transitive-peer-cli-import-denied',lambda:deny(lambda:classify(trans)))
  unknown=copy.deepcopy(edges);unknown[g['dispatchEntries'][0]].append('unresolved-dynamic-module')
  check(profile+':unresolved-import-forces-full-denied-narrow-proof',lambda:deny(lambda:classify(unknown)))
  compilerRow=sources[compiler];assert compilerRow['bytes']==9144216
  def tier(tier,latched):return 'RPC' if tier=='rpc' and latched else 'FULL'
  check(profile+':first-explicit-rpc-still-full',lambda:(_ for _ in ()).throw(AssertionError()) if tier('rpc',False)!='FULL' else None)
  for caller in [None,'deploy','publication','management','legacy-parent','other']:
   assert tier(caller,True)=='FULL'
  check(profile+':unknown-deploy-management-publication-legacy-parent-full',lambda:None)
  guard=text(g['base']+'/scripts/guard.mjs');owner=text(g['base']+'/scripts/process-owner.mjs');driver=text(g['base']+'/scripts/driver.mjs');peer=text(g['base']+'/scripts/peer.mjs');cli=text(g['base']+'/scripts/cli-prerequisites.mjs')
  assert "firstReviewedBinding===undefined?undefined:tier" in guard and "tier==='rpc'&&firstReviewedBinding!==undefined" in guard
  assert "if(firstFreezeDigest!==undefined&&firstFreezeDigest!==freezeDigest)" in guard
  assert "reviewed();" in owner[owner.index('spawn(args, options)'):owner.index('const child = spawn')]
  assert "const deadline=Math.min(freshDispatch(),lane.deadline)" in driver and 'await fetch(url' in driver
  assert "const deadline=Math.min(freshPeer(session),requestDeadline)" in peer
  assert "reviewed();const run=spawnSync(command,args" in cli
  check(profile+':original-latches-actual-dispatch-and-compiler-process-full-source-placement',lambda:None)
  # These semantics derive from original partition equality: loss, duplication,
  # or altered hash cannot be concealed by moving exactly one original row.
  fullRows=json.loads(text(g['base']+'/runner-dependency-inventory.json'))['inputs'];index={r['path']:r for r in fullRows}
  tiers=json.loads(text(g['base']+'/dependency-tiers.json'));rpc=copy.deepcopy(tiers['rpc']['runner']);boundary=copy.deepcopy(tiers['boundaryOnly']['runner']);row=next(r for r in rpc if r['path']==compiler);rpc.remove(row);boundary.append(row)
  def partition(a,b):
   merged=a+b
   if len(merged)!=len(index) or len({r['path'] for r in merged})!=len(index) or {r['path']:r for r in merged}!=index:raise ValueError('partition changed complete graph or original tuple')
  check(profile+':one-row-move-preserves-exact-full-tuples',lambda:partition(rpc,boundary))
  check(profile+':lost-compiler-full-row-denied',lambda:deny(lambda:partition(rpc,[r for r in boundary if r['path']!=compiler])))
  check(profile+':duplicate-compiler-row-denied',lambda:deny(lambda:partition(rpc+[row],boundary)))
  changed=copy.deepcopy(boundary);next(r for r in changed if r['path']==compiler)['sha256']='0'*64
  check(profile+':changed-original-compiler-hash-denied',lambda:deny(lambda:partition(rpc,changed)))
  # Exact source identifies the await gap in the computed router load. No claim
  # is made that the existing source satisfies the stronger proposed boundary.
  gap=cli[cli.index('export async function observedHttpRouter'):]
  assert "reviewed();" in gap and 'await build(' in gap and 'await import(pathToFileURL(output))' in gap
  assert 'reviewed();' not in gap[gap.index('await build('):gap.index('await import(pathToFileURL(output))')]
  check(profile+':router-post-build-pre-import-full-gap-detected',lambda:None)
 R['exitCode']=0
except BaseException as e:
 import traceback
 R['failures'].append(traceback.format_exc());R['exitCode']=1
R['utcPost']=now();(O/'design-adversaries-receipt.json').write_text(json.dumps(R,indent=2)+'\n');print(json.dumps(R));sys.exit(R['exitCode'])
