from pathlib import Path
import json,base64,hashlib,stat,os,datetime
R=Path.cwd();W=R/'work/resume';Q=R/'_goals/convex-backend-runtime-2026-10-02/qa';records=[]
for n in [38,39]:
 meta=json.loads((W/f'transfer{n}-binary-upload-meta.json').read_bytes());plan=json.loads((W/f'connector-transfer-plan-{n}.json').read_bytes());byblob={r['blob']:r for r in plan['rows']};directory=Path(f'/tmp/cortex-root-storage-rescue/transfer{n}-encodings');ds=directory.lstat();assert stat.S_ISDIR(ds.st_mode)and not directory.is_symlink()and ds.st_uid==os.getuid()and directory.resolve()==directory;expected={x['blob']+'.b64'for x in meta};assert {p.name for p in directory.iterdir()}==expected;rows=[]
 for x in meta:
  p=directory/(x['blob']+'.b64');assert str(p)==x.get('file',x.get('path'));s=p.lstat();assert stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_uid==os.getuid();raw=p.read_bytes();assert len(raw)==x['characters'];b=base64.b64decode(raw,validate=True);assert base64.b64encode(b)==raw;r=byblob[x['blob']];assert len(b)==r['bytes']and hashlib.sha256(b).hexdigest()==r['sha256']and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['blob'];assert Path(r['sourcePath']).read_bytes()==b
  rows.append({'path':str(p),'bytes':s.st_size,'encodedSHA256':hashlib.sha256(raw).hexdigest(),'sourceSHA256':r['sha256'],'gitBlobSHA1':r['blob'],'mode':s.st_mode,'uid':s.st_uid,'dev':s.st_dev,'ino':s.st_ino,'nlink':s.st_nlink})
 records.append({'checkpoint':n,'directory':str(directory),'files':rows,'bytes':sum(x['bytes']for x in rows),'canonicalSourceBytesVerified':True,'sourceAndArchivePreserved':True})
receipt={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'VERIFIED_DERIVED_UPLOAD_ENCODINGS_ONLY_CLEANUP','checkpoints':records,'totalFiles':sum(len(x['files'])for x in records),'totalBytes':sum(x['bytes']for x in records),'allFrozenSourcesRawArchivesPartsGitObjectsPreserved':True,'activeUploadCells':'NONE_COMPLETED_REMOTE_RECEIPTS_RETAINED','initialSchemaFailure':'Checkpoint38 metadata uses path not file; initialKeyError before any deletion, corrected exact field mapping'}
(Q/'root-completed-upload-encodings-38-39-cleanup.json').write_text(json.dumps(receipt,indent=2)+'\n')
for record in records:
 for row in record['files']:
  p=Path(row['path']);s=p.lstat();assert all(getattr(s,'st_'+k)==row[k]for k in ['mode','uid','dev','ino','nlink']);assert s.st_size==row['bytes']and hashlib.sha256(p.read_bytes()).hexdigest()==row['encodedSHA256'];p.unlink()
 Path(record['directory']).rmdir()
print(json.dumps({'status':receipt['status'],'filesRemoved':receipt['totalFiles'],'bytesReclaimed':receipt['totalBytes'],'sourceBytesPreserved':True}))
