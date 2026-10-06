"""Effect-blocked actual coordinator mount guards; not actual Docker custody."""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import os

SOURCE = Path(__file__).resolve().parent
binding = json.loads((SOURCE / 'public-recipe-binding.json').read_bytes())
path = SOURCE / 'task03-attempt5-public-coordinate.py'
spec = importlib.util.spec_from_file_location('mount_namespace_guard', path)
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
assert module.P == SOURCE
assert binding['ownedSourceMounts'] == {'candidate': str(module.Q), 'helper': str(module.P)}
assert binding['preparationFreezeSha256'] == module.FREEZE
assert binding['publicCopiedFiles'] == 1912
base = dict(Image=module.IMAGE, Config=dict(User='501:20', Labels={'cortex.operation': module.OP}),
    HostConfig=dict(NetworkMode='none', ReadonlyRootfs=True, Memory=536870912, MemorySwap=536870912),
    State=dict(Running=False, OOMKilled=False, ExitCode=0),
    Mounts=[dict(Type='volume',Name=module.VOLUME,Destination='/owned',RW=True),
            dict(Type='bind',Source=binding['ownedSourceMounts']['candidate'],Destination='/input',RW=False),
            dict(Type='bind',Source=binding['ownedSourceMounts']['helper'],Destination='/helper',RW=False)])
rows=[]
class BlockedCommands:
    def __init__(self, obj): self.obj=obj; self.calls=[]
    def run(self,label,argv,*args,**kwargs):
        self.calls.append(dict(label=label,argv=argv,effectsBlocked=True))
        raw = json.dumps([self.obj]).encode() if 'inspect' in argv else b'PUBLIC_MOCK_ONLY'
        return dict(terminal=True,closeErrors=[],exitCode=0,failureClass=None),raw,b''

cases=[('exact-current-literal-absolute-source',None,False),
       ('obsolete-host-mnt-candidate-prefix',lambda obj: obj['Mounts'][1].update(Source='/host_mnt'+str(module.Q)),True),
       ('obsolete-host-mnt-helper-prefix',lambda obj: obj['Mounts'][2].update(Source='/host_mnt'+str(module.P)),True),
       ('rejected-original-malformed-metadata',lambda obj: obj['Mounts'][1].update(Source='/host_mnt_goals/foreign'),True),
       ('different-helper-source',lambda obj: obj['Mounts'][2].update(Source='/host_mnt'+str(module.P.parent)),True),
       ('different-candidate-source',lambda obj: obj['Mounts'][1].update(Source='/host_mnt'+str(module.Q.parent)),True),
       ('writable-helper',lambda obj: obj['Mounts'][2].update(RW=True),True)]
for name,change,rejected in cases:
    obj=copy.deepcopy(base)
    if change:change(obj)
    commands=BlockedCommands(obj);module.C=commands;module.records=[];failure=None
    try:module.execute('copy','501:20',[],['PUBLIC_MOCK_ONLY'],30)
    except AssertionError as error:failure=repr(error)
    assert (failure is not None)==rejected
    rows.append(dict(name=name,rejected=rejected,failure=failure,calls=commands.calls))
result=dict(scope='ACTUAL_SOURCE_MOUNT_GUARDS_WITH_EXPLICIT_DOCKER_COMMAND_AND_INSPECT_SUBSTITUTIONS',
    status='PASS',checks=len(rows),rows=rows,
    codeSHA256=hashlib.sha256(path.read_bytes()).hexdigest(),bindingSHA256=hashlib.sha256((SOURCE/'public-recipe-binding.json').read_bytes()).hexdigest(),
    actualDocker=False,actualCustody=False,actualProcessTerminal=False,sourceApproved=False)
with (SOURCE/'binding-controls.json').open('x') as out:
    out.write(json.dumps(result,indent=2)+'\n');out.flush();os.fsync(out.fileno())
print(json.dumps(dict(status='PASS',sourceGuardChecks=len(rows),actualDocker=False)))
