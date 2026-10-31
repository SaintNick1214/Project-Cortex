"""Later source-only entry: exact reviewed effective environment before exec."""
import os
from pathlib import Path
import sys
from acquire_lib import read_json

ROOT = Path('/var/tmp/cortex-task04-c8-r3-phase')

if __name__ == '__main__':
    os.umask(0o077)
    if os.getuid() != 0 or sys.argv[1:] != ['all']:
        raise ValueError('FINITE_SOURCE_ONLY_ENTRY_REQUIRED')
    binding, _ = read_json(ROOT / 'tools/capture-effective-environment.json')
    if dict(os.environ) != binding['environment']:
        raise ValueError('ACTUAL_REVIEWED_EFFECTIVE_ENVIRONMENT_DRIFT')
    # The next program independently requires a signed/scoped source release,
    # identical runtime source pins, a live held owner and literal reserve.
    os.execv('/usr/local/bin/python3.12', ['/usr/local/bin/python3.12', '-B', str(ROOT / 'tools/materialize-cohort.py'), 'all'])
