import datetime,importlib.util,json,os,shutil
from pathlib import Path
Q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-c4-c1');T=Path('/tmp/cortex-evidence-transport-c4-c1/clean-checkout')
loader=Q/'restore-git-modes.py';scope={'__file__':str(loader),'__name__':'verified_source_loader'};exec(compile(loader.read_bytes(),str(loader),'exec'),scope);h=scope['load_helper'](Q)
h.require(str(T)==os.path.abspath(T) and str(T)==os.path.realpath(T) and T.parent==Path('/tmp/cortex-evidence-transport-c4-c1'),'exact OWN temporary mirror path required');fd=h.directory(T);os.close(fd)
h.require(shutil.rmtree.avoids_symlink_attacks,'descriptor-safe removal required')
idx,m,rows,byhash=h.load(Q)
for name in ['git-clean-materialize','git-idempotence','git-readonly','source-topology-final','mode-audit-final','git-mode-controls-final']:
 receipt=json.loads((Q/(name+'.command.json')).read_bytes());h.require(receipt['exit']==0,'required verified cleanup prerequisite '+name)
start=datetime.datetime.now(datetime.timezone.utc).isoformat();h.verify_set(T,rows)
# Everything removed is a newly generated OWN temporary restoration, already retained as
# exact raw regular objects/literal rows/original manifests in frozen packet/source roots.
for obj,b in h.objects(Q,idx,m):pass
pre={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exactOwnedPath':str(T),'rowsVerified':len(rows),'originalManifestsVerified':len(h.ROOTS),'literalLinksVerified':m['literalLinks'],'indexSha256':h.INDEX_SHA,'mapDecodedSha256':idx['mapDecodedSha256'],'completeLosslessBackingReverified':True,'restoredRegularNlink1':True,'originalSourcesNeverCleanupTargets':True}
shutil.rmtree(T)
h.require(not os.path.lexists(T),'owned mirror still present')
for root in h.ROOTS:h.require(Path(root).is_dir(),'original root missing after own cleanup')
result={'status':'PASS_OWN_GENERATED_TEMPORARY_MIRROR_REMOVED_ONLY','utcPRE':start,'utcPOST':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pre':pre,'postOwnedTargetAbsent':True,'originalEightRootsPresent':True,'retained':'All original eight source roots, original manifests, new parts/index/map/raw/preimages/failed controls remain; own small adversarial fixtures remain','physicalBacking':'Temporary executor mirror is no longer physical backing and is not sealed as present; fresh independent judge must perform its own complete clean creation','authorization':'Prospective coordinator instruction permits only this exact newly generated OWN/tmp clean-checkout after verified prerequisites'}
(Q/'cleanup-git-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
