from pathlib import Path
import json,gzip,hashlib,copy
p=Path(__file__).absolute().parent;idx={x['path']:x for x in json.loads((p/'selected-historical-sources.json').read_text())['rows']};live={x['path']:x for x in json.loads((p/'current-source-before.json').read_text())['rows']};out=[]
def before(path):return gzip.decompress((p/idx[path]['preimage']).read_bytes()).decode()
def check(name,condition):
 assert condition,name
 out.append({'name':name,'outcome':'PASS','scope':'STATIC SOURCE MODEL ONLY'})
for profile in ['extra','extension','regression']:
 g=json.loads((p/f'{profile}-graph.json').read_text());base=g['base'];compiler='node_modules/typescript/lib/typescript.js';rows=json.loads(before(base+'/runner-dependency-inventory.json'))['inputs'];tiers=json.loads(before(base+'/dependency-tiers.json'));a=copy.deepcopy(tiers['rpc']['runner']);b=copy.deepcopy(tiers['boundaryOnly']['runner']);row=next(x for x in a if x['path']==compiler);a.remove(row);b.append(row)
 canonical=lambda z:sorted(z,key=lambda x:x['path'])
 check(profile+':move exactly one tuple',canonical(a+b)==canonical(rows) and len(a)==len(tiers['rpc']['runner'])-1 and len(b)==len(tiers['boundaryOnly']['runner'])+1 and (len(a),len(b))=={'extra':(99,19),'extension':(97,19),'regression':(96,17)}[profile])
 for kind in ['loss','duplicate','hash-drift']:
  altered=copy.deepcopy(a+b)
  if kind=='loss':altered=[x for x in altered if x['path']!=compiler]
  elif kind=='duplicate':altered.append(row)
  else:next(x for x in altered if x['path']==compiler)['sha256']='0'*64
  check(profile+':deny '+kind,canonical(altered)!=canonical(rows))
 guard=before(base+'/scripts/guard.mjs');check(profile+':first rpc FULL before latches',"sourcePreflight(firstReviewedBinding===undefined?undefined:tier,freezeDigest)" in guard and guard.index('const finalTrusted=trustedReview()')<guard.index('firstFreezeDigest=freezeDigest;firstReviewedBinding=trusted.digest;firstExpectedReview=trusted.expected;'))
 check(profile+':all non-rpc tiers FULL',"tier==='rpc'&&firstReviewedBinding!==undefined?[...tiers.rpc.runner,...tiers.rpc.tools]:[...runner.inputs,...tools.files]" in guard)
 check(profile+':pin immutable',"expected!==firstExpectedReview" in guard and 'digest!==firstReviewedBinding' in guard and 'firstFreezeDigest!==freezeDigest' in guard)
 path=base+'/scripts/cli-prerequisites.mjs';old=before(path);now=gzip.decompress((p/live[path]['preimage']).read_bytes()).decode();f=lambda s:s[s.index('export async function observedHttpRouter'):];newf=f(now);check(profile+':old awaitbuild gap retained','reviewed();const {router,effect}=await import' not in f(old));check(profile+':new immediate FULL exact placement',"logLevel:'silent'});reviewed();const {router,effect}=await import(pathToFileURL(output))" in newf)
 check(profile+':new repair only intended insertion',now==old.replace("logLevel:'silent'});const {router,effect}=await import", "logLevel:'silent'});reviewed();const {router,effect}=await import"))
 check(profile+':compiler adapter remains immediate FULL', 'reviewed();const run=spawnSync(command,args' in now)
print(json.dumps({'scope':'STATIC SOURCE MODEL ONLY; no source module/helper executed','controls':out,'count':len(out),'skipped':0},indent=2))
