"""Retain actual reviewed source/alias and phase-owner FDs through effects."""
import hashlib
import os
from pathlib import Path
import select

from acquire_lib import identity


class HeldRuntime:
    def __init__(self, binding, observe):
        self.binding = binding
        self.observe = observe
        self.files = []
        self.aliases = []
        self.owner_fd = os.pidfd_open(1)
        try:
            for row in binding['files']:
                fd = os.open(row['path'], os.O_RDONLY | os.O_NOFOLLOW)
                self.files.append((fd, row))
            for row in binding['literalAliases']:
                fd = os.open(row['path'], os.O_PATH | os.O_NOFOLLOW)
                self.aliases.append((fd, row))
            self.verify()
        except BaseException:
            self.close()
            raise

    def verify(self):
        poller = select.poll()
        poller.register(self.owner_fd, select.POLLIN | select.POLLHUP | select.POLLERR)
        if poller.poll(0):
            raise ValueError('RETAINED_PHASE_OWNER_PIDFD_EXITED')
        owner = self.binding['ownerPOST']
        text = Path('/proc/1/stat').read_text()
        fields = text[text.rfind(')') + 2:].split()
        if fields[19] != owner['startTime'] or Path('/proc/1/cmdline').read_bytes().hex() != owner['rawArgvHex']:
            raise ValueError('RETAINED_PHASE_OWNER_IDENTITY_DRIFT')
        for fd, row in self.files:
            pre = identity(os.fstat(fd))
            if pre != row['PRE'] or identity(os.lstat(row['path'])) != pre:
                raise ValueError('CURRENT_SOURCE_HELD_FD_PRE_DRIFT')
            digest, size = hashlib.sha256(), 0
            while chunk := os.pread(fd, 1048576, size):
                digest.update(chunk)
                size += len(chunk)
            if size != row['bytes'] or digest.hexdigest() != row['sha256']:
                raise ValueError('CURRENT_SOURCE_HELD_FD_EOF_HASH_SIZE')
            if identity(os.fstat(fd)) != pre or identity(os.lstat(row['path'])) != pre:
                raise ValueError('CURRENT_SOURCE_HELD_FD_POST_DRIFT')
            self.observe()
        for fd, row in self.aliases:
            pre = identity(os.fstat(fd))
            target = os.fsencode(os.readlink('', dir_fd=fd))
            if pre != row['PRE'] or target.hex() != row['targetHex']:
                raise ValueError('CURRENT_ALIAS_HELD_FD_PRE_DRIFT')
            if identity(os.fstat(fd)) != pre or identity(os.lstat(row['path'])) != pre:
                raise ValueError('CURRENT_ALIAS_HELD_FD_POST_DRIFT')
        for row in self.binding['literalDirectories']:
            if identity(os.lstat(row['path'])) != row['POST'] or sorted(os.listdir(row['path'])) != row['members']:
                raise ValueError('CURRENT_BOUND_DIRECTORY_MEMBERSHIP_DRIFT')

    def close(self):
        errors = []
        for fd, _ in self.files + self.aliases:
            try:
                os.close(fd)
            except OSError as error:
                errors.append(str(error))
        self.files.clear()
        self.aliases.clear()
        if self.owner_fd is not None:
            try:
                os.close(self.owner_fd)
            except OSError as error:
                errors.append(str(error))
            self.owner_fd = None
        if errors:
            raise RuntimeError('HELD_RUNTIME_CLOSE_FAILURE:' + repr(errors))
