"""Future native production boundary. Synthetic tests cannot create this authority."""
import os
import hashlib
import stat
from pathlib import Path
import platform
import select
import signal
import sys

from strict_io import Reader, ident, integer, literal, read_materializer, require, shape, strict_json

PHASE_ROOT = '/var/tmp/cortex-task04-c8-r3-phase'


class NativeBoundary:
    def __init__(self, binding, release, binding_pin, release_pin):
        require(platform.system() == 'Linux' and platform.machine() == 'x86_64' and os.getuid() == 0,
                'CURRENT_NATIVE_LINUX_X64_UID0_REQUIRED')
        require(hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal') and hasattr(os, 'O_PATH'),
                'MANDATORY_NATIVE_PIDFD_O_PATH')
        shape(binding, ('schema', 'scope', 'phaseRoot', 'owner', 'environment', 'files', 'literalAliases', 'directories', 'physicalBindingSHA256', 'physicalBinding', 'physicalRelease', 'pythonImports', 'mappedRuntimeSources'))
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
        self.chain = [binding['physicalBinding'], binding['physicalRelease']]
        chain_reader = Reader(self.resource)
        _, runtime_raw = read_materializer(chain_reader, self.chain[0], 536870912, collect=True)
        _, physical_raw = read_materializer(chain_reader, self.chain[1], 536870912, collect=True)
        runtime, physical = strict_json(runtime_raw), strict_json(physical_raw)
        require(self.chain[0]['sha256'] == self.binding_hash and self.chain[1]['sha256'] == self.physical_release_hash, 'EXACT_CURRENT_PHYSICAL_CHAIN_HASH')
        require(runtime.get('status') == 'CURRENT_RETAINED_CONTAINER_BINDING_READY_FOR_INDEPENDENT_REVIEW' and
                runtime.get('unresolvedMappedPaths') == [] and runtime.get('pastContainerPinsAdopted') is False and
                runtime.get('imageHashSubstitutedForAllNine') is False, 'CURRENT_PHYSICAL_CHAIN_NOT_HISTORY')
        shape(physical, ('scope', 'bindingSHA256', 'owner', 'approvedCohorts', 'reviewReceiptSHA256'))
        require(physical['scope'] == 'SOURCE_ONLY_PHYSICAL_PREPARATION' and physical['bindingSHA256'] == self.binding_hash and
                set(physical['approvedCohorts']) == {'full8','history','original','comparison','packages'}, 'CURRENT_PHYSICAL_CHAIN_RELEASE')
        chain_reader.final()
        require(sys.dont_write_bytecode and sys.executable == '/usr/local/bin/python3.12', 'BOUND_LITERAL_PYTHON_NO_CACHE_WRITES')
        shape(release['approvedInputHashes'], ('aliases','transforms','astFacts','commandContract','historyRecipes') + tuple(phase+':'+kind for phase in ('full8','history','original','comparison','packages')for kind in ('receipt','ledger','declarations')))
        require(type(binding['files']) is list and type(binding['literalAliases']) is list and type(binding['directories']) is list, 'FINITE_BINDING_RECORD_ARRAYS')
        for row in binding['literalAliases']:
            shape(row, ('path','targetHex','targetBytes','targetSHA256','PRE','POST','pathPOST','heldO_PATH'))
            literal(row['path']);target=bytes.fromhex(row['targetHex'])
            require(row['targetHex'] == target.hex() and row['heldO_PATH'] is True and len(target) == row['targetBytes'] and hashlib.sha256(target).hexdigest() == row['targetSHA256'] and row['PRE'] == row['POST'] == row['pathPOST'], 'STRICT_CURRENT_RUNTIME_ALIAS_SCHEMA')
        for row in binding['directories']:
            shape(row, ('path','identity','members'));literal(row['path'])
            require(type(row['members']) is list and row['members'] == sorted(set(row['members'])) and all(type(name) is str and name and '/' not in name and name not in ('.','..') for name in row['members']), 'STRICT_CURRENT_DIRECTORY_RECORD')
        bound_paths = [row['path'] for row in binding['files']]
        require(len(bound_paths) == len(set(bound_paths)), 'COMPLETE_UNIQUE_CURRENT_RUNTIME_SOURCE_CLOSURE')
        required = {PHASE_ROOT+'/tools/'+name for name in ('canonical_entry.py','strict_io.py','native_boundary.py','producers.py','ast_parser.mjs','consumer_schema.mjs','consumer_wiring.mjs','reference-contract.json','literal-destination-map.json')}
        required.add(sys.executable)
        require(required <= set(bound_paths), 'EVERY_CURRENT_PRODUCER_AND_CONSUMER_HELPER_SOURCE_BOUND')
        current_imports = []
        for name,module in sorted(sys.modules.items()):
            origins = {str(Path(origin).resolve()) for origin in (getattr(module,'__file__',None),getattr(getattr(module,'__spec__',None),'origin',None),getattr(module,'__cached__',None)) if origin and os.path.isabs(origin) and Path(origin).exists()}
            require(origins <= set(bound_paths), 'CURRENT_PYTHON_IMPORT_SOURCE_CLOSURE')
            current_imports.append({'module':name,'canonicalSourceAndCachedOrigins':sorted(origins),'builtinOrFrozen':not origins})
        require(binding['pythonImports'] == current_imports, 'ACTUAL_CURRENT_IMPORT_SOURCE_MEMBERSHIP')
        actual_maps = Path('/proc/self/maps').read_text()
        def mapped_paths(raw):
            require(type(raw) is str and raw, 'READABLE_CURRENT_RAW_KERNEL_MAPS')
            return {parts[5] for line in raw.splitlines() if len(parts := line.split(maxsplit=5)) == 6 and parts[5].startswith('/')}
        require(mapped_paths(actual_maps) == mapped_paths(binding['mappedRuntimeSources']), 'CURRENT_LITERAL_MAP_SOURCE_MEMBERSHIP_NO_ADDRESS_AUTHORITY')
        self.actual_imports, self.actual_maps = current_imports, actual_maps
        for line in actual_maps.splitlines():
            parts=line.split(maxsplit=5)
            if len(parts)==6 and parts[5].startswith('/'):
                require(parts[5] in bound_paths, 'FULL_CURRENT_LITERAL_KERNEL_MAP_SOURCE_CLOSURE')
        owner = shape(binding['owner'], ('pid', 'startTime', 'rawArgvHex'))
        require(integer(owner['pid']) == 1 and type(owner['startTime']) is str and owner['startTime'].isdecimal(), 'KNOWN_RETAINED_PID1_OWNER')
        for observed in (runtime.get('ownerPRE'), runtime.get('ownerPOST'), physical['owner']):
            require(type(observed) is dict and all(observed.get(k) == owner[k] for k in owner), 'SAME_CURRENT_PHYSICAL_OWNER_CHAIN')
        try:
            self.fd = os.pidfd_open(1)
            signal.pidfd_send_signal(self.fd, 0)
            for row in binding['files']:
                fd = os.open(row['path'], os.O_RDONLY | os.O_NOFOLLOW); self.files.append((fd, row))
            for row in binding['literalAliases']:
                fd = os.open(row['path'], os.O_PATH | os.O_NOFOLLOW); self.aliases.append((fd, row))
            self.verify()
        except BaseException as error:
            try: self.close()
            except BaseException as cleanup: error.add_note('SECONDARY_NATIVE_FD_CLOSE:' + str(cleanup))
            raise

    def checkpoint(self):
        poller = select.poll(); poller.register(self.fd, select.POLLIN | select.POLLHUP | select.POLLERR)
        require(not poller.poll(0), 'CURRENT_OWNER_PIDFD_TERMINAL')
        signal.pidfd_send_signal(self.fd, 0)
        owner = self.binding['owner']; text = Path('/proc/1/stat').read_text()
        require(text[text.rfind(')')+2:].split()[19] == owner['startTime'] and
                Path('/proc/1/cmdline').read_bytes().hex() == owner['rawArgvHex'], 'CURRENT_OWNER_KERNEL_IDENTITY')
        env = shape(self.binding['environment'], ('PATH', 'HOME', 'TMPDIR', 'NODE_PATH'))
        require(env['NODE_PATH'] == 'ABSENT' and 'NODE_PATH' not in os.environ and
                all(os.environ.get(k) == env[k] for k in ('PATH', 'HOME', 'TMPDIR')), 'EXACT_BOUND_ENVIRONMENT')
        self.resource()

    def source_stat_fence(self):
        for fd, row in self.files:
            require(ident(os.fstat(fd)) == row['PRE'] == ident(os.lstat(row['path'])), 'BOUND_SOURCE_NINE_DRIFT')
        for fd, row in self.aliases:
            require(stat.S_ISLNK(os.fstat(fd).st_mode) and os.fstat(fd).st_nlink == 1 and
                    ident(os.fstat(fd)) == row['PRE'] == ident(os.lstat(row['path'])) and
                    os.fsencode(os.readlink('', dir_fd=fd)).hex() == row['targetHex'], 'BOUND_ALIAS_LITERAL_NINE_DRIFT')
        for row in self.binding['directories']:
            require(ident(os.lstat(row['path'])) == row['identity'] and
                    sorted(os.listdir(row['path'])) == row['members'], 'BOUND_DIRECTORY_MEMBERSHIP')
        self.resource()

    def verify(self):
        self.checkpoint(); self.source_stat_fence()
        reader = Reader(self.checkpoint)
        for _, row in self.files: read_materializer(reader, row, row['bytes'])
        for row in self.chain: read_materializer(reader, row, row['bytes'])
        read_materializer(reader, self.binding_pin, self.binding_pin['bytes'])
        read_materializer(reader, self.release_pin, self.release_pin['bytes']); reader.final(); self.source_stat_fence()
        self.last_runtime_proofs = list(reader.observations.values())
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
