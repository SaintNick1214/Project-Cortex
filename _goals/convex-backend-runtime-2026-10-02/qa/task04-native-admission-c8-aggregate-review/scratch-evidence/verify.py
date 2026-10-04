import json,hashlib,collections
from pathlib import Path
R=Path('/workspace/Project-Cortex');Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';O=Q/'task04-native-admission-c8-aggregate-review';E=Q/'task04-native-admission-c8-execution';F=Q/'task04-native-admission-fixture-c8';S=Q/'task04-native-admission-c8-fault-supplement'
h=lambda b:hashlib.sha256(b).hexdigest()
j=lambda p:json.loads(p.read_text())
results={}; inputs={}
def bind(p): inputs[str(p.relative_to(R))]={'bytes':p.stat().st_size,'sha256':h(p.read_bytes())}
def checkmanifest(p):
 m=j(p/'qa-manifest.json'); paths=[x['path'] for x in m['files']];actual=sorted(str(x.relative_to(p)) for x in p.rglob('*') if x.is_file() and x!=p/'qa-manifest.json');assert sorted(paths)==actual and len(paths)==len(set(paths))
 for x in m['files']:
  f=p/x['path'];assert not f.is_symlink();assert f.stat().st_size==x['bytes'] and h(f.read_bytes())==x['sha256'];bind(f)
 bind(p/'qa-manifest.json');return {'rows':len(paths),'sha256':h((p/'qa-manifest.json').read_bytes()),'allBindingsMatch':True}
for name,p in [('execution',E),('faultSupplement',S),('fixture',F)]:results[name]=checkmanifest(p)
assert results['execution']['sha256']=='23d7bf2e2e81d3f21f74d4b3cd448fce5ed08d4e81984373fd4174b2f262a22b'
assert results['faultSupplement']['sha256']=='7ceb79cc0aea3888dcb9fa3ab6a4c3fbd52ea5f7da33584b091a11545d4e9124'
for x in j(F/'runtime-freeze.json')['files']:
 p=F/x['path'];assert p.stat().st_size==x['bytes'] and h(p.read_bytes())==x['sha256']
for x in j(F/'runtime-inputs.json')['externalSources']:
 p=R/x['path'];assert p.stat().st_size==x['bytes'] and h(p.read_bytes())==x['sha256'];bind(p)
inv=j(F/'source-inventory.json')
for x in inv['acceptedGateHashes']:
 p=R/x['path'];assert h(p.read_bytes())==x['sha256'];bind(p)
for x in inv['files']:
 if x['kind']=='baseline-generated-not-native-codegen':continue
 p=R/x['source'];assert h(p.read_bytes())==x['sha256'];bind(p)
for p,expected in [('convex-dev/runtimeModelPolicy.ts','bed10cc3934aac6743ff0cb08911765d84e9db18446cd8aebff979815068207f'),('tests/unit/runtime/model-policy-admission.test.ts','51a8a1072ec5d782fcd44fbcd03e1b7010f705568461a30896bbd9a234b39b23')]:assert h((R/p).read_bytes())==expected;bind(R/p)
rows=[];chains=[]
for p in sorted(E.glob('journal-*.jsonl')):
 b=p.read_bytes();assert b.endswith(b'\n');prev='0'*64
 for i,line in enumerate(b.splitlines(),1):
  x=json.loads(line);digest=x.pop('receiptDigest');assert x['sequence']==i and x['previousDigest']==prev;assert h(json.dumps(x,separators=(',',':'),ensure_ascii=False).encode())==digest;prev=digest;assert len(line)<4096;x['receiptDigest']=digest;rows.append(x)
 chains.append({'path':p.name,'rows':i,'lastDigest':prev})
assert len(rows)==4516
cnt=collections.Counter(x.get('observedCategory') for x in rows);assert cnt['authorization-denied']==1400 and cnt['whole-state-equal']==200 and cnt['published-internal-inaccessible']==162
assert collections.Counter(x['caseId'] for x in rows if x.get('phase')=='case' and x.get('observedCategory')=='outcome-asserted')==collections.Counter(x['id'] for x in j(F/'cases.json')['scenarios'])
security=[x for x in rows if x.get('phase')=='security'];assert sum(x.get('noEffect') is True for x in security)==200
main=next([json.loads(l) for l in p.read_text().splitlines()] for p in E.glob('journal*') if '"sequence":4438' in p.read_text())
for path in ['artifacts-completeArtifactUpload','attachments-attach']:
 hits=[x for x in main if x['caseId']==path and x.get('observedCategory')=='rpc-rejected'];assert len(hits)==7 and hits[0]['failureClass']=='unauthenticated';print('STORAGE first noJWT structured denial',path,len(hits),hits[0]['sequence'])
