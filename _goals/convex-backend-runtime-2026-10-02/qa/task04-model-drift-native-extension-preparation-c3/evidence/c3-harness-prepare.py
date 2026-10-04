from pathlib import Path
import json,hashlib,uuid,shutil,datetime
repo=Path('/workspace/Project-Cortex'); q=repo/'_goals/convex-backend-runtime-2026-10-02/qa'; work=repo/'work/resume/task04-model-drift-native-preparation-c3'
old=q/'task04-terminal-capture-native-extension-preparation-c4'; c9=q/'task04-terminal-capture-parent-inputs-c9-preparation'; acceptance=q/'task04-model-drift-charge-only-c1-coordinator-acceptance.json'; pins=json.loads(acceptance.read_text())['sourcePins']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for name,d in pins.items():assert sha(repo/name)==d,(name,'SOURCE_PIN_MISMATCH')
for kind,src in [('extension',old),('regression',old/'regression'),('extra',old)]:
 name=f'task04-model-drift-native-{kind}-preparation-c3';dest=q/name;dest.mkdir(exist_ok=False)
 for folder in ['fixture','scripts']:shutil.copytree(src/folder,dest/folder)
 for name2 in ['project-request.json','cases.json','source-inventory.json','registration-inventory.json','schema-evidence.json','profile.json','divergence.json','toolchain-evidence.json','runtime-inputs.json','historical-preservation.json','historical-parent-c7-review-full-index.json']:
  shutil.copyfile(src/name2,dest/name2)
 (dest/'preimages').mkdir()
 for path in ['scripts/cases.mjs','scripts/driver.mjs','scripts/guard.mjs','fixture/convex/qualificationCapture.ts']:
  (dest/'preimages'/path.replace('/','--')).write_bytes((src/path).read_bytes())
 purpose=f'task04-model-drift-native-{kind}-c1';req=json.loads((dest/'project-request.json').read_text());originalreq=json.loads((src/'project-request.json').read_text());req.update(operation=str(uuid.uuid4()),purpose=purpose,runId='admission-'+uuid.uuid4().hex,projectName='cortex-task04-admission-disposable-'+uuid.uuid4().hex[:12]);req['projectSlug']=req['projectName'];req['privateEnvironmentFile']=f'work/backend-runtime/{purpose}/deploy.env';(dest/'project-request.json').write_text(json.dumps(req,indent=2)+'\n')
 replacements={originalreq['purpose']:purpose, 'task04-terminal-capture-native-extension-preparation-c4/regression':name if kind=='regression' else 'task04-terminal-capture-native-extension-preparation-c4/regression','task04-terminal-capture-native-extension-preparation-c4':name}
 # Original assertion case sources are left byte-exact. Only source-dependent operational paths in helpers adapt.
 for p in (dest/'scripts').glob('*.mjs'):
  if p.name in ['cases.mjs','original-b-cases.mjs']:continue
  txt=p.read_text()
  for a,b in replacements.items():txt=txt.replace(a,b)
  txt=txt.replace('work/resume/'+name,'work/resume/task04-model-drift-native-preparation-c3/'+kind)
  p.write_text(txt)
 (work/kind).mkdir()
 shutil.copyfile(repo/'convex-dev/runtimeModelPolicy.ts',dest/'fixture/convex/runtimeModelPolicy.ts')
 inv=json.loads((dest/'source-inventory.json').read_text())
 for row in inv['files']:
  if row['source']=='convex-dev/runtimeModelPolicy.ts':row['sha256']=pins[row['source']]
  assert sha(repo/row['source'])==row['sha256'],(kind,row['source'],'NOT_ACCEPTED_CURRENT_SOURCE')
 for row in inv['acceptedGateHashes']:
  if row['path'] in pins:row['sha256']=pins[row['path']]
 inv['acceptedGateHashes'] += [{'path':str(acceptance.relative_to(repo)),'sha256':sha(acceptance)}] + [{'path':p,'sha256':d} for p,d in pins.items() if p not in [r['path'] for r in inv['acceptedGateHashes']]]
 inv['status']='POST_REPAIR_SOURCE_CAPSULE_PREPARATION_NOT_ACCEPTED';(dest/'source-inventory.json').write_text(json.dumps(inv,indent=2)+'\n')
 # Fresh public parent/watch source templates. Never execute private/input generation here.
 suffix='regression' if kind=='regression' else 'extension'
 for label,oldname in [('parent-inputs.mjs',f'parent-inputs-{suffix}.mjs'),('current-inputs.mjs',f'current-inputs-{suffix}.mjs')]:
  text=(c9/oldname).read_text();text=text.replace('../task04-terminal-capture-native-extension-preparation-c4/regression/scripts/','./').replace('../task04-terminal-capture-native-extension-preparation-c4/scripts/','./')
  text=text.replace('./parent-inputs-'+suffix+'.mjs','./parent-inputs.mjs')
  start=text.index('export const profileContract=Object.freeze(') if label=='parent-inputs.mjs' else -1
  if start>=0:
   end=text.index(');',start)+2;text=text[:start]+'export const profileContract=Object.freeze('+json.dumps(req,separators=(',',':'))+');'+text[end:]
   start=text.index('export const acceptedSourceBindings=Object.freeze(');end=text.index(');',start)+2;text=text[:start]+'export const acceptedSourceBindings=Object.freeze('+json.dumps(inv['acceptedGateHashes'],separators=(',',':'))+');'+text[end:]
  text=text.replace('task04-terminal-capture-native-extension-preparation-c4/regression',name).replace('task04-terminal-capture-native-extension-preparation-c4',name)
  (dest/'scripts'/label).write_text(text)
 # Context control paths must be source specific; copy all imports from the public fixture untouched.
 hist=json.loads((dest/'historical-preservation.json').read_text())
 for packet,manifest in [(src,'qa-manifest.json'),(c9,'qa-manifest.json'),(q/'task04-terminal-capture-native-c4-aggregate-review','qa-manifest.json'),(q/'task04-model-drift-native-profile-design-c1','manifest.json'),(q/'task04-model-drift-native-profile-design-c1-review','manifest.json')]:
  m=json.loads((packet/manifest).read_text());hist['packets'].append({'path':str(packet.relative_to(repo)),'manifest':manifest,'manifestSHA256':sha(packet/manifest),'rows':len(m['files'])})
 (dest/'historical-preservation.json').write_text(json.dumps(hist,indent=2)+'\n')
 runtime=json.loads((dest/'runtime-inputs.json').read_text());runtime['externalSources']=[];runtime['parentSourceClosure']='Fresh source-specific public parent/watch templates are operational scripts; private originals ROOT-only; no actual target input certification.';(dest/'runtime-inputs.json').write_text(json.dumps(runtime,indent=2)+'\n')
 preserve={'predecessor':str(src.relative_to(repo)),'new':str(dest.relative_to(repo)),'assertionSources':[],'policyAcceptedSha256':pins['convex-dev/runtimeModelPolicy.ts'],'schemaAcceptedSha256':pins['convex-dev/runtimePolicySchema.ts'],'identity':req,'native':'NOT_RUN'}
 for file in ['scripts/cases.mjs']+(['scripts/original-b-cases.mjs'] if (src/'scripts/original-b-cases.mjs').exists() else []):preserve['assertionSources'].append({'path':file,'sha256':sha(src/file),'newSha256':sha(dest/file),'byteExact':(src/file).read_bytes()==(dest/file).read_bytes()})
 (dest/'preservation-map.json').write_text(json.dumps(preserve,indent=2)+'\n')
print('THREE_OPERATIVE_CAPSULES_CREATED; preparation not frozen/accepted; no native actions')
