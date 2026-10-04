import os,runpy
from pathlib import Path
original=os.fdopen
triggered=False
def wrapped(fd,*args,**kwargs):
 global triggered
 h=original(fd,*args,**kwargs)
 if not triggered and os.readlink("/proc/self/fd/"+str(fd))=='/tmp/cortex-c2-backing-ancestry-c2-fresh-review/FD-path-replacement-leaf-objects.part-0000/objects.part-0000':
  triggered=True
  class Reader:
   def __enter__(self):h.__enter__();return self
   def __exit__(self,*args):return h.__exit__(*args)
   def fileno(self):return h.fileno()
   def read(self):
    data=h.read()
    p=Path('/tmp/cortex-c2-backing-ancestry-c2-fresh-review/FD-path-replacement-leaf-objects.part-0000/objects.part-0000');p.rename(p.with_name(p.name+".parked"));p.write_bytes(data)
    return data
  return Reader()
 return h
os.fdopen=wrapped
runpy.run_path('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-c2-component-byte-backing-c2/materialize.py',run_name="__main__")
