"""Actual owned public filesystem probes for the unreviewed selector helper."""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import os
import sys
from types import SimpleNamespace

P = Path(__file__).resolve().parent
OUT = Path(sys.argv[1]).resolve(); OUT.mkdir(mode=0o700, exist_ok=False)
source = P / 'task03-attempt5-retire-selector.py'
spec = importlib.util.spec_from_file_location('prospective_selector', source)
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
original_write = module.write_new
before = dict(operation='PUBLIC-DUMMY-ONLY', projectId=1234, deploymentName='public-dummy',
              requestSha256='public-request', active=True, retired=False, deleted=False)
raw = (json.dumps(before, indent=2) + '\n').encode()
after = {**before, 'active': False, 'retired': True, 'deleted': True,
         'retiredAt': 'PUBLIC-DUMMY', 'preRetirementReceiptSha256': hashlib.sha256(raw).hexdigest()}
rows = []

def run(label, expected=None, absent=False, mutate=None, hook=None):
    module.os = os; module.write_new = original_write
    root = OUT / label; root.mkdir(mode=0o700)
    target = root / 'target.json'
    if not absent: target.write_bytes(raw); target.chmod(0o600)
    value = {'before': copy.deepcopy(before), 'after': copy.deepcopy(after)}
    if mutate: mutate(root, value)
    if hook: hook(root)
    failure = None; outcome = None
    try: outcome = module.retire(root, value)
    except BaseException as error: failure = str(error)
    finally: module.os = os; module.write_new = original_write
    if expected is None: assert failure is None, failure
    else: assert failure and expected in failure, (expected, failure)
    row = dict(label=label, expected=expected or 'PASS', failure=failure, outcome=outcome,
               scope='ACTUAL_HOST_OWNED_PUBLIC_FILES_WITH_LABELED_INJECTION_SEAMS',
               members=sorted(os.listdir(root)))
    if label == 'replacement-inode-before-atomic-write':
        assert target.read_bytes() == b'owned fixture representing foreign replacement\n'
        row['foreignRoleReplacementUntouched'] = True
    if label == 'directory-replacement-after-owned-write':
        assert target.read_bytes() == b'owned fixture representing foreign root\n'
        row['foreignRoleReplacementUntouched'] = True
    (OUT / (label + '.outcome.json')).write_text(json.dumps(row, indent=2) + '\n')
    rows.append(row)

run('no-copied-target', absent=True)
run('copied-target-retired')
run('wrong-active-retirement', 'VERIFIED_RETIRED_SELECTOR', mutate=lambda root, value: value['after'].update(active=True))
run('changed-project', 'IMMUTABLE_SELECTOR_FIELD', mutate=lambda root, value: value['after'].update(projectId=5678))
run('boolean-project-alias', 'IMMUTABLE_SELECTOR_FIELD', mutate=lambda root, value: value['after'].update(projectId=True))
run('wrong-byte-preimage-hash', 'EXACT_MANAGEMENT_SELECTOR_PREIMAGE_HASH', mutate=lambda root, value: value['after'].update(preRetirementReceiptSha256='wrong'))
run('exclusive-preimage-already-present', 'EXCLUSIVE_SELECTOR', mutate=lambda root, value: (root/'target-before-physical-retirement.json').write_bytes(b'public previous attempt'))

def replace_target(root):
    def injected_write(fd, name, payload):
        original_write(fd, name, payload)
        if name == 'target-before-physical-retirement.json':
            replacement = root / 'owned-foreign-role'
            replacement.write_bytes(b'owned fixture representing foreign replacement\n'); replacement.chmod(0o600)
            os.replace(replacement, root/'target.json')
    module.write_new = injected_write
run('replacement-inode-before-atomic-write', 'SELECTOR_CHANGED_BEFORE_OWNED_REPLACEMENT', hook=replace_target)

def replace_directory(root):
    proxy = SimpleNamespace(**{name: getattr(os, name) for name in dir(os)})
    def replace(*args, **kwargs):
        os.replace(*args, **kwargs)
        root.rename(root.with_name(root.name + '-owned-preimage'))
        root.mkdir(mode=0o700); target = root/'target.json'
        target.write_bytes(b'owned fixture representing foreign root\n'); target.chmod(0o600)
    proxy.replace = replace; module.os = proxy
run('directory-replacement-after-owned-write', 'RETIRED_SELECTOR_FINAL_ROOT_CUSTODY', hook=replace_directory)

try: module.strict_json(b'{"before":{},"before":{}}')
except ValueError as error: assert str(error) == 'DUPLICATE_SELECTOR_JSON_KEY'
else: raise AssertionError('duplicate JSON accepted')
try: module.strict_json(b'X' * 65537)
except ValueError as error: assert str(error) == 'FINITE_SELECTOR_INPUT_REQUIRED'
else: raise AssertionError('input cap exceeded')
(OUT/'controls.json').write_text(json.dumps(dict(status='PASS', actualFilesystemChecks=len(rows),
    strictInputChecks=2, sourceBytes=source.stat().st_size, sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),
    rows=rows, platform=sys.platform, Linux=(sys.platform == 'linux'), privateBytes=False,
    services=False, nativeFoundationQualification=False, sourceApproved=False), indent=2)+'\n')
print(json.dumps(dict(status='PASS', actualFilesystemChecks=len(rows), strictInputChecks=2, sourceApproved=False)))
