import copy
import hashlib
import json
import os
from pathlib import Path
import types

R = Path('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion')
P = R / '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'
OUT = P / 'task04-current-producer-repair1-parent-preparation'
OUT.mkdir(mode=0o700)
with (OUT / 'mocked-fixture-setup1-failure.json').open('x') as f:
    json.dump({'scope':'MOCKED_FIXTURE_ADAPTATION_SETUP_ONLY','status':'FAIL','error':'StopIteration','cause':'Old bootstrap-r3 destination was not mapped to the exact new bootstrap destination before finite table lookup','originalRawInlineSourceBacking':'TOOL_TRACE_ONLY_NOT_RETAINED_AS_FILE','checksExecuted':0,'Docker':False,'originalAssertions':'UNCHANGED'}, f, indent=2); f.write('\n')
source = Path('/Users/SaintNick/.codex/tmp/cortex-task04-repair1-parent-metadata-20261006.py')
raw = source.read_bytes()
with (OUT / 'metadata-module.py').open('xb') as f:
    f.write(raw); f.flush(); os.fsync(f.fileno())
m = types.ModuleType('root_recipe_metadata'); exec(compile(raw,str(source),'exec'),m.__dict__)
recipe_raw = (R / 'work/resume/task04-c8-current-canonical-input-producers/repair1/proposal/recipe.json').read_bytes()
assert hashlib.sha256(recipe_raw).hexdigest() == '22b9daa94d050a24fcc14a3c5df0e214b8ff3f6e98d4742b653710e05c7366dc'
recipe = json.loads(recipe_raw)
c = json.loads((P / 'task04-current-producer-linux-public-run-r3/raw/created-container-inspect1.stdout').read_text())[0]
cid = 'b' * 64
c['Id'] = cid; c['Name'] = '/' + recipe['containerName']
c['Config']['Labels'] = recipe['ownershipBeforeEffects']['containerInspectBeforeStart']['Config.Labels']
c['Config']['Cmd'] = ['-B','/reviewed-bootstrap.py']; c['Args'] = c['Config']['Cmd']
c['Config']['Env'] = [('HOME=/var/tmp/task04-c8-producer-repair1/home' if x.startswith('HOME=') else x) for x in c['Config']['Env']]
for row in c['HostConfig']['Mounts']:
    if row['Type'] == 'volume': row['Source'] = recipe['exclusiveNewVolume']
    else:
        if row['Target'] == '/reviewed-bootstrap-r3.py': row['Target'] = '/reviewed-bootstrap.py'
        row['Source'] = next(x['desktopSourceLiteral'] for x in recipe['finiteBindCoordinateTable'] if x['destination'] == row['Target'])
for row in c['Mounts']:
    if row['Type'] == 'volume':
        row['Name'] = recipe['exclusiveNewVolume']; row['Source'] = '/var/lib/docker/volumes/' + recipe['exclusiveNewVolume'] + '/_data'
    else:
        if row['Destination'] == '/reviewed-bootstrap-r3.py': row['Destination'] = '/reviewed-bootstrap.py'
        row['Source'] = next(x['desktopSourceLiteral'] for x in recipe['finiteBindCoordinateTable'] if x['destination'] == row['Destination'])
checks = []
def check(name,value,reject=False,created=True,onlyowner=False):
    try:
        answer = m.own(value,recipe,cid) if onlyowner else m.validate(value,recipe,cid,created=created)
        ok = not reject; evidence = answer
    except BaseException as error:
        ok = reject; evidence = repr(error)
    checks.append({'name':name,'status':'PASS' if ok else 'FAIL','evidence':evidence})
check('valid-created-complete-desktop-coordinates',copy.deepcopy(c))
variant = copy.deepcopy(c)
for row in variant['HostConfig']['Mounts']:
    if row['Type'] == 'bind': row['Source'] = next(x['hostSourceLiteral'] for x in recipe['finiteBindCoordinateTable'] if x['destination'] == row['Target'])
for row in variant['Mounts']:
    if row['Type'] == 'bind': row['Source'] = next(x['hostSourceLiteral'] for x in recipe['finiteBindCoordinateTable'] if x['destination'] == row['Destination'])
check('valid-created-complete-literal-host-coordinates',variant)
variant = copy.deepcopy(c); variant['HostConfig']['OomKillDisable'] = None
variant['State'].update(Status='running',Running=True,Pid=123,StartedAt='2026-10-06T15:00:00Z')
check('valid-started-declared-guards-and-raw-unset-OOM-field',variant,created=False)
mutations = [
 ('wrong-ID',lambda x:x.update(Id='c'*64)),
 ('wrong-UUID',lambda x:x['Config']['Labels'].update({'com.cortex.operation':'other'})),
 ('bool-memory',lambda x:x['HostConfig'].update(Memory=True)),
 ('mixed-coordinate',lambda x:x['HostConfig']['Mounts'][1].update(Source=recipe['finiteBindCoordinateTable'][0]['hostSourceLiteral'])),
 ('different-full-root',lambda x:x['Mounts'][0].update(Source='/elsewhere'+x['Mounts'][0]['Source'])),
 ('writable-bind',lambda x:x['Mounts'][0].update(RW=True)),
 ('extra-mount',lambda x:x['Mounts'].append({'Type':'bind','Source':'/private','Destination':'/private','RW':False})),
 ('extra-capability',lambda x:x['HostConfig'].update(CapAdd=['SYS_ADMIN'])),
 ('network-enabled',lambda x:x['HostConfig'].update(NetworkMode='bridge')),
 ('bool-PID',lambda x:x['State'].update(Pid=False)),
 ('bool-exit',lambda x:x['State'].update(ExitCode=False)),
 ('OOM-disable-true',lambda x:x['HostConfig'].update(OomKillDisable=True)),
 ('OOM-disable-int-zero',lambda x:x['HostConfig'].update(OomKillDisable=0)),
 ('false-restart-counter',lambda x:x['HostConfig']['RestartPolicy'].update(MaximumRetryCount=False)),
 ('extra-environment',lambda x:x['Config']['Env'].append('NODE_PATH=/unlisted'))]
for name,mutate in mutations:
    variant = copy.deepcopy(c); mutate(variant); check(name,variant,reject=True)
variant = copy.deepcopy(c); variant['HostConfig']['Memory'] = 2147483648
check('ownership-only-cleanup-eligible-despite-failed-resource-guard',variant,onlyowner=True)
variant['Config']['Labels']['com.cortex.operation'] = 'foreign'
check('ownership-only-cleanup-refuses-foreign-UUID',variant,reject=True,onlyowner=True)
result = {'scope':'MOCKED_PARENT_METADATA_CONTROLS_ONLY_NO_DOCKER','status':'PASS' if all(x['status']=='PASS' for x in checks) else 'FAIL','checks':checks,'moduleSHA256':hashlib.sha256(raw).hexdigest(),'recipeSHA256':hashlib.sha256(recipe_raw).hexdigest(),'originalFailedMonitor':'PRESERVED','actualPipelineControls':0,'native':False,'wholeGoal':'OPEN'}
with (OUT / 'metadata-controls1.json').open('x') as f:
    json.dump(result,f,indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
with (OUT / 'mocked-fixture.json').open('x') as f:
    json.dump(c,f,indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
print(json.dumps({'status':result['status'],'checks':len(checks),'moduleSHA256':result['moduleSHA256']}))
raise SystemExit(result['status'] != 'PASS')