results['journals']={'chains':chains,'rows':len(rows),'categories':dict(cnt),'failureClasses':dict(collections.Counter(x.get('failureClass') for x in rows if x.get('status')=='FAIL'))}
registrations=j(F/'registration-inventory.json')['registrations']
for phase in ['empty','synthetic']:
 m=j(E/f'publication-manifest-{phase}.json');b=b''.join((E/x['path']).read_bytes() for x in m['chunks']);assert len(b)==m['bundleBytes'] and h(b)==m['bundleSha256'];bundle=json.loads(b);print('BUNDLE KEYS',phase,list(bundle));raw=j(E/f'publication-raw-{phase}.bin');print('RAW KEYS',list(raw))
 funcs=bundle['functions'];assert len(funcs)==281
 native=[{'path':x['identifier'].replace('.js:',':'),'type':x['functionType'].lower(),'visibility':x['visibility'] if isinstance(x['visibility'],str) else x['visibility']['kind'],'args':json.loads(x['args']) if isinstance(x['args'],str) else x['args']} for x in raw['value'] if x['functionType']!='HttpAction'];assert {x['path']:(x['type'],x['visibility'],x['args']) for x in native}=={x['path']:(x['type'],x['visibility'],x['args']) for x in funcs}
 observed={x['path']:(x['type'],x['visibility'],x['args']) for x in funcs};expected={x['path']:(x['type'],x['visibility'],x['args']) for x in registrations};assert observed==expected
 pub=j(E/f'publication-{phase}.json');assert pub['freezeSha256']==h((F/'runtime-freeze.json').read_bytes()) and pub['status']=='PASS'
 for x in pub['generated']:
  p=E/f'official-generated-{phase}'/Path(x['path']).name;assert h(p.read_bytes())==x['sha256']
 results['publication-'+phase]={'fullFunctions':len(funcs),'fullTupleAndArgumentEquality':True,'bundleSha256':h(b)}
for p in E.glob('window-proof*'):
 x=j(p);assert x['status']=='PASS' and x['before']==x['after']
 for a in x['before']:assert a['windowStart']+1000<=x['bracket']['startMs'] and x['bracket']['endMs']+1000<a['windowEnd']
results['windowProofs']=4
for mode in ['before-peer','lost-receipt','before-settle']:
 x=j(E/f'fault-result-{mode}.json');assert x['status']=='PASS';assert x['counts']=={'effectCount':0 if mode=='before-peer' else 1,'requestCount':0 if mode=='before-peer' else 1}
 for stage,expected in [('boundary',[100,0,0,1]),('unknown',[0,100,0,1])]:assert [x[stage][k] for k in ['reservedUnits','uncertainUnits','settledUnits','activeConcurrency']]==expected
 proc=j(E/f'fault-process-{mode}.json');assert proc['directChildWaited'] and proc['remaining']==0 and proc['parentForcedKill']
 known=[x for x in rows if x['caseId']=='before-settle-known-settled'];assert len(known)==1 and known[0]['counts']=={'reservedUnits':0,'uncertainUnits':0,'settledUnits':40,'activeConcurrency':0}
results['faults']={'threeParentKills':True,'requestsEffects':[[0,0],[1,1],[1,1]],'knownExactlyOnce40':True}
ret=j(E/'retirement-56bb38d9-d9a2-4bba-b3f6-5fd61684b773.json');assert ret['deletionHttpStatus']==200 and ret['absentProjectHttpStatus']==404 and ret['managementCalls']==5
assert len(list(E.glob('ticket-native-*')))==2687
own=j(E/'owned-physical-row-hash-witnesses.json');created=[x for x in own if x['event']=='created'];deleted=[x for x in own if x['event']=='deleted'];assert len(created)==len(deleted)==736;assert {(x['table'],x['idSHA256']) for x in created}=={(x['table'],x['idSHA256']) for x in deleted}
results['budgets']={'clientRpc':2687,'nestedUpperBound':9,'totalUpperBound':2696,'ceiling':3000,'createdDeleted':736,'rowCeiling':783,'peerEffectTickets':len(list(E.glob('ticket-peer-effect-*'))),'peerOtherTickets':len(list(E.glob('ticket-peer-other-*'))),'processTickets':len(list(E.glob('ticket-process-*')))}
results['retirement']=ret
(O/'independent-verification.json').write_text(json.dumps(results,indent=2)+'\n');(O/'read-source-bindings.json').write_text(json.dumps(inputs,indent=2)+'\n');print(json.dumps(results,indent=2))
