from common import *
import shutil
archive=loads((Q/'remote-archive-receipt.json').read_text());assert archive['bytes']==187583533 and archive['sha256']=='ae2ddf2bfd2886d018c37f5ee615ea9792b42871cb6dee39c0c0d0246c3e60f8' and archive['decodedObjects']==4224 and archive['decodedBytes']==363465548 and archive['fullGzipEOFCRCExactTarMembershipSHA256'] is True;assert not list((W/'spool').iterdir())
measurement=loads((Q/'measurement.json').read_text());sources=loads((Q/'sources.json').read_text());post={'utc':now(),'rows':0,'files':0,'bytes':0,'full9HeldFDPrePostHashAndLiteralMembership':True}
# Final actual source bytes, no historical source reads or candidate execution.
with gzip.open(T/'source-map.jsonl.gz','rb') as f:
 for line in f:
  row=loads(line);p=Path(row['literalPath']);s=p.lstat();assert ident(s)==row['identity'];post['rows']+=1
  if row['kind']=='file':a=hashfile(p,row['sha256']);assert a['identity']==row['identity'] and a['bytes']==row['bytes'];post['files']+=1;post['bytes']+=row['bytes']
  elif row['kind']=='directory':assert stat.S_ISDIR(s.st_mode) and sorted(os.listdir(p))==row['members']
  elif row['kind']=='symlink':assert stat.S_ISLNK(s.st_mode) and os.readlink(p)==row['literalTarget'] and hashlib.sha256(os.fsencode(row['literalTarget'])).hexdigest()==row['literalTargetSHA256']
  assert ident(s)==ident(p.lstat())
for s in sources:
 root=Path(s['root']);assert ident(root.lstat())==s['rootIdentity'] and sorted(os.listdir(root))==s['rootMembers'];assert hashfile(Path(s['seal']['path']),s['seal']['sha256'])['identity']==s['seal']['identity']
assert post['rows']==9590 and post['files']==9395 and post['bytes']==956563182;dump(Q/'source-post-remote-check.json',post)
locators=Path('/dev/shm/cortex-root-c6-frozen-content-backing/authenticated-prior-locators.json');locatorProof=hashfile(locators);locatorData=loads(locators.read_text())
# Preserve literal immutable locator metadata and earlier finite gaps, never repair mutable historical paths.
with gzip.GzipFile(filename='',fileobj=(T/'prior-locators.json.gz').open('xb'),mode='wb',mtime=0,compresslevel=3) as out:
 f,s=held(locators)
 with f:
  for b in iter(lambda:f.read(65536),b''):out.write(b)
  assert ident(s)==ident(os.fstat(f.fileno()))==ident(locators.lstat())
conn=sqlite3.connect('file:'+str(W/'metadata.sqlite')+'?mode=ro',uri=True);conn.execute('PRAGMA cache_size=-2048');conn.execute('PRAGMA mmap_size=0');seen=set();objects=[];h=hashlib.sha256();n=0
recoveryProof=hashfile(B/'task04-c7-first-part-binary-read-failure-ascii-recovery.json')
header={'remoteEncodingRecoveryProof':recoveryProof,'schema':'C7_PARTIAL_AUTHENTICATED_LOSSLESS_CONTENT_TRANSPORT_V1','scope':'CONTENT_ONLY_NOT_RUNTIME_OR_PHYSICAL_IDENTITY_RESTORATION','sources':sources,'sourcePOST':post,'baselineAuthentication':loads((Q/'baseline-authentication.json').read_text()),'priorLocatorProof':locatorProof,'archive':archive,'historicalGaps':{'c6FrozenRows':68,'c6FrozenUniqueHashes':67,'c6ReviewRows':1,'c6ReviewUniqueHashes':1,'unchanged':True,'noMutableHistoricalSourceRead':True},'original122':'HELD','whole120':'UNQUALIFIED','actualApproval':'ABSENT','rootApprovalCreated':False}
with (T/'final-index.json.gz').open('xb') as encoded,gzip.GzipFile(filename='',fileobj=encoded,mode='wb',mtime=0,compresslevel=3) as out:
 def emit(b):out.write(b);h.update(b);globals()['n']+=len(b)
 emit(json.dumps(header,separators=(',',':')).encode()[:-1]+b',"sourceRows":[')
 with gzip.open(T/'source-map.jsonl.gz','rb') as f:
  for i,line in enumerate(f):
   row=loads(line)
   if row['kind']=='file':
    if row['backing']=='NEW_UNALLOCATED':row['backing']='task04-c7-partial-content-backing';row['availability']='REMOTE_IMMUTABLE_ARCHIVE_CONTENT'
    else:row['availability']='AUTHENTICATED_PRIOR_CONTENT'
    if row['sha256'] not in seen:seen.add(row['sha256']);objects.append((row['sha256'],row['bytes'],row['backing']))
   emit((b',' if i else b'')+json.dumps(row,separators=(',',':')).encode())
 emit(b'],"objects":[')
 for i,(sha,size,backing) in enumerate(sorted(objects)):emit((b',' if i else b'')+json.dumps({'sha256':sha,'bytes':size,'backing':backing},separators=(',',':')).encode())
 emit(b']}\n')
conn.close();decodedSHA=h.hexdigest();decodedBytes=n;h=hashlib.sha256();n=0
with gzip.open(T/'final-index.json.gz','rb') as f:
 for b in iter(lambda:f.read(65536),b''):h.update(b);n+=len(b)
