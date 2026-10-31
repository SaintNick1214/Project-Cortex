"""One root-lock-resolved public archive; only the exact parser member is staged."""
import base64
import hashlib
import io
import os
from pathlib import Path, PurePosixPath
import tarfile
import urllib.request

URL = 'https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz'
INTEGRITY = 'y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw=='
BYTES = 9144216
SHA = '569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39'


def acquire(destination):
    if destination.exists() or destination.is_symlink(): raise ValueError('NEW_PARSER_PATH_ONLY')
    with urllib.request.urlopen(URL,timeout=60) as response: raw=response.read(16777217)
    if len(raw)>16777216 or base64.b64encode(hashlib.sha512(raw).digest()).decode()!=INTEGRITY:
        raise ValueError('OFFICIAL_TYPESCRIPT_INTEGRITY')
    seen=set();selected=None;total=0
    with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as archive:
        for member in archive:
            parts=PurePosixPath(member.name).parts
            if not parts or parts[0]!='package' or '..'in parts or member.name.startswith('/') or member.name in seen:
                raise ValueError('STRICT_PUBLIC_TAR_MEMBERSHIP')
            seen.add(member.name);total+=member.size
            if len(seen)>256 or total>67108864 or not(member.isfile()or member.isdir()):
                raise ValueError('FINITE_OFFICIAL_PARSER_ARCHIVE')
            if member.name=='package/lib/typescript.js':
                if member.size!=BYTES:raise ValueError('EXACT_PARSER_SIZE')
                with archive.extractfile(member)as f:selected=f.read(BYTES+1)
    if selected is None or len(selected)!=BYTES or hashlib.sha256(selected).hexdigest()!=SHA:
        raise ValueError('EXACT_PARSER_BYTES')
    with open(destination,'xb')as out:os.chmod(destination,0o600);out.write(selected);out.flush();os.fsync(out.fileno())
    return {'url':URL,'sha512':INTEGRITY,'tarBytes':len(raw),'members':len(seen),
            'expandedDeclaredBytes':total,'selectedMember':'package/lib/typescript.js',
            'bytes':BYTES,'sha256':SHA,'noLifecycle':True,'compilerEmit':False}


if __name__=='__main__':
    import json,sys
    if len(sys.argv)!=2:raise ValueError('ONE_OWNED_PARSER_DESTINATION')
    print(json.dumps(acquire(Path(sys.argv[1])),separators=(',',':')))
