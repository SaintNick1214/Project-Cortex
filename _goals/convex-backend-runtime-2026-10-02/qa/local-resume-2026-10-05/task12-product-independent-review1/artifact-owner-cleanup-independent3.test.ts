import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { assetFixture, installMockRoot, assets, artifacts } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeAssets/fixture';
beforeEach(() => installMockRoot()); afterEach(() => jest.restoreAllMocks());
it('releases an existing 257-owner immutable history in bounded current-derived pages and retains live continuation owners', async () => {
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
 // Explicitly seed the previously reachable 256-change state; this is not a
 // claim that this prefix was replayed through all native mutations in this test.
 row.versionHistory.push({version:257,fileRef:file(255),timestamp:Date.now(),changedBy:f.principal._id,changeType:'update',changeSummary:'Immutable asset attached'});
 Object.assign(row,{version:257,versionPointer:257,fileRef:file(255)});
 f.db.seed('runtimeAssetReferences',{...scope,versionId:values[0].versionId,kind:'artifact',ownerId:'retained-many',ownerVersion:'257',ownerPrincipalId:f.principal._id,active:true,createdAt:Date.now()});
 const current=f.db.table('runtimeAssetReferences').find(e=>e.kind==='artifact'&&e.ownerVersion==='current')!; current.versionId=values[0].versionId;
 expect(f.db.table('runtimeAssetReferences').filter(e=>e.active&&e.kind==='artifact')).toHaveLength(257);
 for(const a of values) expect(f.db.table('runtimeAssetReferences').filter(e=>e.active&&e.versionId===a.versionId).length).toBeLessThanOrEqual(100);
 // A delayed page derives today's retained owner and does not delete current.
 await f.call(assets.reconcileOwnerReferences,{...scope,kind:'artifact',ownerId:'retained-many',afterOwnerVersion:'99'});
 expect(current.active).toBe(true);
 for(const a of values) await f.call(assets.remove,{...scope,assetId:a.assetId});
 await expect(f.call(artifacts.deleteArtifact,{...scope,artifactId:'retained-many'})).resolves.toMatchObject({deleted:true});
 await expect(f.call(assets.get,{...scope,assetId:values[0].assetId,version:1})).rejects.toMatchObject({data:{code:'FORBIDDEN'}});
 const pages=f.scheduled.filter(s=>s.name==='runtimeAssets:reconcileOwnerReferences'); expect(pages.length).toBeGreaterThan(0);
 for(const page of pages) await f.call(assets.reconcileOwnerReferences,page.args);
 expect(f.db.table('runtimeAssetReferences').filter(e=>e.active&&e.kind==='artifact')).toHaveLength(0);
 for(const a of values) await f.call(assets.cleanupVersion,{...scope,versionId:a.versionId});
 expect(f.blobs.size).toBe(0);
},45000);
