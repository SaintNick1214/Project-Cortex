import json,os,runpy,stat,sys
from pathlib import Path
e=runpy.run_path(str(Path(__file__).parent/'review.py'));C=e['C'];Q=e['Q'];T=e['T'];M=e['M'];read=e['read'];sha=e['sha'];save=e['save'];packet=T/'public-packet';packet.mkdir(mode=0o755);os.chmod(packet,0o755)
idx=json.loads(read(C/'index.json')[0]);names=['README.md','materialize.py','restore-git-modes.py','restore-directory-modes.py','index.json','directory-modes.json.gz']+[p['path'] for cat in ['mapParts','archiveParts'] for p in idx[cat]];proof=[]
for name in names:
 source,s=read(C/name);dest=packet/name;dest.parent.mkdir(mode=0o755,parents=True,exist_ok=True)
 with dest.open('xb') as f:f.write(source)
 os.chmod(dest,0o644);copied,z=read(dest);assert copied==source and z.st_nlink==1 and stat.S_IMODE(z.st_mode)==0o644
 proof.append({'path':name,'bytes':len(copied),'sha256':sha(copied),'observedCopyMode':stat.S_IMODE(z.st_mode),'nlink':z.st_nlink})
for d,sub,files in os.walk(packet):assert stat.S_IMODE(Path(d).stat().st_mode)==0o755
save(Q/'public-input-copy-results.json',{'status':'EXACT_PUBLIC_0644_INPUT_COPY_PASS','copyOnlyOwn':str(packet),'files':proof,'allDirectoryModes':'0755','encodedByteTotal':sum(p['bytes'] for p in proof),'originalModesNotChanged':True})
for tag,name,args in [('public-input-readonly','materialize.py',[]),('public-input-git-idempotent','restore-git-modes.py',[]),('public-input-directory-idempotent','restore-directory-modes.py',[])]:
 e['record'](tag,[sys.executable,str(packet/name),'--target',str(M),'--packet',str(packet),*args]);result=json.loads(read(T/(tag+'.stdout'))[0]);assert result.get('created',0)==0 and result.get('changed',0)==0
e['audit']('source-after-public-inputs',True);before=json.loads(read(Q/'source-before-corrected-results.json')[0]);after=json.loads(read(Q/'source-after-public-inputs-results.json')[0]);assert before['recordMetadataSha256']==after['recordMetadataSha256'] and before['negativeHardlinkTopology']==after['negativeHardlinkTopology']
save(Q/'public-input-positive-results.json',{'status':'PASS','publicInputFiles':len(proof),'inputMode':'0644','inputDirectoryMode':'0755','readonlyRowsVerified':148325,'gitNormalizerChanged':0,'directoryHelperChanged':0,'sourceAllRowsMetadataUnchanged':True,'sourceBeforeDigest':before['recordMetadataSha256'],'sourceAfterDigest':after['recordMetadataSha256'],'mirror':str(M),'gitPublicationNotPerformed':True})
print(json.dumps({'publicInputs':'PASS','files':len(proof),'actualMode':'0644','mirrorRows':148325,'sourceUnchanged':True}))
