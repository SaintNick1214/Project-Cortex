"""New host transport seal, not Linux runtime identity or historical pin repair."""
import hashlib
import json
import os
from pathlib import Path
import stat

REPO=Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
W=REPO/'work/resume/task04-c8-physical-preparation-r3'
Q=REPO/'_goals/convex-backend-runtime-2026-10-02/qa/task04-c8-physical-preparation-r3'
TARGET=Q/'native-ci-proposal-packet-manifest.json'
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def identity(s): return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(s,'st_'+k)) for k in FIELDS}}

def main():
    if TARGET.exists(): raise ValueError('DISTINCT_PROPOSAL_SEAL_NO_REFRESH')
    files=[]; dirs=[]; held=[]; primary=None
    with open(TARGET,'xb+') as seal:
        os.chmod(TARGET,0o600)
        try:
            for root in (W,Q):
                for directory,subdirs,names in os.walk(root,followlinks=False):
                    path=Path(directory)
                    if any((path/n).is_symlink() for n in subdirs+names): raise ValueError('UNEXPECTED_HOST_PROPOSAL_ALIAS_HOLD')
                    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
                    before=identity(os.fstat(fd)); members=sorted(os.listdir(fd)); after=identity(os.fstat(fd))
                    if before!=after or after!=identity(os.lstat(path)): raise ValueError('HOST_DIRECTORY_HELD_NINE_DRIFT')
                    dirs.append({'path':str(path.relative_to(REPO)),'PRE':before,'POST':after,'members':members}); held.append(('directory',fd,dirs[-1]))
                    for name in sorted(names):
                        source=path/name
                        if source==TARGET: continue
                        fd=os.open(source,os.O_RDONLY|os.O_NOFOLLOW); st=os.fstat(fd)
                        if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1: raise ValueError('REGULAR_PROPOSAL_SOURCE_REQUIRED')
                        before=identity(st); digest=hashlib.sha256(); size=0
                        while block:=os.read(fd,1048576): digest.update(block); size+=len(block)
                        after=identity(os.fstat(fd)); post=identity(os.lstat(source))
                        if before!=after or after!=post or size!=st.st_size: raise ValueError('HOST_PROPOSAL_FULL_EOF_NINE_DRIFT')
                        files.append({'path':str(source.relative_to(REPO)),'bytes':size,'sha256':digest.hexdigest(),'PRE':before,'POST':after,'pathPOST':post,'EOF':True}); held.append(('file',fd,files[-1]))
            for kind,fd,row in held:
                source=REPO/row['path']
                if identity(os.fstat(fd))!=row['PRE'] or identity(os.lstat(source))!=row['PRE']: raise ValueError('FINAL_PROPOSAL_HELD_NINE')
                if kind=='directory':
                    if sorted(os.listdir(fd))!=row['members']: raise ValueError('FINAL_PROPOSAL_DIRECTORY_MEMBERSHIP')
                else:
                    os.lseek(fd,0,0); digest=hashlib.sha256(); size=0
                    while block:=os.read(fd,1048576): digest.update(block); size+=len(block)
                    if size!=row['bytes'] or digest.hexdigest()!=row['sha256'] or identity(os.fstat(fd))!=row['PRE']: raise ValueError('FINAL_PROPOSAL_FULL_BYTES_EOF')
            result={'scope':'NEW_HOST_SOURCE_PROPOSAL_TRANSPORT_OBSERVATIONS_NOT_LINUX_RUNTIME_BINDING_NOT_HISTORICAL_CUSTODY','status':'READY_FOR_FRESH_INDEPENDENT_SOURCE_REVIEW','files':files,'directories':dirs,'selfExcluded':str(TARGET.relative_to(REPO)),'originalFrozenPackets':'UNCHANGED; current host observations do not replace any prior pin','workflowActualTarget':'.github/workflows/task04-c8-native-infrastructure.yml','workflowActivated':False,'subjectsExecuted':False,'cohortsMaterialized':False,'ROOT':'ABSENT','futureEffects':'ONLY AFTER INDEPENDENT SOURCE REVIEW AND ROOT RELEASE','failedReceipts':'PRESERVED_WITHOUT_REFRESH'}
        finally:
            errors=[]
            for kind,fd,row in held:
                try: os.close(fd)
                except OSError as error: errors.append({'path':row['path'],'error':str(error)})
            if errors: raise ValueError('HOST_PROPOSAL_FD_CLOSE_FAILURE:'+repr(errors))
        raw=(json.dumps(result,indent=2)+'\n').encode(); seal.write(raw); seal.flush(); os.fsync(seal.fileno())
        before=identity(os.fstat(seal.fileno())); seal.seek(0); reread=seal.read(); after=identity(os.fstat(seal.fileno()))
        if reread!=raw or before!=after or after!=identity(os.lstat(TARGET)): raise ValueError('FINAL_NEW_SEAL_FULL_BYTES_NINE')
        print(json.dumps({'path':str(TARGET),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'files':len(files),'directories':len(dirs),'PRE':before,'POST':after,'pathPOST':identity(os.lstat(TARGET))}))

if __name__=='__main__': main()
