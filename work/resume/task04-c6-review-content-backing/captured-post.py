from pack import *
rows=json.loads((T/'captured-preimage-resolutions.json').read_text());n=0
for r in rows:
 h,s,_=read(r['currentReadSource']);assert h==r['encodedSHA256'] and s.st_size==r['encodedBytes'] and ident(s)==r['currentIdentity'];n+=s.st_size
dump(Q/'captured-encoded-post-check.json',{'utc':now(),'allCapturedEncodedSourcesFullHeldFDHashNineIdentity':True,'objects':len(rows),'bytesActuallyStreamed':n,'scope':'CURRENT_CONTENT_ONLY_NOT_OLD_CUSTODY'})
print('captured encoded streams '+str(len(rows))+' bytes '+str(n),flush=True)