assert n==decodedBytes and h.hexdigest()==decodedSHA;encodedProof=hashfile(T/'final-index.json.gz')
receipt={'schema':'C7_PARTIAL_AUTHENTICATED_CONTENT_TRANSPORT_RECEIPT_V1','status':'LOSSLESS_CONTENT_TRANSPORT_COMPLETE_ROOT_INDEPENDENT_INSPECTION_REQUIRED','utc':now(),'sourceRoots':3,'sourceRowsIncludingSourceSeals':9590,'files':9395,'fileBytes':956563182,'literalDirectories':188,'literalSymlinks':7,'uniqueContentObjects':len(objects),'reusedUniqueObjects':len(objects)-4224,'deltaUniqueObjects':4224,'deltaRawBytes':363465548,'archiveBytes':archive['bytes'],'archiveSHA256':archive['sha256'],'remoteParts':len(archive['parts']),'partLimit':5242879,'wholeArchiveAllocated':False,'eachRemotePartRootImmutableFullContentCompared':True,'streamSelfReadbackGzipEOFCRCAndExactTarMemberSHA256':True,'index':{'decodedBytes':decodedBytes,'decodedSHA256':decodedSHA,'encoded':encodedProof,'fullGzipEOFCRCDecodedHashVerified':True},'priorLocators':{'sourceProof':locatorProof,'transport':hashfile(T/'prior-locators.json.gz')},'sourcePOST':post,'historicalGapsUnchanged':True,'sourceOrHistoricalIdentityRepaired':False,'candidateNodeOrHeldPhasesExecuted':False,'remoteStorageEncoding':'BASE64_ASCII_LOSSLESS','binaryFetchAdapterClaim':'FAILED_UTF8_DECODE_NOT_VERIFIED_BINARY','duplicateContentFileAliasRows':1597,'original122':'HELD','whole120':'UNQUALIFIED','actualApproval':'ABSENT','scope':header['scope']};assert receipt['uniqueContentObjects']==7798;dump(Q/'final-receipt.json',receipt)
mapping={str((Q/name).relative_to(R)):str(T/name) for name in ['final-index.json.gz','source-map.jsonl.gz','prior-locators.json.gz']};dump(W/'final-virtual-source-mapping.json',mapping)
remote={p['repositoryPath']:{'repository':p['remoteRepository'],'storedRepositoryPath':p['remoteStorage']['storedRepositoryPath'],'storageEncoding':'BASE64_ASCII_LOSSLESS','storedGitBlobSHA':p['remoteImmutableGitBlob'],'storedBytes':p['remoteStorage']['storedBytes'],'storedSHA256':p['remoteStorage']['storedSHA256'],'decodedBytes':p['bytes'],'decodedSHA256':p['sha256'],'decodedGitBlobSHA':p['gitBlobSHA']} for p in archive['parts']};dump(W/'remote-blob-routing.json',remote)
report='''# C7 PARTIAL lossless content transport\n\nFrozen current contents from three C7 subject roots are preserved through authenticated content-address reuse and immutable remote Git blobs holding lossless base64 ASCII. This is content transport only: it does not restore physical filesystem identity, historical custody, runtime qualification, or acceptance. Original 122 remains HELD; whole 120 remains UNQUALIFIED; actual approval is ABSENT.\n\nThe source map covers 9,590 rows including three excluded source self-seals: 9,395 files totaling 956,563,182 bytes, 188 directories and seven literal symlinks. Membership, all nine decimal identity fields, held-FD full SHA-256 reads and PRE/POST identities were checked. The 7,798 distinct content objects comprise 3,574 authenticated reused objects and 4,224 new objects totaling 363,465,548 decoded bytes. Fresh C6 archive/index verification preserved original SHA/byte/backing records; prior finite historical gaps remain unchanged (frozen: 68 rows/67 hashes; review: one row/hash). No mutable historical source was read to fill a gap.\n\nThe exact new gzip/tar archive is 187,583,533 bytes, SHA-256 ae2ddf2bfd2886d018c37f5ee615ea9792b42871cb6dee39c0c0d0246c3e60f8. Whole allocation failed the recorded resource gate. ROOT authorized serialized spooling of one <=5,242,879-byte part. Each part retains its observed local full-nine identity and SHA-256/Git blob hash, plus ROOT's immutable remote upload/fetch exact-base64-text comparison acknowledgment (decoded equality follows from the bijection; the binary fetch adapter failed UTF-8 decoding and was not treated as successful). Only the owned unfrozen spool was deleted after verification; original source bytes and historical packets were preserved. Generated gzip bytes were simultaneously decoded with EOF/CRC and exact tar member SHA/byte verification. The completed archive matched the preallocation counting-stream SHA/size exactly.\n\nThe final compressed index provides decoded SHA/byte count, full-nine source lineage, literal directory/link rows, file byte/content/backing map and immutable remote routing. ROOT must independently inspect the final packet and publish its own checkpoint. Initial blocked measurements/maps remain as earlier observations. No candidate Node or held phase ran, no Git branch changed here, and no approval, native/private/paid/production/release operation occurred.\n'''
(Q/'report.md').write_text(report);print(json.dumps(receipt,separators=(',',':')),flush=True)
