"""One literal Docker file, streamed with finite tar/pipe/deadline/pidfd guards."""
import hashlib
import os
from pathlib import Path
import select
import signal
import subprocess
import tarfile
from bounded_process import BoundedFileStream
from tar_export import TrackedTarReader,finish_tar_record


def copy_file(cid,path,target,maximum,expected=None):
    if len(cid)!=64 or any(c not in '0123456789abcdef'for c in cid)or not path.startswith('/var/tmp/')or '..'in Path(path).parts or type(maximum)is not int or maximum<0 or maximum>536870912:
        raise ValueError('EXACT_FINITE_SINGLE_FILE_COPY')
    if target.exists()or target.is_symlink():raise ValueError('NEW_COPY_TARGET_ONLY')
    argv=['docker','cp',cid+':'+path,'-'];process=None;fd=None;stream=None;row={'argv':argv,'maximumBytes':maximum,'terminal':False,'signalEvents':[],'closeErrors':[]}
    try:
        # Actual syscall/return, not hasattr. Any failure prevents child creation.
        own=os.pidfd_open(os.getpid(),0)
        try:signal.pidfd_send_signal(own,0)
        finally:os.close(own)
        process=subprocess.Popen(argv,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        fd=os.pidfd_open(process.pid,0);poll=select.poll();poll.register(fd,select.POLLIN);signal.pidfd_send_signal(fd,0)
        stream=BoundedFileStream(process,maximum+20480,65536,timeout=60)
        seen=[];total=0;digest=hashlib.sha256()
        with tarfile.open(fileobj=stream,mode='r|')as archive:
            tracked=TrackedTarReader(archive.fileobj);archive.fileobj=tracked
            for member in archive:
                if member.name!=Path(path).name or not member.isfile()or member.linkname or seen or member.size>maximum:
                    raise ValueError('ONE_EXACT_LITERAL_REGULAR_TAR_MEMBER')
                seen.append(member.name)
                with archive.extractfile(member)as source,open(target,'xb')as out:
                    os.chmod(target,0o600)
                    while block:=source.read(65536):
                        total+=len(block)
                        if total>member.size or total>maximum:raise ValueError('STREAM_MEMBER_BYTE_BOUND')
                        out.write(block);digest.update(block)
                    if total!=member.size:raise ValueError('STREAM_MEMBER_EXACT_EOF')
                    out.flush();os.fsync(out.fileno())
            row['tarTermination']=finish_tar_record(archive,tracked)
        row.update(stream.finish());row['stderrHex']=row.pop('stderr',b'').hex();row['stdoutPrefixHex']=row.pop('stdoutPrefix',b'').hex()
        if not seen or process.returncode!=0 or not poll.poll(0)or row['stderrHex']:raise ValueError('ACTUAL_PIDFD_COPY_TERMINAL_ZERO')
        row.update(bytes=total,sha256=digest.hexdigest(),terminal=True,actualTerminalPoll=poll.poll(0))
        if expected is not None and(total,row['sha256'])!=(expected['bytes'],expected['sha256']):raise ValueError('COPIED_EXACT_CONTENT_PIN')
        return row
    except BaseException as error:
        row['failure']=repr(error)
        if stream is not None:
            partial=stream.partial();row.update({k:(v.hex()if isinstance(v,bytes)else v)for k,v in partial.items()})
        if process is not None and process.poll()is None:
            if fd is None:row['cleanupAuthority']='UNKNOWN_NATIVE_PIDFD_NO_NUMERIC_FALLBACK'
            else:
                try:
                    row['signalEvents'].append({'signal':'SIGTERM','return':signal.pidfd_send_signal(fd,signal.SIGTERM)})
                    try:process.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        row['signalEvents'].append({'signal':'SIGKILL','return':signal.pidfd_send_signal(fd,signal.SIGKILL)});process.wait(timeout=3)
                except BaseException as cleanup:row['cleanupError']=repr(cleanup)
        if process is not None:row.update(terminal=process.poll()is not None,exit=process.returncode)
        raise CopyFailure(row)from error
    finally:
        if stream is not None:row['closeErrors']+=stream.close()
        elif process is not None:
            for name in ('stdout','stderr'):
                try:getattr(process,name).close()
                except BaseException as error:row['closeErrors'].append(repr(error))
        if fd is not None:
            try:row['pidfdCloseReturn']=os.close(fd)
            except BaseException as error:row['closeErrors'].append(repr(error))
        if row['closeErrors']:raise CopyFailure({**row,'failure':'ACTUAL_NATIVE_CLOSE_FAILURE'})


class CopyFailure(RuntimeError):
    def __init__(self,receipt):super().__init__('BOUNDED_SINGLE_FILE_COPY_FAILURE');self.receipt=receipt
