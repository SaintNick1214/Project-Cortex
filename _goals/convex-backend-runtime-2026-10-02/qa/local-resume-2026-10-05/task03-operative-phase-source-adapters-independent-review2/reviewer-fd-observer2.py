"""Independent instrumentation, not a SourceSession implementation.

Every actual open/read/close is confined to declared reviewer-owned inputs.
The observer records ordering and can inject virtual stat or close outcomes;
it does not create authority, charge a ledger, or approve source adoption.
"""
import os
from pathlib import Path
import types

FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')

def nine(value):
    return {name:str(getattr(value,'st_'+name)) for name in FIELDS}

class Observer:
    O_RDONLY=os.O_RDONLY
    O_NOFOLLOW=os.O_NOFOLLOW
    def __init__(self, paths, *, close_failure_numbers=(), changed_stat=None):
        self.allowed={str(Path(p).absolute()) for p in paths}
        self.parent_dirs={str(parent) for p in paths for parent in Path(p).absolute().parents}
        self.fds={};self.events=[];self.close_numbers=0
        self.close_failure_numbers=set(close_failure_numbers)
        self.changed_stat=changed_stat
    def path(self,path):
        value=str(Path(path).absolute())
        if value not in self.allowed:
            self.events.append({'event':'UNDECLARED_PATH_ATTEMPT','path':value})
            raise AssertionError('REVIEWER_DISALLOWS_UNDECLARED_ACTUAL_IO')
        return value
    def lstat(self,path):
        path=str(Path(path).absolute())
        if path not in self.parent_dirs:path=self.path(path)
        self.events.append({'event':'LSTAT','path':path})
        return self.stat_result(os.lstat(path),'LSTAT',path)
    def stat_result(self,value,operation,path):
        if self.changed_stat is None:return value
        change=self.changed_stat(operation,path)
        if not change:return value
        names=set(dir(value));names.update('st_'+k for k in FIELDS)
        result={name:getattr(value,name) for name in names if name.startswith('st_')}
        result.update({'st_'+k:v for k,v in change.items()})
        return types.SimpleNamespace(**result)
    def open(self,path,flags,*args,**kwargs):
        path=self.path(path)
        if flags&(os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND):
            raise AssertionError('REVIEWER_ACTUAL_SOURCE_INPUT_READ_ONLY')
        self.events.append({'event':'OPEN_ATTEMPT','path':path,'flags':flags})
        fd=os.open(path,flags,*args,**kwargs)
        if fd in self.fds:raise AssertionError('FD_ALREADY_OWNED')
        self.fds[fd]=path;self.events.append({'event':'OPEN','path':path,'fd':fd})
        return fd
    def fstat(self,fd):
        path=self.fds[fd];self.events.append({'event':'FSTAT','path':path,'fd':fd})
        return self.stat_result(os.fstat(fd),'FSTAT',path)
    def read(self,fd,count):
        path=self.fds[fd];self.events.append({'event':'BODY_READ','path':path,'fd':fd,'count':count})
        return os.read(fd,count)
    def pread(self,fd,count,offset):
        path=self.fds[fd];self.events.append({'event':'BODY_PREAD','path':path,'fd':fd,'count':count,'offset':offset})
        return os.pread(fd,count,offset)
    def lseek(self,fd,offset,whence):
        path=self.fds[fd];self.events.append({'event':'SEEK','path':path,'fd':fd,'offset':offset,'whence':whence})
        return os.lseek(fd,offset,whence)
    def close(self,fd):
        if fd not in self.fds:raise AssertionError('FOREIGN_OR_SECOND_ACTUAL_CLOSE')
        path=self.fds.pop(fd);self.close_numbers+=1
        self.events.append({'event':'CLOSE','path':path,'fd':fd,'number':self.close_numbers})
        os.close(fd)
        # Real FD is closed; only the declared error outcome is simulated.
        if self.close_numbers in self.close_failure_numbers:
            raise OSError('INDEPENDENT_POST_ACTUAL_CLOSE_FAILURE_'+str(self.close_numbers))
    def no_leaks(self):
        if self.fds:raise AssertionError(('UNRELEASED_REVIEWER_FDS',self.fds))
    def emergency_close_owned(self):
        # This preserves a failed candidate close observation, rather than
        # changing its result to PASS. It never closes any foreign handle.
        remaining=list(self.fds)
        for fd in remaining:
            try:self.close(fd)
            except OSError:pass
        return remaining
    def ordinary_open_denied(self,*args,**kwargs):
        self.events.append({'event':'ORDINARY_OPEN_FALLBACK_ATTEMPT'})
        raise AssertionError('NO_ORDINARY_IO_FALLBACK')

def assert_group_open_before_body(events,paths):
    paths={str(Path(p).absolute()) for p in paths};opened=set()
    for event in events:
        if event['event']=='OPEN':opened.add(event['path'])
        if event['event'] in ('BODY_READ','BODY_PREAD') and event['path'] in paths:
            if not paths<=opened:raise AssertionError(('BODY_BEFORE_ALL_GROUP_FDS',paths-opened))
    if not paths<=opened:raise AssertionError(('GROUP_FDS_NOT_ALL_OPENED',paths-opened))

def assert_once_closes(events,paths):
    paths={str(Path(p).absolute()) for p in paths}
    for path in paths:
        opens=[x for x in events if x['event']=='OPEN' and x['path']==path]
        closes=[x for x in events if x['event']=='CLOSE' and x['path']==path]
        if len(opens)!=1 or len(closes)!=1 or opens[0]['fd']!=closes[0]['fd']:
            raise AssertionError(('ACTUAL_OPEN_CLOSE_COUNTS',path,len(opens),len(closes)))
