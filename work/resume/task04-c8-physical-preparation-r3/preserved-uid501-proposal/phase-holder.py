"""Infrastructure-only retained phase owner; no subject or cohort effects."""
import os
import signal
import time
if os.getuid() != 501:
    raise ValueError('PHASE_OWNER_UID_REQUIRED')
for name in (signal.SIGTERM, signal.SIGINT):
    signal.signal(name, lambda *_: exit(0))
while True:
    time.sleep(30)
