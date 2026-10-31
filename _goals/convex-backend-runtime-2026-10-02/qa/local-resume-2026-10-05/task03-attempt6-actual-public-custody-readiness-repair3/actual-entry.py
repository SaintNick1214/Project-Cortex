"""Root compiles these held verified entry bytes; source preparation gives no effects."""
import hashlib,json,os,stat,sys,time
from pathlib import Path
FIELDS=('dev','ino','mode','nlink','uid','gid','size','mtime_ns','ctime_ns')
def nine(s):return {k:str(getattr(s,'st_'+k))for k in FIELDS}
def main():
    owned=[];primary=None;cleanup=[];scope=None
    try:
        assert sys.dont_write_bytecode and len(sys.argv)==4
        p=Path(sys.argv[1]);expected=json.loads(sys.argv[2]);handoff=sys.argv[3]
        assert p.is_absolute()and p.resolve()==p
        pre=p.lstat();assert stat.S_ISREG(pre.st_mode)and pre.st_nlink==1 and pre.st_uid==501 and pre.st_gid==20
        assert max(pre.st_mtime_ns,pre.st_ctime_ns)+60000000000<=time.time_ns()
        fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
        owner={'fd':fd,'path':p,'closeAttempted':False};owned.append(owner)
        owner['PRE9']=nine(pre)
        assert nine(pre)==nine(os.fstat(fd))==expected['PRE9']
        raw=bytearray()
        while block:=os.read(fd,65536):raw.extend(block);assert len(raw)<=expected['bytes']<=16777216
        assert len(raw)==expected['bytes']and hashlib.sha256(raw).hexdigest()==expected['sha256']
        assert nine(os.fstat(fd))==nine(p.lstat())==expected['PRE9']
        sys.argv=[str(p),handoff];scope={'__name__':'__main__','__file__':str(p),'__package__':None}
        exec(compile(raw,str(p),'exec',dont_inherit=True),scope)
    except BaseException as error:primary=error
    finally:
        for owner in owned:
            try:assert nine(os.fstat(owner['fd']))==nine(owner['path'].lstat())==owner.get('PRE9')
            except BaseException as error:cleanup.append(error)
        for owner in owned:
            if owner['closeAttempted']:continue
            owner['closeAttempted']=True
            try:os.close(owner['fd'])
            except BaseException as error:cleanup.append(error)
    # A runner's ordinary zero exit stays successful only if entry final checks/close succeed.
    if isinstance(primary,SystemExit)and primary.code in(None,0)and not cleanup:return 0
    if primary is not None or cleanup:
        chain=([primary]if primary is not None else[])+cleanup
        raise BaseExceptionGroup('Root entry sticky primary/final-nine/owned-close failure chain',chain)
    return 0
if __name__=='__main__':raise SystemExit(main())
