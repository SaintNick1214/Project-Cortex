"""Pinned public npm source acquisition only; no lifecycle/imported package code."""
import base64
import hashlib
import io
import os
from pathlib import Path, PurePosixPath
import tarfile
import urllib.request

URL = 'https://registry.npmjs.org/npm/-/npm-12.2.0.tgz'
INTEGRITY = 'ZsJjKpTnlmSXOLLXiU1xDCzC4Wlok4IwZmh/aw2KUuXytU7q6qMv/cUT7MoeSf95Slwuw/lRXYefGzGCspHPNQ=='
raw = urllib.request.urlopen(URL, timeout=60).read(16777217)
if len(raw)>16777216 or base64.b64encode(hashlib.sha512(raw).digest()).decode()!=INTEGRITY:
    raise ValueError('PINNED_NPM_122_SOURCE_INTEGRITY')
root = Path('/usr/local/lib/node_modules/npm')
root.mkdir(parents=True, mode=0o755, exist_ok=False)
seen=set(); count=total=0
with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
    for member in archive:
        parts=PurePosixPath(member.name).parts
        if not parts or parts[0]!='package' or '..' in parts or member.name.startswith('/') or member.name in seen:
            raise ValueError('FINITE_NPM_LITERAL_MEMBER_SET')
        seen.add(member.name); target=root.joinpath(*parts[1:])
        if member.isdir(): target.mkdir(parents=True, mode=0o755, exist_ok=True)
        elif member.isfile():
            count+=1; total+=member.size
            if count>1942 or total>12397700: raise ValueError('OFFICIAL_NPM_FINITE_EXPANDED_DEMAND')
            target.parent.mkdir(parents=True, mode=0o755, exist_ok=True)
            with archive.extractfile(member) as source, open(target,'xb') as out:
                os.chmod(target,0o644)
                remaining=member.size
                while remaining:
                    block=source.read(min(1048576,remaining))
                    if not block: raise ValueError('NPM_MEMBER_TRUNCATED')
                    out.write(block); remaining-=len(block)
                if source.read(1): raise ValueError('NPM_MEMBER_EXCESS')
        else: raise ValueError('NPM_UNDECLARED_ALIAS_OR_SPECIAL_MEMBER')
if count!=1942 or total!=12397700: raise ValueError('NPM_ALL_FINITE_MEMBERS_REQUIRED')
os.symlink('../lib/node_modules/npm/bin/npm-cli.js','/usr/local/bin/npm')
os.symlink('../lib/node_modules/npm/bin/npx-cli.js','/usr/local/bin/npx')
os.mkdir('/opt/cortex-c8',0o755)
os.mkdir('/opt/cortex-c8/python',0o755)
os.symlink('/usr/local/bin','/opt/cortex-c8/python/bin')
