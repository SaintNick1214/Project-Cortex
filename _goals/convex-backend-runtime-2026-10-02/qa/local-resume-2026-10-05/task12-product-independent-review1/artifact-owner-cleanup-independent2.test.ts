import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { assetFixture, installMockRoot, assets, artifacts } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeAssets/fixture';
beforeEach(() => installMockRoot()); afterEach(() => jest.restoreAllMocks());
it('isolates final actual history admission and deletion from a typed reachable 255-change prefix', async () => {
 const f=await assetFixture(); const scope={tenantId:'tenant-a',memorySpaceId:'space-a'};
 const values=[]; for(let n=0;n<3;n++) values.push((await f.upload('private '+n,'upload-'+n)).asset);
 await f.call(artifacts.create,{...scope,artifactId:'retained-many',content:'original'});
 await f.call(artifacts.attachAsset,{...scope,artifactId:'retained-many',assetId:values[0].assetId,version:1});
 const row=f.db.table('artifacts').find(a=>a.artifactId==='retained-many')!;
 const file=(n:number)=>{const a=values[n%3];const stored=f.db.table('runtimeAssetVersions').find(v=>v.versionId===a.versionId)!;return {storageId:stored.storageId,assetId:a.assetId,versionId:a.versionId,assetVersion:1,mimeType:a.mimeType,size:a.sizeBytes,checksum:a.contentHash};};
 // Fixture construction represents repeated admitted alternating immutable files;
 // only the final transition below is executed through the real registered handler.
 const history=[row.versionHistory[0],...Array.from({length:255},(_,n)=>({version:n+2,fileRef:file(n),timestamp:Date.now(),changedBy:f.principal._id,changeType:'update',changeSummary:'Immutable asset attached'}))];
 Object.assign(row,{version:256,versionPointer:256,versionHistory:history,fileRef:file(254)}); delete row.content;
 for(const e of [...f.db.table('runtimeAssetReferences')]) if(e.kind==='artifact'&&e.ownerId==='retained-many') await f.db.delete('runtimeAssetReferences',e._id);
 for(let n=0;n<255;n++) f.db.seed('runtimeAssetReferences',{...scope,versionId:values[n%3].versionId,kind:'artifact',ownerId:'retained-many',ownerVersion:String(n+2),ownerPrincipalId:f.principal._id,active:true,createdAt:Date.now()});
 f.db.seed('runtimeAssetReferences',{...scope,versionId:values[2].versionId,kind:'artifact',ownerId:'retained-many',ownerVersion:'current',ownerPrincipalId:f.principal._id,active:true,createdAt:Date.now()});
 expect(f.db.table('runtimeAssetReferences').filter(e=>e.active&&e.kind==='artifact')).toHaveLength(256);
 expect(await f.call(artifacts.getVersion,{...scope,artifactId:'retained-many',version:256})).toMatchObject({fileRef:{versionId:values[2].versionId}});
 await f.call(artifacts.attachAsset,{...scope,artifactId:'retained-many',assetId:values[0].assetId,version:1});
 expect(f.db.table('runtimeAssetReferences').filter(e=>e.active&&e.kind==='artifact')).toHaveLength(257);
 for(const a of values) expect(f.db.table('runtimeAssetReferences').filter(e=>e.active&&e.versionId===a.versionId).length).toBeLessThanOrEqual(100);
 await expect(f.call(artifacts.deleteArtifact,{...scope,artifactId:'retained-many'})).resolves.toMatchObject({deleted:true});
 expect(f.db.table('runtimeAssetReferences').filter(e=>e.active&&e.kind==='artifact')).toHaveLength(0);
 for(const a of values){await f.call(assets.remove,{...scope,assetId:a.assetId}); await f.call(assets.cleanupVersion,{...scope,versionId:a.versionId});} expect(f.blobs.size).toBe(0);
},45000);

