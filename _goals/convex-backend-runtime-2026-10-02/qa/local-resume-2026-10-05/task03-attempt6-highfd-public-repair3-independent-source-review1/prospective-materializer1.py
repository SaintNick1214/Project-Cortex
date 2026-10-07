"""New distinct reviewer source publication from retained historical bytes only."""
import json,hashlib,time,os
from pathlib import Path
J=Path(REVIEW_DIR);created=[]
def new(name,b):
 p=J/name;fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  view=memoryview(b)
  while view:view=view[os.write(fd,view):]
  os.fsync(fd)
 finally:os.close(fd)
 created.append({'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
new('independent-contract-controls2.py',DATA[str(J/'independent-contract-controls1.py')])
new('independent-interpreter-controls2.py',DATA[str(J/'independent-interpreter-controls1.py')].replace(b'independent-interpreter-controls1.',b'independent-interpreter-controls2.'))
s=DATA[str(J/'u3_review_reader.py')].decode().replace('first-mature-u3-input-readback1.json','prospective-first-mature-u3-input-readback2.json').replace('reader-request-failure-','prospective-reader-request-failure-').replace('u3-reader-held-through-verdict-FDclosure.json','u3-prospective-held-through-verdict-FDclosure2.json').replace('u3-reader-writer-stop.json','u3-prospective-reader-writer-stop2.json')
new('u3_prospective_reader2.py',s.encode())
new('prospective-source-writer-stop2.json',json.dumps({'scope':'DISTINCT_NEW_REVIEW_SOURCE_STOP','stoppedUnixNs':time.time_ns(),'remainingWrites':[],'sources':created,'failedOldPinsRetainedNeverRefreshed':True,'noCustodyAcrossGap':True}).encode())
RESULT={'scope':'NEW_PROSPECTIVE_SOURCE_PUBLICATION_NOT_SOURCE_QUALIFICATION','sourceEligibility':False,'created':created,'oldControlsHistoricalBytesOnly':True,'oldFailedNineNotRefreshed':True,'candidateSourceEffect':0}
