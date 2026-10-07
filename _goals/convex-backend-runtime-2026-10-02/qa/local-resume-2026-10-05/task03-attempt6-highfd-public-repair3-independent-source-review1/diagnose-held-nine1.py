"""Read-only metadata diagnosis, no pin refresh or candidate adoption."""
import os,json,time
from pathlib import Path
fields=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
def nine(s):return {k:str(getattr(s,'st_'+k)) for k in fields}
differences=[]
for owner in OWNERS:
 descriptor=nine(os.fstat(owner['fd']));path=nine(Path(owner['path']).lstat())
 if descriptor!=owner['PRE9'] or path!=owner['PRE9']:differences.append({'path':owner['path'],'original':dict(owner['PRE9']),'descriptor':descriptor,'currentPath':path})
RESULT={'scope':'REVIEWER_READONLY_ORIGINAL_NINE_DIAGNOSTIC','sourceEligibility':False,'owners':len(OWNERS),'differences':differences,'noPinRefresh':True,'unixNs':time.time_ns()}
