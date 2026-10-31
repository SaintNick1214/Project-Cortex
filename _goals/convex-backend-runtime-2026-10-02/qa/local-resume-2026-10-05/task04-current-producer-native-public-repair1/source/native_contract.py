"""Source-only qualification contracts. No release or subject dispatch authority."""
import hashlib
import json
import math
import os
from pathlib import Path
import stat

FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
MEMORY = 1073741824
PY_RESERVE = 134217728
NODE_RESERVE = 536870912
MAINTAINED_BYTES = 1073741824
MAINTAINED_INODES = 8192
PUBLIC_WRITE_BYTES = 923691060
PUBLIC_WRITE_INODES = 8192
NATIVE_RAW_BYTES = 536870912
NATIVE_RAW_FILES = 4096
NATIVE_RECEIPTS_BYTES = 16777216
NATIVE_RECEIPTS_FILES = 128
ROOT = '/var/tmp/task04-c8-current-canonical-input-producers'
C7ROOT = '/dev/shm/cortex-native-c7-exact-identity-repair'


def strict(raw):
    def pairs(rows):
        value = {}
        for key, item in rows:
            if key in value: raise ValueError('DUPLICATE_KEY')
            value[key] = item
        return value
    def floating(token):
        value = float(token)
        if not math.isfinite(value): raise ValueError('NONFINITE_JSON')
        return value
    def constant(token): raise ValueError('NONFINITE_JSON')
    return json.loads(raw, object_pairs_hook=pairs, parse_float=floating, parse_constant=constant)


def identity(value):
    return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':{k:str(getattr(value,'st_'+k)) for k in FIELDS}}


