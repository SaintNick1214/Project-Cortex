"""Exact GNU tar record terminator validation; no arbitrary trailing-byte drain."""
BLOCK = 512
RECORD = 10240

class TrackedTarReader:
    def __init__(self, stream):
        self.stream = stream
        self.tail = b''

    def read(self, size):
        if type(size) is not int or not 0 <= size <= 1048576:
            raise ValueError('FINITE_LOGICAL_TAR_READ_REQUIRED')
        raw = self.stream.read(size)
        self.tail = (self.tail + raw)[-BLOCK:]
        return raw

    def tell(self):
        return self.stream.tell()

    def seek(self, position, whence=0):
        if whence != 0 or type(position) is not int or position < self.tell():
            raise ValueError('FORWARD_LOGICAL_TAR_POSITION_REQUIRED')
        while self.tell() < position:
            if not self.read(min(65536, position - self.tell())):
                raise ValueError('TRUNCATED_LOGICAL_TAR_POSITION')
        return self.tell()

    def close(self):
        return self.stream.close()

def finish_tar_record(archive, tracked):
    # TarFile may stop on an invalid or short header as well as on a zero block.
    # Both the exact logical position and the actual first zero block are needed.
    end = archive.offset
    if type(end) is not int or end < 0 or end % BLOCK:
        raise ValueError('EXACT_LAST_TAR_MEMBER_BOUNDARY_REQUIRED')
    if tracked.tell() != end + BLOCK or tracked.tail != b'\0' * BLOCK:
        raise ValueError('EXACT_FIRST_ZERO_TAR_TERMINATOR_REQUIRED')
    padded_end = ((end + 2 * BLOCK + RECORD - 1) // RECORD) * RECORD
    remaining = padded_end - tracked.tell()
    if not BLOCK <= remaining <= RECORD or remaining % BLOCK:
        raise ValueError('EXACT_FINITE_TAR_RECORD_PADDING_REQUIRED')
    raw = tracked.read(remaining)
    if len(raw) != remaining or raw != b'\0' * remaining:
        raise ValueError('EXACT_SECOND_ZERO_AND_RECORD_PADDING_REQUIRED')
    if tracked.read(1):
        raise ValueError('TRAILING_BYTES_AFTER_EXACT_TAR_RECORD')
    return {'scope': 'EXACT_FINITE_GNU_TAR_RECORD_TERMINATION_ONLY',
            'lastMemberEnd': end, 'firstZeroBlockBytes': BLOCK,
            'remainingZeroPaddingBytes': remaining, 'recordBytes': RECORD,
            'streamBytes': padded_end, 'exactPhysicalEOF': True,
            'arbitraryTrailingBytesAccepted': False}
