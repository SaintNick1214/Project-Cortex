"""Borrow the already owned source handle; compile only its verified bytes."""
import hashlib
import json
import os
import sys
import types

fields = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def nine(value): return {k:str(getattr(value,'st_'+k)) for k in fields}

if len(sys.argv) != 5:
    raise ValueError('EXACT_ANCHOR_SOURCE_ARGV')
source_fd = int(sys.argv[1]); row = json.loads(sys.argv[2]); error = None; raw = None
try:
    if nine(os.fstat(source_fd)) != row['PRE9'] or nine(os.lstat(row['path'])) != row['PRE9']:
        raise ValueError('ANCHOR_HELD_SOURCE_NINE')
    parts = []; offset = 0; h = hashlib.sha256()
    while True:
        chunk = os.pread(source_fd,65536,offset)
        if not chunk: break
        offset += len(chunk)
        if offset > row['bytes'] or offset > 16777216:
            raise ValueError('ANCHOR_SOURCE_SIZE_CAP')
        h.update(chunk); parts.append(chunk)
    if offset != row['bytes'] or h.hexdigest() != row['sha256']:
        raise ValueError('ANCHOR_FULL_EOF_HASH')
    if nine(os.fstat(source_fd)) != row['PRE9'] or nine(os.lstat(row['path'])) != row['PRE9']:
        raise ValueError('ANCHOR_SOURCE_FINAL_NINE')
    raw = b''.join(parts)
except BaseException as failure:
    error = failure
try:
    os.close(source_fd)  # child-owned borrowed handle once, never parent handle
except BaseException as close:
    raise RuntimeError('ANCHOR_SOURCE_FAILURES '+repr([error,close])) from error
if error: raise error
module = types.ModuleType('held_owned_anchor')
module.__file__ = row['path']
exec(compile(raw,row['path'],'exec',dont_inherit=True),module.__dict__)
try:
    module.anchor_main(int(sys.argv[3]),json.loads(sys.argv[4]))
except BaseException as failure:
    reason = str(failure) if isinstance(failure,module.OwnedGroupUnknown) else type(failure).__name__
    os.write(int(sys.argv[3]),(json.dumps({'event':'anchor-failure','reason':reason})+'\n').encode())
    os._exit(1)
os._exit(0)