def demand(block):
    if type(block) is not int or block < 512 or block > 1048576 or block & (block-1):
        raise ValueError('ACTUAL_BLOCK_GEOMETRY')
    # Exact original public ceiling plus separate declared raw/helper maxima;
    # rounding accounts for EVERY potential single-link file, not only total bytes.
    allocated = PUBLIC_WRITE_BYTES + NATIVE_RAW_BYTES + NATIVE_RECEIPTS_BYTES
    files = PUBLIC_WRITE_INODES + NATIVE_RAW_FILES + NATIVE_RECEIPTS_FILES
    rounding = files * (block-1)
    directories = 512 * block
    total = allocated + rounding + directories
    return {'writeCeilingBytes':allocated,'perPathRoundingBytes':rounding,
            'directoryBlocksBytes':directories,'allocationCeilingBytes':total,
            'initialAvailableBytesRequired':((total+MAINTAINED_BYTES+block-1)//block)*block,
            'initialAvailableInodesRequired':files+512+MAINTAINED_INODES,
            'maintainedAvailableBytesRequired':MAINTAINED_BYTES,
            'maintainedAvailableInodesRequired':MAINTAINED_INODES,'blockBytes':block,
            'historical48GBPhysicalAdmission':'HELD_NOT_REPLACED'}


def host_demand(block):
    container=demand(block)
    # Image build is a separately measured footprint ceiling, not a claim about
    # the public runner's currently available space or historical image identity.
    parser=9144216;artifact=671088640;build=2147483648
    artifact_paths=16001;build_paths=65536;build_dirs=4096;host_dirs=8
    write=container['allocationCeilingBytes']+parser+artifact+build+(artifact_paths+build_paths+1)*(block-1)+(build_dirs+host_dirs)*block
    inodes=(container['initialAvailableInodesRequired']-MAINTAINED_INODES)+artifact_paths+build_paths+build_dirs+host_dirs+1
    return {'maintainedAvailableBytesRequired':8589934592,'maintainedAvailableInodesRequired':32768,
            'writeAllocationCeilingBytes':write,'writeInodeCeiling':inodes,
            'initialAvailableBytesRequired':((write+8589934592+block-1)//block)*block,
            'initialAvailableInodesRequired':inodes+32768,'buildFootprintBytesMax':build,
            'buildFootprintInodesMax':build_paths+build_dirs,'artifactBytesMaxIncludingManifest':artifact,
            'blockBytes':block,'singleHostDockerFilesystemRequired':True,'actualCapacityRelease':'ABSENT'}


def resource(fs, maximum, current, swap, node=False, initial=False):
    if type(maximum) is not int or type(current) is not int or type(swap) is not int:
        raise ValueError('STRICT_RESOURCE_INTEGER')
    needed = NODE_RESERVE if node else PY_RESERVE
    row = {'memoryMax':maximum,'memoryCurrent':current,'swapMax':swap,
           'literalReserve':maximum-current,'literalReserveRequired':needed,
           'availableBytes':fs.f_bavail*fs.f_frsize,'availableInodes':fs.f_favail,
           'blockBytes':fs.f_frsize,'initial':initial,'nodeStage':node}
    required = demand(fs.f_frsize)
    floor = required['initialAvailableBytesRequired'] if initial else MAINTAINED_BYTES
    inodes = required['initialAvailableInodesRequired'] if initial else MAINTAINED_INODES
    row['availableBytesRequired'],row['availableInodesRequired'] = floor,inodes
    if maximum != MEMORY or swap != 0 or maximum-current < needed:
        raise ValueError('LITERAL_CGROUP_RESERVE_HOLD:'+repr(row))
    if row['availableBytes'] < floor or row['availableInodes'] < inodes:
        raise ValueError('DISK_INODE_ADMISSION_HOLD:'+repr(row))
    return row


class Held:
    """Current PRE/open/full EOF/POST/final path identity; all nine remain exact."""
    def __init__(self, path, cap, expected=None):
        self.path = str(path)
        self.fd = None
        if type(cap) is not int or cap < 0: raise ValueError('FINITE_CAP')
        before = os.lstat(path)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or str(Path(path).resolve()) != str(path):
            raise ValueError('REGULAR_LITERAL_SINGLE_LINK')
        self.pin = identity(before)
        try:
            self.fd = os.open(path, os.O_RDONLY|os.O_NOFOLLOW)
            if identity(os.fstat(self.fd)) != self.pin: raise ValueError('OPEN_NINE_DRIFT')
            self.digest, self.size = self.hash(cap)
            if expected is not None and (self.size,self.digest) != (expected['bytes'],expected['sha256']):
                raise ValueError('CURRENT_CONTENT_PIN')
            self.fence()
        except BaseException:
            self.close()
            raise

    def hash(self, cap):
        os.lseek(self.fd,0,os.SEEK_SET)
        digest,total = hashlib.sha256(),0
        while block := os.read(self.fd,65536):
            total += len(block)
            if total > cap: raise ValueError('FULL_EOF_BOUND')
            digest.update(block)
        return digest.hexdigest(),total

    def fence(self, full=False):
        if self.fd is None: raise ValueError('CLOSED_SOURCE_FD')
        if identity(os.fstat(self.fd)) != self.pin or identity(os.lstat(self.path)) != self.pin:
            raise ValueError('CURRENT_ALL_NINE_DRIFT')
        if full and self.hash(self.size) != (self.digest,self.size): raise ValueError('CURRENT_BYTE_DRIFT')
        return self.row()

    def row(self):
        return {'path':self.path,'bytes':self.size,'sha256':self.digest,'PRE':self.pin,
                'OPEN':self.pin,'POST':identity(os.fstat(self.fd)),
                'pathFINAL':identity(os.lstat(self.path)),'EOF':True,'heldFD':self.fd}

    def close(self):
        if self.fd is not None:
            fd,self.fd = self.fd,None
            returned = os.close(fd)
            return {'fd':fd,'closeReturn':returned,'closed':True}


def proc(pid):
    if type(pid) is not int or pid <= 0: raise ValueError('STRICT_PID')
    raw = Path('/proc',str(pid),'stat').read_bytes()
    fields = raw[raw.rfind(b')')+2:].split()
    argv = Path('/proc',str(pid),'cmdline').read_bytes()
    if len(raw)>65536 or len(argv)>65536: raise ValueError('FINITE_PROC_BOUND')
    return {'pid':pid,'startTime':fields[19].decode(),'ppid':fields[1].decode(),
            'pgid':fields[2].decode(),'sid':fields[3].decode(),'rawArgvHex':argv.hex(),
            'rawStatHex':raw.hex()}


def literal_maps(raw):
    if type(raw) is not bytes or len(raw)>1048576: raise ValueError('FINITE_MAP_BYTES')
    paths = set()
    for line in raw.decode('utf8','strict').splitlines():
        parts = line.split(None,5)
        if len(parts)==6 and parts[5].startswith('/'):
            if parts[5].endswith(' (deleted)'): raise ValueError('DELETED_MAPPED_SOURCE')
            paths.add(parts[5])
    return sorted(paths)
