"""Disposable infrastructure holder; cannot dispatch subjects or materialize cohorts."""
import os
from pathlib import Path
import signal
import time

if os.getuid()!=0 or os.environ.get('HOME')!='/phase/home' or os.environ.get('TMPDIR')!='/tmp':
    raise ValueError('EXPLICIT_SOURCE_ONLY_OWNER_ENVIRONMENT')
for path in (Path('/phase'),Path('/phase/home'),Path('/tmp')):
    path.mkdir(mode=0o700,exist_ok=True)
    os.chmod(path,0o700)
running=True
def stop(_signal,_frame):
    global running
    running=False
signal.signal(signal.SIGTERM,stop)
signal.signal(signal.SIGINT,stop)
while running: time.sleep(1)
