import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { assetFixture, installMockRoot, assets, artifacts } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeAssets/fixture';
beforeEach(() => installMockRoot()); afterEach(() => jest.restoreAllMocks());
it('keeps an admitted multi-asset immutable history deletable at the owner release boundary', async () => {
 const f=await assetFixture(); const scope={tenantId:'tenant-a',memorySpaceId:'space-a'};
 const values=[]; for(let n=0;n<3;n++) values.push((await f.upload('private '+n,'upload-'+n)).asset);
 await f.call(artifacts.create,{...scope,artifactId:'retained-many',content:'original'});
 for(let n=0;n<256;n++) { const a=values[n%3]; await f.call(artifacts.attachAsset,{...scope,artifactId:'retained-many',assetId:a.assetId,version:a.assetVersion}); }
 const artifact=f.db.table('artifacts').find(a=>a.artifactId==='retained-many')!;
 expect(artifact.versionHistory.filter(v=>v.fileRef)).toHaveLength(256);
 const refs=f.db.table('runtimeAssetReferences').filter(e=>e.active&&e.kind==='artifact'&&e.ownerId==='retained-many');
 expect(refs).toHaveLength(257);
 expect(f.db.table('runtimeAssetReferences').filter(e=>e.active&&e.versionId===values[0].versionId).length).toBeLessThanOrEqual(100);
 await expect(f.call(artifacts.deleteArtifact,{...scope,artifactId:'retained-many'})).resolves.toMatchObject({deleted:true});
 expect(f.db.table('runtimeAssetReferences').filter(e=>e.active&&e.kind==='artifact'&&e.ownerId==='retained-many')).toHaveLength(0);
 for(const a of values){await f.call(assets.remove,{...scope,assetId:a.assetId}); await f.call(assets.cleanupVersion,{...scope,versionId:a.versionId});}
 expect(f.blobs.size).toBe(0);
},45000);

