"""Finite final review fences. No Docker, process, network, or Git effects."""
import hashlib
import json
import os
from pathlib import Path
import resource
import stat

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
OUTPUTS = {'report.md','verdict.json','raw-current-manifest.json','final-current-closure.json',
           'writer-stop.json','final-output-readback.json'}


def identity(s):
    return {k:str(getattr(s,'st_'+k)) for k in FIELDS}


def digest(fd, cap=16777216):
    os.lseek(fd,0,os.SEEK_SET)
    h=hashlib.sha256();size=0
    while block:=os.read(fd,65536):
        size+=len(block)
        if size>cap:raise ValueError('FINITE_REVIEW_INPUT_CAP')
        h.update(block)
    return h.hexdigest(),size


def publish(name,value):
    raw=(json.dumps(value,indent=2,sort_keys=True)+'\n').encode()
    fd=os.open(HERE/name,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    try:
        at=0
        while at<len(raw):
            n=os.write(fd,raw[at:])
            if n<=0:raise OSError('REVIEW_WRITE_RETURN')
            at+=n
        os.fsync(fd)
    finally:os.close(fd)
    return {'sha256':hashlib.sha256(raw).hexdigest(),'size':len(raw)}


def main():
    external={}
    for cohort in ['bootstrap-metadata-first-current-fence.json',
                   'first-prospective-current-source1/fence.json',
                   'first-prospective-closed-metadata1/fence.json',
                   'first-prospective-public-evidence1/fence.json',
                   'first-prospective-original-conservation2/fence.json']:
        value=json.loads((HERE/cohort).read_text())
        if value['status']!='PASS':raise ValueError('PRIOR_REVIEW_COHORT_NOT_PASS')
        for row in value['files']:
            pin={'path':row['path'],'sha256':row['sha256'],'size':row['size'],'identity':row['PRE']}
            if pin['path'] in external and external[pin['path']]!=pin:raise ValueError('CONFLICTING_PRIOR_REVIEW_PIN')
            external[pin['path']]=pin
    own=sorted(p for p in HERE.rglob('*') if p.is_file() and p.relative_to(HERE).as_posix() not in OUTPUTS)
    needed=len(external)+len(own)+32
    soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
    if soft<needed:resource.setrlimit(resource.RLIMIT_NOFILE,(min(hard,needed+32),hard))
    held=[];source=[];raw=[];errors=[]
    try:
        # Every PRE/open precedes any qualifying source read in this final cohort.
        for name,e in sorted(external.items()):
            p=ROOT/name;fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);pre=identity(os.fstat(fd))
            row={'path':name,'PRE':pre,'OPEN_PATH':identity(os.lstat(p)),'expected':e}
            source.append(row);held.append((fd,p,row,True))
        for p in own:
            fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);pre=identity(os.fstat(fd))
            row={'path':p.relative_to(HERE).as_posix(),'PRE':pre,'OPEN_PATH':identity(os.lstat(p))}
            raw.append(row);held.append((fd,p,row,False))
        for fd,p,row,original in held:
            h,n=digest(fd);row.update(sha256=h,size=n,fullEOF=True,POST=identity(os.fstat(fd)),PATH_POST=identity(os.lstat(p)))
            if not stat.S_ISREG(int(row['PRE']['mode'])) or row['PRE']['nlink']!='1':errors.append({'path':row['path'],'kind':'not-single-link-regular'})
            if any(row[k]!=row['PRE'] for k in ['OPEN_PATH','POST','PATH_POST']):errors.append({'path':row['path'],'kind':'during-read-nine-difference'})
            if original:
                e=row['expected']
                if row['PRE']!=e['identity'] or(h,n)!=(e['sha256'],e['size']):errors.append({'path':row['path'],'kind':'original-current-pin-difference'})
        # FDs remain held through raw-manifest publication; final outputs are excluded.
        for fd,p,row,_ in held:
            row.update(FINAL_HELD=identity(os.fstat(fd)),FINAL_PATH=identity(os.lstat(p)))
            if row['FINAL_HELD']!=row['PRE'] or row['FINAL_PATH']!=row['PRE']:errors.append({'path':row['path'],'kind':'final-nine-difference'})
        raw_pin=publish('raw-current-manifest.json',{'scope':'REVIEWER_FIRST_CURRENT_FINITE_RAW_REGULAR_FILES_ONLY',
            'files':raw,'fileCount':len(raw),'selfExcludedFinalOutputs':sorted(OUTPUTS),
            'historicalPinsInvented':False,'failedPinsRefreshed':False,
            'status':'PASS' if not errors else 'FAIL'})
        for fd,p,row,_ in held:
            row['AFTER_RAW_MANIFEST_HELD']=identity(os.fstat(fd));row['AFTER_RAW_MANIFEST_PATH']=identity(os.lstat(p))
            if row['AFTER_RAW_MANIFEST_HELD']!=row['PRE'] or row['AFTER_RAW_MANIFEST_PATH']!=row['PRE']:errors.append({'path':row['path'],'kind':'after-raw-manifest-nine-difference'})
        close_returns=[]
        for fd,p,row,_ in held:
            returned=os.close(fd);close_returns.append({'path':row['path'],'return':returned})
        held=[]
        closure_pin=publish('final-current-closure.json',{'scope':'INDEPENDENT_REJECT_FINAL_CURRENT_REGULAR_SOURCE_AND_RAW_ONLY',
            'status':'PASS_CURRENT_FENCES_ONLY'if not errors else 'FAIL_CURRENT_FENCES',
            'externalFiles':source,'externalFileCount':len(source),'rawFileCount':len(raw),
            'rawManifest':raw_pin,'closeReturns':close_returns,'errors':errors,
            'sourceEligibility':'REJECT','runtimeAuthority':False,'enclosingHostPhysicalAuthorityAdopted':False,
            'historicalCustodyRepaired':False,'fullGoalAccepted':False})
        stop_pin=publish('writer-stop.json',{'scope':'INDEPENDENT_SOURCE_REVIEW_CLOSED_REJECT_ONLY',
            'allWritersStoppedAfterThisReceipt':True,'remainingWrites':[],
            'verdict':'REJECT','score':2.6,'rawManifest':raw_pin,'finalCurrentClosure':closure_pin,
            'reviewSourceCurrentFenceErrors':len(errors),'runtimeAuthority':False,'sourceEligibility':False,
            'permittedNextStep':'Separate source repair and fresh independent review only'})
        print(json.dumps({'externalFiles':len(source),'rawFiles':len(raw),'errors':errors,
                          'rawManifest':raw_pin,'closure':closure_pin,'writerStop':stop_pin}))
        return 0 if not errors else 1
    finally:
        for fd,_,_,_ in held:
            try:os.close(fd)
            except OSError:pass


if __name__=='__main__':raise SystemExit(main())
