"""Future native production boundary. Synthetic tests cannot create this authority."""
import os
from pathlib import Path
import platform
import select
import signal

from strict_io import Reader, ident, integer, literal, read_materializer, require, shape, strict_json

PHASE_ROOT = '/var/tmp/cortex-task04-c8-r3-phase'


class NativeBoundary:
    def __init__(self, binding, release, binding_pin, release_pin):
        require(platform.system() == 'Linux' and platform.machine() == 'x86_64' and os.getuid() == 0,
                'CURRENT_NATIVE_LINUX_X64_UID0_REQUIRED')
        require(hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal') and hasattr(os, 'O_PATH'),
                'MANDATORY_NATIVE_PIDFD_O_PATH')
        shape(binding, ('schema', 'scope', 'phaseRoot', 'owner', 'environment', 'files', 'literalAliases', 'directories', 'physicalBindingSHA256'))
        require(binding['schema'] == 'C8_CANONICAL_PRODUCER_BINDING_V1' and
                binding['scope'] == 'CURRENT_NATIVE_SOURCE_ONLY' and binding['phaseRoot'] == PHASE_ROOT,
                'CURRENT_PRODUCER_BINDING_SCHEMA')
        shape(release, ('scope', 'bindingSHA256', 'allowedOutputNamespace', 'approvedTransformSHA256', 'approvedASTRecipeSHA256', 'approvedParserSHA256', 'physicalReleaseSHA256', 'approvedInputHashes', 'admission'))
        require(release['scope'] == 'CURRENT_CANONICAL_INPUT_SOURCE_PRODUCTION_ONLY' and
                release['bindingSHA256'] == binding_pin['sha256'] and
                release['allowedOutputNamespace'] == PHASE_ROOT + '/generated-inputs', 'INDEPENDENT_CURRENT_SOURCE_RELEASE_REQUIRED')
        self.binding, self.release = binding, release
        self.binding_pin, self.release_pin = binding_pin, release_pin
        self.binding_hash = binding['physicalBindingSHA256']
        self.physical_release_hash = release['physicalReleaseSHA256']
        self.transform_hash = release['approvedTransformSHA256']
        self.parser_hash = release['approvedParserSHA256']
        self.fd = None; self.files = []; self.aliases = []
        owner = shape(binding['owner'], ('pid', 'startTime', 'rawArgvHex'))
        require(integer(owner['pid']) == 1 and type(owner['startTime']) is str and owner['startTime'].isdecimal(), 'KNOWN_RETAINED_PID1_OWNER')
        try:
            self.fd = os.pidfd_open(1)
            signal.pidfd_send_signal(self.fd, 0)
            for row in binding['files']:
                fd = os.open(row['path'], os.O_RDONLY | os.O_NOFOLLOW); self.files.append((fd, row))
            for row in binding['literalAliases']:
                fd = os.open(row['path'], os.O_PATH | os.O_NOFOLLOW); self.aliases.append((fd, row))
            self.verify()
        except BaseException:
            self.close(); raise

    def verify(self):
        poller = select.poll(); poller.register(self.fd, select.POLLIN | select.POLLHUP | select.POLLERR)
        require(not poller.poll(0), 'CURRENT_OWNER_PIDFD_TERMINAL')
        signal.pidfd_send_signal(self.fd, 0)
        owner = self.binding['owner']; text = Path('/proc/1/stat').read_text()
        require(text[text.rfind(')')+2:].split()[19] == owner['startTime'] and
                Path('/proc/1/cmdline').read_bytes().hex() == owner['rawArgvHex'], 'CURRENT_OWNER_KERNEL_IDENTITY')
        env = shape(self.binding['environment'], ('PATH', 'HOME', 'TMPDIR', 'NODE_PATH'))
        require(env['NODE_PATH'] == 'ABSENT' and 'NODE_PATH' not in os.environ and
                all(os.environ.get(k) == env[k] for k in ('PATH', 'HOME', 'TMPDIR')), 'EXACT_BOUND_ENVIRONMENT')
        for fd, row in self.files:
            require(ident(os.fstat(fd)) == row['PRE'] == ident(os.lstat(row['path'])), 'BOUND_SOURCE_NINE_DRIFT')
            reader = Reader(self.resource)
            read_materializer(reader, row, row['bytes']); reader.final()
        for fd, row in self.aliases:
            require(ident(os.fstat(fd)) == row['PRE'] == ident(os.lstat(row['path'])) and
                    os.fsencode(os.readlink('', dir_fd=fd)).hex() == row['targetHex'], 'BOUND_ALIAS_LITERAL_NINE_DRIFT')
        for row in self.binding['directories']:
            require(ident(os.lstat(row['path'])) == row['identity'] and
                    sorted(os.listdir(row['path'])) == row['members'], 'BOUND_DIRECTORY_MEMBERSHIP')
        reader = Reader(self.resource)
        read_materializer(reader, self.binding_pin, self.binding_pin['bytes'])
        read_materializer(reader, self.release_pin, self.release_pin['bytes']); reader.final()
        self.resource()

    def resource(self):
        maximum = Path('/sys/fs/cgroup/memory.max').read_text().strip()
        current = Path('/sys/fs/cgroup/memory.current').read_text().strip()
        require(maximum == '6442450944' and current.isdecimal() and
                Path('/sys/fs/cgroup/memory.swap.max').read_text().strip() == '0' and
                int(maximum)-int(current) >= 134217728, 'LITERAL_CGROUP_RESERVE_HOLD')
        return {'maximum': int(maximum), 'current': int(current), 'reserve': int(maximum)-int(current)}

    def close(self):
        errors = []
        for fd, _ in self.files + self.aliases:
            try: os.close(fd)
            except OSError as error: errors.append(str(error))
        self.files.clear(); self.aliases.clear()
        if self.fd is not None:
            try: os.close(self.fd)
            except OSError as error: errors.append(str(error))
            self.fd = None
        require(not errors, 'MANDATORY_NATIVE_BOUNDARY_FD_CLOSE:' + repr(errors))
