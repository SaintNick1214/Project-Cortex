"""Independent bounded full-EOF/held-FD/current-nine source pin verification."""
import ast
import hashlib
import json
import os
from pathlib import Path
import stat

R=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
G=R/'_goals/convex-backend-runtime-2026-10-02'
W=R/'work/resume/task04-c8-current-canonical-input-producers'
D=Path(__file__).resolve().parent
MF=G/'qa/local-resume-2026-10-05/task04-current-canonical-input-producers/closed-source-manifest.json'
EXPECTED_MF='afc703999f7779d0621f6a3aedd8ac0792abe633e0b0f0690929c6e069a327ae'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
identity=lambda s:{'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k))for k in FIELDS}}
descriptors=[];rows=[];errors=[];syntax=[]
def held_read(path, maximum):
    before=os.lstat(path)
    if not stat.S_ISREG(before.st_mode)or before.st_nlink!=1 or path.resolve()!=path:raise ValueError('not literal regular single-link '+str(path))
    if before.st_size>maximum:raise ValueError('before-read finite bound')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);descriptors.append((path,fd,identity(before)))
    opened=os.fstat(fd);chunks=[];total=0;digest=hashlib.sha256()
    while part:=os.read(fd,65536):
        total+=len(part)
        if total>maximum:raise ValueError('during-read finite bound')
        chunks.append(part);digest.update(part)
    post=os.fstat(fd);path_post=os.lstat(path)
    row={'path':str(path),'bytes':total,'sha256':digest.hexdigest(),'PRE':identity(before),'OPEN':identity(opened),'POST':identity(post),'pathPOST':identity(path_post),'EOF':True}
    if not(row['PRE']==row['OPEN']==row['POST']==row['pathPOST'])or total!=before.st_size:raise ValueError('current EOF/all-nine drift '+str(path))
    return row,b''.join(chunks)
try:
    mf_proof,mf_raw=held_read(MF,65536)
    if mf_proof['sha256']!=EXPECTED_MF:raise ValueError('closed manifest hash mismatch')
    mf=json.loads(mf_raw)
    expected_paths={str((W/'source'/name).relative_to(R))for name in ['ast_parser.mjs','build_reference_contract.py','canonical_entry.py','consumer_schema.mjs','consumer_wiring.mjs','literal-destination-map.json','native_boundary.py','producers.py','reference-contract.json','reference-input-observations.json','strict_io.py']}
    expected_paths|={str((W/'controls'/name).relative_to(R))for name in ['bootstrap_boundary_controls.py','host_boundary_controls.py','run_controls.py']}
    expected_paths|={str((W/name).relative_to(R))for name in ['README.md','CONTRACTS.md','schemas.json']}
    expected_paths|={str((W/'linux-public-control-proposal'/name).relative_to(R))for name in ['bootstrap-public-controls-r3.py','input-manifest-r3.json','recipe-r3.json','public-control-demand-r3.json']}
    expected_paths|={'node_modules/typescript/lib/typescript.js','work/resume/task04-model-drift-native-preparation-c5/output-route-audit/proposed-closed-command-contract.json'}
    if len(mf['files'])!=23 or len({row['path']for row in mf['files']})!=23 or {row['path']for row in mf['files']}!=expected_paths or mf['fileCount']!=23 or mf['bytes']!=10882835:raise ValueError('closed manifest exact 23 membership/demand mismatch')
    if mf['sourceWritersClosed']is not True or mf['nativeClaims']is not False or mf['historicalCustody']!='NOT_ADOPTED'or mf['DockerActivation']!='HELD'or mf['original122']!='HELD'or mf['ROOT']!='ABSENT':raise ValueError('closed manifest scope mismatch')
    for pin in mf['files']:
        row,raw=held_read(R/pin['path'],16777216)
        row['closedManifestPRE']=pin['PRE']
        row['closedPinMatches']=row['PRE']==pin['PRE']and row['bytes']==pin['bytes']and row['sha256']==pin['sha256']and pin['PRE']==pin['OPEN']==pin['POST']==pin['pathPOST']and pin['EOF']is True
        if not row['closedPinMatches']:errors.append({'path':row['path'],'failure':'closed source pin mismatch; no refresh'})
        if row['path'].endswith('.py'):
            ast.parse(raw.decode(),filename=row['path']);syntax.append({'path':row['path'],'pythonASTOnly':'PASS'})
        rows.append(row)
    if sum(row['bytes']for row in rows)!=mf['bytes']:errors.append({'failure':'aggregate bytes mismatch'})
    final=[]
    for path,fd,pin in descriptors:
        observed_fd=identity(os.fstat(fd));observed_path=identity(os.lstat(path));ok=pin==observed_fd==observed_path
        final.append({'path':str(path),'FD':observed_fd,'path':str(path),'pathIdentity':observed_path,'matchesOriginalPRE':ok})
        if not ok:errors.append({'path':str(path),'failure':'final held-FD/path all-nine mismatch; no refresh'})
except BaseException as error:errors.append({'failure':repr(error)})
finally:
    for _,fd,_ in descriptors:os.close(fd)
result={'scope':'INDEPENDENT_CLOSED_SOURCE_CONTENT_AND_CURRENT_HOST_IDENTITY_ONLY','status':'PASS'if not errors else'FAIL','manifest':str(MF),'expectedManifestSHA256':EXPECTED_MF,'manifestProof':locals().get('mf_proof'),'files':rows,'fileCount':len(rows),'bytes':sum(row['bytes']for row in rows),'pythonSyntax':syntax,'finalRechecks':locals().get('final',[]),'errors':errors,'heldDescriptorsClosed':True,'nativeQualification':False,'historicalCustody':'NOT_ADOPTED','original122':'HELD','ROOT':'ABSENT'}
with(D/'closed-source-verification.json').open('x')as f:f.write(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'fileCount':result['fileCount'],'bytes':result['bytes'],'errors':errors}))
raise SystemExit(bool(errors))
