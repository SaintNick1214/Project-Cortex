"""Record observed commands without changing the candidate or Docker volumes."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
QA = ROOT / '_goals/convex-backend-runtime-2026-10-02/qa'
OUT = Path(__file__).resolve().parent
IMAGE = 'sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3'
VOLUME = 'cortex-task03-attempt2-fixture-20261005-511363b3'
commands = []

def command(name, argv, data=None):
    start = datetime.now(timezone.utc).isoformat()
    result = subprocess.run(argv, input=data, capture_output=True, cwd=ROOT, timeout=90)
    (OUT / (name + '.stdout')).write_bytes(result.stdout)
    (OUT / (name + '.stderr')).write_bytes(result.stderr)
    receipt = {'name': name, 'argv': argv, 'start': start, 'end': datetime.now(timezone.utc).isoformat(), 'exitCode': result.returncode, 'stdoutSha256': hashlib.sha256(result.stdout).hexdigest(), 'stderrSha256': hashlib.sha256(result.stderr).hexdigest(), 'stdinSha256': hashlib.sha256(data).hexdigest() if data is not None else None}
    commands.append(receipt)
    (OUT / 'public-command-receipts.json').write_text(json.dumps(commands, indent=2) + '\n')
    assert result.returncode == 0, f'{name} failed; preserve raw receipt'
    return result.stdout

images = json.loads(command('image-inspect', ['docker', 'image', 'inspect', IMAGE]))
assert len(images) == 1 and images[0]['Id'] == IMAGE and images[0]['Architecture'] == 'amd64' and images[0]['Os'] == 'linux'
volumes = json.loads(command('volume-inspect', ['docker', 'volume', 'inspect', VOLUME]))
assert len(volumes) == 1 and volumes[0]['Name'] == VOLUME
assert volumes[0]['Labels'] == {'cortex.operation': '511363b3-8cec-4e98-95d8-ecd4865457a8'}
argv = ['docker', 'run', '--rm', '-i', '--network', 'none', '--platform', 'linux/amd64', '--memory', '512m', '--memory-swap', '512m', '--read-only', '--user', '501:20', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--mount', f'type=bind,source={QA / "task03-local-native-attempt2-2026-10-05"},target=/input,readonly', '--mount', f'type=volume,source={VOLUME},target=/owned,readonly,volume-nocopy', '--entrypoint', '/usr/local/bin/python3.12', IMAGE, '-']
result = json.loads(command('actual-public-custody', argv, (OUT / 'public-custody.py').read_bytes()))
assert result['verdict'] == 'PASS' and len(result['files']) == 840
print(json.dumps({'verdict': result['verdict'], 'files': len(result['files']), 'bytes': result['bytes'], 'directories': len(result['directories']), 'receiptSha256': result['publicTransferReceiptSha256'], 'privateEmpty': result['privateDirectoryEmpty']}))
