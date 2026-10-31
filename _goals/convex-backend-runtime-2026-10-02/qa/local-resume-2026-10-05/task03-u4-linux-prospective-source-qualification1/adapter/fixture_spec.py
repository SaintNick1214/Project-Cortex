"""Exact field projection; no permissive label-only resource ownership."""
import re

SUFFIX = '9cef9576a3c1'
WRITER = 'cortex-u4-source-writer-'+SUFFIX
QUALIFIER = 'cortex-u4-source-qualifier-'+SUFFIX
INPUT = 'cortex-u4-source-input-'+SUFFIX
RESULT = 'cortex-u4-source-result-'+SUFFIX
LABELS = {'cortex.source.operation': C.OPERATION, 'cortex.source.scope': 'u4-linux-prospective-source-only',
          'cortex.source.owner': 'root-mac-source-authority'}


def volume(actual, name, expected_path=None):
    if type(actual) is not dict or actual['Name'] != name or actual['Driver'] != 'local':
        raise ValueError('EXACT_OWNED_LOCAL_VOLUME')
    T.exact(actual['Labels'], LABELS)
    if type(actual['Mountpoint']) is not str or not re.fullmatch('/var/lib/docker/volumes/'+re.escape(name)+'/_data', actual['Mountpoint']):
        raise ValueError('EXACT_DAEMON_VOLUME_SOURCE')
    if expected_path is not None and actual['Mountpoint'] != expected_path:
        raise ValueError('CHANGED_VOLUME_PHYSICAL_SOURCE')
    if actual['Options'] not in (None, {}):
        raise ValueError('NO_FOREIGN_VOLUME_DRIVER_OPTIONS')
    return actual['Mountpoint']


def create(name, command, image_env):
    args = ['create','--pull','never','--name',name,'--platform','linux/amd64','--network','none','--memory','2147483648',
        '--memory-swap','2147483648','--pids-limit','128','--read-only','--cap-drop','ALL',
        '--security-opt','no-new-privileges','--init=false','--user','0:0','--workdir','/source-epoch']
    for key in sorted(LABELS): args += ['--label',key+'='+LABELS[key]]
    read_only = name == QUALIFIER
    args += ['--mount','type=volume,source='+INPUT+',target=/source-epoch,volume-nocopy'+(',readonly' if read_only else '')]
    args += ['--mount','type=volume,source='+RESULT+',target=/qualification-result,volume-nocopy']
    args += ['--entrypoint','/usr/bin/python3',C.IMAGE] + command
    return args


def container(actual, name, cid, command, sources, image_env, running=None):
    if type(cid) is not str or not re.fullmatch('[a-f0-9]{64}', cid): raise ValueError('EXACT_CONTAINER_ID')
    fields = {'Id':actual['Id'],'Name':actual['Name'],'Image':actual['Image'],'Platform':actual['Platform'],
        'Config':{k:actual['Config'][k] for k in ('Cmd','Entrypoint','Env','User','Labels','WorkingDir')},
        'HostConfig':{k:actual['HostConfig'][k] for k in ('NetworkMode','Memory','MemorySwap','PidsLimit',
            'ReadonlyRootfs','Privileged','AutoRemove','CapDrop','CapAdd','SecurityOpt','Init','Mounts',
            'Binds','Devices','DeviceRequests','PidMode','IpcMode')},
        'Mounts':[{k:m[k] for k in ('Type','Name','Source','Destination','Driver','RW','Propagation')} for m in actual['Mounts']]}
    mount_specs = [{'Type':'volume','Source':INPUT,'Target':'/source-epoch',
        'ReadOnly':name==QUALIFIER,'VolumeOptions':{'NoCopy':True}},
        {'Type':'volume','Source':RESULT,'Target':'/qualification-result','VolumeOptions':{'NoCopy':True}}]
    # Docker emits ReadOnly:false when explicitly supplied; create() uses the
    # same explicit setting for both mounts so projection is stable and typed.
    mount_specs[1]['ReadOnly'] = False
    expected = {'Id':cid,'Name':'/'+name,'Image':C.IMAGE,'Platform':'linux',
        'Config':{'Cmd':command,'Entrypoint':['/usr/bin/python3'],'Env':image_env,
                  'User':'0:0','Labels':LABELS,'WorkingDir':'/source-epoch'},
        'HostConfig':{'NetworkMode':'none','Memory':2147483648,'MemorySwap':2147483648,'PidsLimit':128,
            'ReadonlyRootfs':True,'Privileged':False,'AutoRemove':False,'CapDrop':['ALL'],
            'CapAdd':None,'SecurityOpt':['no-new-privileges'],'Init':False,'Mounts':mount_specs,
            'Binds':None,'Devices':[],'DeviceRequests':None,'PidMode':'','IpcMode':'private'},
        'Mounts':[{'Type':'volume','Name':INPUT,'Source':sources[INPUT],'Destination':'/source-epoch',
                    'Driver':'local','RW':name!=QUALIFIER,'Propagation':''},
                  {'Type':'volume','Name':RESULT,'Source':sources[RESULT],'Destination':'/qualification-result',
                    'Driver':'local','RW':True,'Propagation':''}]}
    T.exact(fields, expected)
    state = actual['State']
    if type(state['Running']) is not bool or type(state['ExitCode']) is not int or type(state['Status']) is not str:
        raise ValueError('STRICT_TYPED_CONTAINER_STATE')
    if running is not None and state['Running'] is not running:
        raise ValueError('EXPECTED_CONTAINER_RUNNING_STATE')
    return state
