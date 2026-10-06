"""Root setup writes only a dedicated fresh dummy probe volume."""
import os, json
from pathlib import Path
import shutil
import stat
assert os.getuid() == 0
owned = Path('/owned'); assert not list(owned.iterdir())
os.chown(owned, 501, 20); os.chmod(owned, 0o700)
def directory(p):
    p.mkdir(); os.chown(p, 501, 20); os.chmod(p, 0o700)
directory(owned / 'healthy'); directory(owned / 'healthy/private'); directory(owned / 'cases')
names = ['foreign-source-directory-owner', 'foreign-source-file-owner', 'source-directory-mode', 'source-file-mode', 'source-file-hardlink', 'source-file-symlink', 'source-file-directory', 'source-zero-length', 'source-unselected-extra', 'source-manifest-digest-drift', 'foreign-destination-directory-owner', 'destination-directory-mode', 'destination-nonempty']
for name in names:
    p = owned / 'cases' / name; directory(p); directory(p / 'private'); directory(p / 'selected')
    for filename, data in json.loads(Path('/prep/dummy-selected-template.json').read_text())['files'].items():
        out = p / 'selected' / filename; out.write_bytes(bytes.fromhex(data)); os.chown(out, 501, 20); os.chmod(out, 0o600)
    if name == 'foreign-source-directory-owner': os.chown(p / 'selected', 1, 20)
    elif name == 'foreign-source-file-owner': os.chown(p / 'selected/deploy.env', 1, 20)
    elif name == 'source-directory-mode': os.chmod(p / 'selected', 0o750)
    elif name == 'source-file-mode': os.chmod(p / 'selected/deploy.env', 0o640)
    elif name == 'source-file-hardlink': os.link(p / 'selected/deploy.env', p / 'link-peer')
    elif name == 'source-file-symlink':
        (p / 'selected/deploy.env').unlink(); (p / 'selected/deploy.env').symlink_to(p / 'selected/target.json')
    elif name == 'source-file-directory':
        (p / 'selected/deploy.env').unlink(); directory(p / 'selected/deploy.env')
    elif name == 'source-zero-length': (p / 'selected/deploy.env').write_bytes(b'')
    elif name == 'source-unselected-extra': (p / 'selected/unknown').write_bytes(b'DUMMY')
    elif name == 'source-manifest-digest-drift': (p / 'selected/deploy.env').write_bytes(b'DUMMY_CHANGED_WITHOUT_CUSTODY')
    elif name == 'foreign-destination-directory-owner': os.chown(p / 'private', 1, 20)
    elif name == 'destination-directory-mode': os.chmod(p / 'private', 0o750)
    elif name == 'destination-nonempty':
        f = p / 'private/owned-existing'; f.write_bytes(b'DUMMY'); os.chown(f, 501, 20); os.chmod(f, 0o600)
print('DUMMY_VOLUME_SETUP_PASS')
