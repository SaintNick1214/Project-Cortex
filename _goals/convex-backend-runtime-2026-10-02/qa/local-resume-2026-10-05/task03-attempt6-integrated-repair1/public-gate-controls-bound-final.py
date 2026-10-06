from pathlib import Path
import ast,copy,json,hashlib,os
R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion');QA=R/'_goals/convex-backend-runtime-2026-10-02/qa';P=QA/'local-resume-2026-10-05/task03-attempt6-integrated-repair1';Q=QA/'task03-local-native-attempt6-2026-10-06';tree=ast.parse((P/'source-gates-final.py').read_bytes());fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='qualify_public_release');code=compile(ast.Module(body=[fn],type_ignores=[]),'exact-public-current-release-data-only','exec');rows=[];request=json.loads((Q/'project-request.json').read_bytes());transport=json.loads((Q/'transport-prep/transport-binding.json').read_bytes());binding=json.loads((P/'prospective-binding-final.json').read_bytes());freeze=(Q/'candidate-freeze-attempt6.json').read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest();mf='M'*64;approval_sha='A'*64;image='sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
def case(name,change=None,accepted=True):
 management_source=b'PUBLIC_MEMORY_MANAGEMENT_SOURCE';recipe=b'PUBLIC_MEMORY_RECIPE';public_mf=b'PUBLIC_MEMORY_PUBLIC_HASH_MAP'
 prep={'scope':'BOUNDED_03_FOUNDATION_CURRENT_DELTA_PREPARATION','verdict':'PASS','independent':True,'candidateSha256':sha(freeze),'candidateMembers':1907}
 management={'scope':'TASK03_DISPOSABLE_TARGET_MANAGEMENT_ONLY','verdict':'PASS','independent':True,'managementSourceSha256':sha(management_source),'requestSha256':binding['requestSha256']}
 custody={'scope':'TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY','verdict':'PASS','independent':True,'operation':binding['operation'],'volume':binding['volume'],'candidateSha256':sha(freeze),'prospectiveSourceManifestSha256':mf,'sourceApprovalSha256':approval_sha,'immutableImage':image,'publicFiles':1914,'allCurrentDestinationIdentities':'PASS_ALL9','currentSourceDestinationFullContent':'PASS','publicRecipeBindingSha256':sha(recipe),'publicSourceManifestSha256':sha(public_mf),'publicTransferReceiptSha256':'0'*64}
 if change:
  target,field,value=change
  (custody if target=='custody'else prep if target=='prep'else management)[field]=value
 files={P/'prospective-binding-final.json':json.dumps(binding).encode(),Q/'candidate-freeze-attempt6.json':freeze,Q/'project-request.json':json.dumps(request).encode(),Q/'transport-prep/transport-binding.json':json.dumps(transport).encode(),P/'independent-preparation-review.json':json.dumps(prep).encode(),P/'task03-attempt6-management-review.json':json.dumps(management).encode(),P/'target-management.mjs':management_source,P/'task03-attempt6-linux-public-custody-review.json':json.dumps(custody).encode(),P/'public-recipe-binding-final.json':recipe,P/'public-source-receipt-manifest-final.json':public_mf}
 env={'P':P,'Q':Q,'strict':json.loads,'digest':sha,'json':json,'read':lambda path:files[path],'qualify_sources':lambda:({'candidateSha256':sha(freeze)},approval_sha,mf)};exec(code,env);observed=False
 try:result=env['qualify_public_release']();observed=result['publicTransferReceiptSha256']=='0'*64
 except AssertionError:pass
 assert observed is accepted,name;rows.append({'id':name,'status':'PASS','observedAccepted':observed,'privateAccess':0,'realEffects':0})
case('exact-fresh-public-binding-positive')
for field,value in [('prospectiveSourceManifestSha256','foreign'),('sourceApprovalSha256','foreign'),('immutableImage','foreign'),('operation','foreign'),('volume','foreign'),('candidateSha256','foreign'),('publicFiles',1913),('publicFiles',True),('allCurrentDestinationIdentities','STATIC_ONLY'),('currentSourceDestinationFullContent','FAIL'),('publicRecipeBindingSha256','foreign'),('publicSourceManifestSha256','foreign'),('publicTransferReceiptSha256','G'*64),('publicTransferReceiptSha256',False),('scope','foreign'),('independent',False)]:case('public-custody-deny-'+field+'-'+str(value),('custody',field,value),False)
for field,value in [('candidateMembers',True),('candidateSha256','foreign'),('independent',False)]:case('public-prep-deny-'+field,('prep',field,value),False)
for field,value in [('managementSourceSha256','foreign'),('requestSha256','foreign'),('independent',False)]:case('public-management-deny-'+field,('management',field,value),False)
result={'scope':'EXACT_REPAIR1_PUBLIC_RELEASE_DATA_GATES_EFFECT_SUBSTITUTED_ONLY','status':'PASS','count':len(rows),'rows':rows,'actualPublicCustody':False,'privateAccess':0,'realEffects':0}
fd=os.open(P/'public-gate-control-results-bound-final.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w')as f:json.dump(result,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
print(json.dumps({'status':'PASS_SOURCE_DATA_CONTROLS_ONLY','count':len(rows),'privateAccess':0,'realEffects':0}))
