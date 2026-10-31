"""Retire an owned copied selector after independently verified project deletion."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

FIELDS = ('dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtime_ns', 'ctime_ns')
MAX_BYTES = 65536

def identity(value):
    return {field: str(getattr(value, 'st_' + field)) for field in FIELDS}

def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result: raise ValueError('DUPLICATE_SELECTOR_JSON_KEY')
            result[key] = value
        return result
    if not raw or len(raw) > MAX_BYTES: raise ValueError('FINITE_SELECTOR_INPUT_REQUIRED')
    return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs)

def owned_file(value):
    if not (stat.S_ISREG(value.st_mode) and value.st_nlink == 1 and
            value.st_uid == os.getuid() and value.st_gid == os.getgid() and
            stat.S_IMODE(value.st_mode) == 0o600):
        raise ValueError('OWNED_SINGLE_LINK_PRIVATE_SELECTOR_REQUIRED')

def write_new(directory_fd, name, raw):
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory_fd)
    try:
        offset = 0
        while offset < len(raw):
            count = os.write(fd, raw[offset:])
            if count <= 0: raise ValueError('SELECTOR_WRITE_PROGRESS_REQUIRED')
            offset += count
        os.fsync(fd)
    finally: os.close(fd)

def retire(root, value):
    if set(value) != {'before', 'after'} or not all(type(value[k]) is dict for k in value):
        raise ValueError('EXACT_SELECTOR_RETIREMENT_INPUT_REQUIRED')
    before, after = value['before'], value['after']
    if before.get('active') is not True or before.get('retired') is not False or before.get('deleted') is not False:
        raise ValueError('EXACT_ACTIVE_SELECTOR_PREIMAGE_REQUIRED')
    if after.get('active') is not False or after.get('retired') is not True or after.get('deleted') is not True:
        raise ValueError('VERIFIED_RETIRED_SELECTOR_REQUIRED')
    for key, item in before.items():
        if key not in ('active', 'retired', 'deleted') and json.dumps(after.get(key), sort_keys=True) != json.dumps(item, sort_keys=True):
            raise ValueError('IMMUTABLE_SELECTOR_FIELD_CHANGED')
    if not isinstance(before.get('operation'), str) or not before['operation']:
        raise ValueError('EXACT_SELECTOR_OPERATION_REQUIRED')
    root = Path(root)
    if root.resolve(strict=True) != root: raise ValueError('CANONICAL_OWNED_PRIVATE_ROOT_REQUIRED')
    directory_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    target_fd = None
    try:
        initial = os.fstat(directory_fd)
        if not (initial.st_uid == os.getuid() and initial.st_gid == os.getgid() and stat.S_IMODE(initial.st_mode) == 0o700):
            raise ValueError('OWNED_PRIVATE_ROOT_REQUIRED')
        root_pre = identity(initial); members = sorted(os.listdir(directory_fd))
        if root_pre != identity(os.lstat(root)): raise ValueError('PRIVATE_ROOT_IDENTITY_DRIFT')
        try: target_fd = os.open('target.json', os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory_fd)
        except FileNotFoundError:
            if 'target.json' in members: raise ValueError('SELECTOR_DISAPPEARED_DURING_BASELINE')
            if root_pre != identity(os.fstat(directory_fd)) or root_pre != identity(os.lstat(root)) or members != sorted(os.listdir(directory_fd)):
                raise ValueError('ABSENT_SELECTOR_ROOT_ALL_NINE_DRIFT')
            return dict(status='PASS', targetAbsent=True, activeCopiedSelectorPresent=False,
                        rootPRE=root_pre, rootPOST=root_pre, members=members, copiedSelectorMutated=False,
                        historicalCustodyRepaired=False)
        initial_target = os.fstat(target_fd); owned_file(initial_target); target_pre = identity(initial_target)
        raw = bytearray()
        while block := os.read(target_fd, 4096):
            raw.extend(block)
            if len(raw) > MAX_BYTES: raise ValueError('FINITE_SELECTOR_BYTES_REQUIRED')
        raw = bytes(raw)
        if json.dumps(strict_json(raw), sort_keys=True) != json.dumps(before, sort_keys=True) or target_pre != identity(os.fstat(target_fd)) or target_pre != identity(os.stat('target.json', dir_fd=directory_fd, follow_symlinks=False)):
            raise ValueError('COPIED_SELECTOR_FULL_BYTES_ALL_NINE_MISMATCH')
        if after.get('preRetirementReceiptSha256') != hashlib.sha256(raw).hexdigest():
            raise ValueError('EXACT_MANAGEMENT_SELECTOR_PREIMAGE_HASH_REQUIRED')
        names = ('target-before-physical-retirement.json', 'target-retired-replacement.json')
        if any(name in members for name in names): raise ValueError('EXCLUSIVE_SELECTOR_RETIREMENT_OUTPUT_EXISTS')
        write_new(directory_fd, names[0], raw)
        replacement = (json.dumps(after, indent=2) + '\n').encode()
        if len(replacement) > MAX_BYTES: raise ValueError('FINITE_RETIRED_SELECTOR_BYTES_REQUIRED')
        write_new(directory_fd, names[1], replacement)
        current = os.fstat(directory_fd)
        if any(getattr(current, 'st_' + k) != getattr(initial, 'st_' + k) for k in ('dev','ino','mode','uid','gid')) or identity(current) != identity(os.lstat(root)):
            raise ValueError('OWNED_RETIREMENT_ROOT_REPLACED')
        if sorted(os.listdir(directory_fd)) != sorted(members + list(names)):
            raise ValueError('UNTRACKED_SELECTOR_DIRECTORY_MUTATION')
        if target_pre != identity(os.fstat(target_fd)) or target_pre != identity(os.stat('target.json', dir_fd=directory_fd, follow_symlinks=False)):
            raise ValueError('SELECTOR_CHANGED_BEFORE_OWNED_REPLACEMENT')
        os.replace(names[1], 'target.json', src_dir_fd=directory_fd, dst_dir_fd=directory_fd)
        os.fsync(directory_fd)
        fd = os.open('target.json', os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory_fd)
        try:
            new_pre = identity(os.fstat(fd)); owned_file(os.fstat(fd)); result = bytearray()
            while block := os.read(fd, 4096):
                result.extend(block)
                if len(result) > MAX_BYTES: raise ValueError('FINITE_RETIRED_SELECTOR_BYTES_REQUIRED')
            result = bytes(result)
            if result != replacement or new_pre != identity(os.fstat(fd)) or new_pre != identity(os.stat('target.json', dir_fd=directory_fd, follow_symlinks=False)):
                raise ValueError('RETIRED_SELECTOR_FULL_BYTES_ALL_NINE_MISMATCH')
        finally: os.close(fd)
        final_root = identity(os.fstat(directory_fd))
        if final_root != identity(os.lstat(root)) or sorted(os.listdir(directory_fd)) != sorted(members + [names[0]]):
            raise ValueError('RETIRED_SELECTOR_FINAL_ROOT_CUSTODY_MISMATCH')
        return dict(status='PASS', targetAbsent=False, retiredSelectorInvalidated=True,
                    originalTargetPRE=target_pre, retiredTargetPRE=new_pre, retiredTargetPOST=new_pre,
                    rootPRE=root_pre, rootPOST=final_root,
                    originalTargetSHA256=hashlib.sha256(raw).hexdigest(),
                    retiredTargetSHA256=hashlib.sha256(replacement).hexdigest(),
                    trackedMutation='TWO_EXCLUSIVE_FILES_AND_ATOMIC_OWNED_SELECTOR_REPLACEMENT',
                    historicalCustodyRepaired=False)
    finally:
        if target_fd is not None: os.close(target_fd)
        os.close(directory_fd)

if __name__ == '__main__':
    value = strict_json(sys.stdin.buffer.read(MAX_BYTES + 1))
    print(json.dumps(retire(Path('/owned/private'), value)))
