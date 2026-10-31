"""Finite source proposal metadata; not a runtime or historical attestation."""
import hashlib,json
from pathlib import Path
N=Path(__file__).resolve().parents[1];O=N.parent/'task04-current-producer-native-public-preparation1';S=N/'source'
def dump(path,obj):
 with open(path,'x')as f:json.dump(obj,f,sort_keys=True,indent=2);f.write('\n')
files=[]
for p in sorted(S.rglob('*')):
 if p.is_file() and p.name!='source-manifest.json':
  raw=p.read_bytes();files.append({'path':p.relative_to(S).as_posix(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
# Lexical full POSIX ordering, never Pathlib segment ordering.
files.sort(key=lambda r:r['path'])
dump(S/'source-manifest.json',{'schema':'NATIVE_PUBLIC_SOURCE_MANIFEST_V1','scope':'SOURCE_ONLY_PROPOSAL_NOT_RELEASE','files':files,'fileCount':len(files),'sourceBytes':sum(x['bytes']for x in files),'historicalCustody':'NOT_ADOPTED'})
old=json.loads((O/'source/source-manifest.json').read_bytes());before={x['path']:x for x in old['files']};after={x['path']:x for x in files}
rows=[]
for name in sorted(set(before)|set(after)):
 b=before.get(name);a=after.get(name)
 rows.append({'oldPath':'N4/source/'+name if b else None,'newPath':'source/'+name if a else None,
  'oldPin':b,'newPin':a,'delta':'ADDED'if b is None else'BYTE_EXACT'if a==b else'REPAIRED',
  'oldSourceImmutable':True,'newPreimage':'evidence/preimages/'+name if b and a!=b else None})
originals=json.loads((O/'evidence/source-conservation.json').read_bytes())['files']
proof=[]
for original in originals:
 name=original['destination'].removeprefix('source/');current=after[name];old_pin=before[name]
 assert (old_pin['sha256'],old_pin['bytes'])==(original['sha256'],original['bytes'])
 backing='source/'+name if current==old_pin else'evidence/preimages/'+name
 raw=(N/backing).read_bytes()
 assert (len(raw),hashlib.sha256(raw).hexdigest())==(original['bytes'],original['sha256'])
 proof.append({'originalSource':original['source'],'oldN4Destination':original['destination'],
  'newExactConservationBacking':backing,'bytes':len(raw),'sha256':original['sha256'],
  'runtimeSameBytes':current==old_pin,'originalHistoricalCustody':'NOT_REPAIRED'})
dump(N/'evidence/old-to-new-delta-map1.json',{'scope':'LITERAL_CURRENT_SOURCE_DELTAS_ONLY','oldCount':111,'newCount':len(files),'rows':rows,
 'byteExactCount':sum(x['delta']=='BYTE_EXACT'for x in rows),'repairedCount':sum(x['delta']=='REPAIRED'for x in rows),'addedCount':sum(x['delta']=='ADDED'for x in rows)})
dump(N/'evidence/original-conservation-proof1.json',{'scope':'EXACT_ORIGINAL_ASSERTIONS_AND_FINITE_SOURCE_CONSERVATION_NOT_EXECUTION','originalCount':len(proof),'rows':proof,'bootstrapByteExact':True,'runner48ByteExact':True,'control20BodyByteExact':True,'historicalCustodyRepaired':False})
qual=json.loads((O/'qualification-map.json').read_bytes());qual['scope']='REPAIRED_SOURCE_PROPOSAL_NOT_EXECUTION_OR_RELEASE'
qual['twoPhaseArchitecture']={'native20':'exclusive PID1 /native-source/native-controller.py, independent120 plus OWN20 body20',
 'public48':'separate exclusive PID1 /reviewed-bootstrap.py, original public300 and original outer480',
 'serialOrder':['native20','finite-export','known-owned-retirement','public48','finite-export','final-known-only-cleanup'],
 'nativeOwnerContinuityAcrossPhases':'ABSENT','startupCacheClosure':'NOT_CLAIMED','originalBootstrapUnchanged':True}
dump(N/'qualification-map.json',qual)
admission=json.loads((O/'admission-final-proposal.json').read_bytes());admission['scope']='REPAIR1_PROPOSED_CAPS_NOT_ACTUAL_ADMISSION'
admission['actualSourceBytesBeforeOwnManifest']=sum(x['bytes']for x in files);admission['sourceFileCountExcludingOwnManifest']=len(files)
admission['sourceManifestBytes']=(S/'source-manifest.json').stat().st_size;admission['sourceManifestSHA256']=hashlib.sha256((S/'source-manifest.json').read_bytes()).hexdigest()
admission['maxSimultaneousOwnedContainerFootprints']=1;admission['cumulativeExportPathCapIncludingManifests']=4096
admission['infrastructureWindow']={'activation':'HELD','prospectiveJobSeconds':2700,'checkoutSeconds':180,'sourceStepSeconds':2220,
 'coordinatorBodySeconds':2100,'setupAcquisitionSeconds':180,'imageBuildSeconds':720,
 'native20CreateBindingSeconds':120,'native20ExecutionSeconds':120,'successfulFirstRetirementSeconds':60,
 'public48CreateBindingSeconds':120,'public48ExecutionSeconds':480,'cumulativeExportSeconds':300,
 'bodyArithmetic':'180+720+120+120+60+120+480+300=2100','cleanupFinalCustodySeconds':60,
 'sourceStepStartupMarginSeconds':60,'stepArithmetic':'2100+60+60=2220','artifactUploadSeconds':240,
 'frameworkMarginSeconds':60,'jobArithmetic':'180+2220+240+60=2700','unchangedPublicControlSeconds':300,
 'unchangedPublicEnvelopeSeconds':480,'originalNativeRecipe20Seconds':20,'originalWhole120Seconds':120,
 'additionalOwn20Seconds':20,'newInfrastructureBuildAllowanceTightenedFrom900To720':True,
 'firstRetirementMustNotBorrowFinalCleanup':True,'exceededAllowanceOutcome':'FAILED_HOLD'}
dump(N/'admission-proposal.json',admission)
workflow=(O/'task04-current-producer-native-public.yml.proposed').read_text().replace('task04-current-producer-native-public-preparation1/source/','task04-current-producer-native-public-repair1/source/').replace('name: Task04 current producer native public qualification','name: Task04 repaired two-owner native public source qualification')
a=workflow.index('          path: |');b=workflow.index('          if-no-files-found:',a)
fixed=['public-artifact-manifest.json','operation.json','host-preflight.json','host-source-before.json','trusted-startup.json','daemon.json','parser-acquisition.json','input-manifest.json','image.json','run-result.json','host-failure.json','cleanup-terminal.json','cleanup-failure.json','writer-stop.json','native20-retirement.json']
for mode in ('native20','public48'):
 fixed.extend(mode+'-'+suffix+'.json'for suffix in ('expected-bindings','source-before','create-inspect','terminal','polls','export-copy'))
fixed.extend(['command-*.json','command-*.stdout','command-*.stderr','copy-native20-file-*.json','copy-public48-file-*.json','copy-native20-native-export-manifest.json.json','copy-public48-public-export-manifest.json.json','export/native20/file-*','export/native20/native-export-manifest.json','export/public48/file-*','export/public48/public-export-manifest.json'])
workflow=workflow[:a]+'          path: |\n'+''.join('            ${{ runner.temp }}/task04-native-public-current/'+path+'\n'for path in fixed)+workflow[b:]
(N/'task04-current-producer-native-public.yml.proposed').write_text(workflow)
print(json.dumps({'sourceCount':len(files),'sourceBytes':sum(x['bytes']for x in files),'originals':len(proof),'byteExact':sum(x['delta']=='BYTE_EXACT'for x in rows),'changed':sum(x['delta']=='REPAIRED'for x in rows),'added':sum(x['delta']=='ADDED'for x in rows)}))
