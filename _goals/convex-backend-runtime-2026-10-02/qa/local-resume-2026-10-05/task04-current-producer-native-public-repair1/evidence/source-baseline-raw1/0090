"""Strict pre-START actual bindings; only previously proved owned IDs are actionable."""
import re
import uuid
from native_contract import MEMORY


def exact(actual, expected, code):
    if type(actual) is not type(expected):
        raise ValueError(code + ':LITERAL_TYPE')
    if type(expected) is dict:
        if set(actual) != set(expected):
            raise ValueError(code + ':KEYS')
        for key, value in expected.items():
            exact(actual[key], value, code + ':' + key)
    elif type(expected) in (list, tuple):
        if len(actual) != len(expected):
            raise ValueError(code + ':LENGTH')
        for a, e in zip(actual, expected):
            exact(a, e, code)
    elif actual != expected:
        raise ValueError(code + ':VALUE')


def validate(row, expected, started=False):
    exact(started, bool(started), 'STRICT_STARTED_MODE')
    if type(row) is not dict or type(expected) is not dict:
        raise ValueError('EXACT_CONTAINER_OBJECT')
    for key in ('id', 'image', 'name', 'phase'):
        if type(expected[key]) is not str:
            raise ValueError('STRICT_EXPECTED_BINDING')
    if not re.fullmatch('[0-9a-f]{64}', expected['id']) or not re.fullmatch('sha256:[0-9a-f]{64}', expected['image']):
        raise ValueError('LITERAL_IMMUTABLE_ID_IMAGE')
    if expected['phase'] not in ('native20', 'public48'):
        raise ValueError('EXACT_TWO_PHASES')
    labels = expected['labels']
    if type(labels) is not dict or any(type(k) is not str or type(v) is not str for k, v in labels.items()):
        raise ValueError('STRICT_OWNER_LABELS')
    operation = labels['cortex.operation']
    if str(uuid.UUID(operation)) != operation or uuid.UUID(operation).version != 4:
        raise ValueError('LITERAL_UUID4_OWNER')
    if labels['cortex.phase'] != expected['phase'] or labels['cortex.owner'] != 'native-public-repair1':
        raise ValueError('EXACT_PHASE_OWNER')
    exact(row['Id'], expected['id'], 'EXACT_CONTAINER_ID')
    exact(row['Image'], expected['image'], 'EXACT_CONTAINER_IMAGE')
    exact(row['Name'], '/' + expected['name'], 'EXACT_CONTAINER_NAME')
    exact(row['Platform'], 'linux', 'EXACT_PLATFORM')
    config, hc, state = row['Config'], row['HostConfig'], row['State']
    if any(type(v) is not dict for v in (config, hc, state)):
        raise ValueError('STRICT_CONTAINER_SUBOBJECTS')
    if type(expected['env'])is not list or any(type(v)is not str for v in expected['env']):
        raise ValueError('STRICT_EXPECTED_ENV')
    command = '/native-source/native-controller.py' if expected['phase'] == 'native20' else '/reviewed-bootstrap.py'
    for key, value in {'Labels': labels, 'User': '0:0', 'WorkingDir': '/native-source',
                       'Entrypoint': ['/usr/local/bin/python3.12'], 'Cmd': ['-B', command],
                       'Env': expected['env']}.items():
        exact(config[key], value, 'EXACT_CONFIG_' + key)
    required = {'Memory': MEMORY, 'MemorySwap': MEMORY, 'ReadonlyRootfs': True,
                'NetworkMode': 'none', 'PidsLimit': 128, 'Privileged': False,
                'AutoRemove': False, 'CapDrop': ['ALL'], 'PidMode': '',
                'IpcMode': 'private', 'UTSMode': '', 'CgroupnsMode': 'private',
                'Init': False, 'SecurityOpt': ['no-new-privileges'],
                'Tmpfs': {'/tmp': 'rw,noexec,nosuid,nodev,size=16777216,mode=0700'},
                'Ulimits': [{'Name': 'nofile', 'Hard': 8192, 'Soft': 8192}]}
    for key, value in required.items():
        exact(hc[key], value, 'EXACT_REQUIRED_' + key)
    mounts = expected['mounts']
    if type(mounts) is not list or len(mounts) != (9 if expected['phase'] == 'native20' else 8):
        raise ValueError('EXACT_PHASE_MOUNT_COUNT')
    if type(row['Mounts']) is not list or len(row['Mounts']) != len(mounts):
        raise ValueError('EXACT_ACTUAL_MOUNT_COUNT')
    actual_by_target = {}
    for mount in row['Mounts']:
        if type(mount) is not dict or type(mount['Destination']) is not str or mount['Destination'] in actual_by_target:
            raise ValueError('STRICT_UNIQUE_ACTUAL_MOUNT')
        actual_by_target[mount['Destination']] = mount
    exact(sorted(actual_by_target), sorted(m['target'] for m in mounts), 'EXACT_LITERAL_TARGETS')
    if type(hc['Mounts']) is not list or len(hc['Mounts']) != len(mounts):
        raise ValueError('EXACT_CONFIG_MOUNT_COUNT')
    for configured, owned in zip(hc['Mounts'], mounts):
        if type(owned)is not dict or type(owned['rw'])is not bool or any(type(owned[k])is not str for k in ('type','source','target')) or owned['type']not in ('bind','volume'):
            raise ValueError('STRICT_LITERAL_EXPECTED_MOUNT_TYPES')
        if owned['rw']is not (owned['type']=='volume') or not owned['source'].startswith('/') or not owned['target'].startswith('/'):
            raise ValueError('STRICT_LITERAL_EXPECTED_MOUNT_MODE')
        actual = actual_by_target[owned['target']]
        for key, value in {'Type': owned['type'], 'Source': owned['source'],
                           'Destination': owned['target'], 'RW': owned['rw']}.items():
            exact(actual[key], value, 'EXACT_ACTUAL_MOUNT_' + key)
        source = owned['name'] if owned['type'] == 'volume' else owned['source']
        fields = {'Type': owned['type'], 'Source': source, 'Target': owned['target'], 'ReadOnly': not owned['rw']}
        for key, value in fields.items():
            exact(configured[key], value, 'EXACT_CONFIG_MOUNT_' + key)
        if owned['type'] == 'volume':
            exact(actual['Name'], owned['name'], 'EXACT_VOLUME_NAME')
            exact(actual['Driver'], 'local', 'EXACT_VOLUME_DRIVER')
            exact(configured['VolumeOptions'], {'NoCopy': True}, 'EXACT_VOLUME_NOCOPY')
        else:
            exact(actual['Propagation'], 'rprivate', 'EXACT_PRIVATE_BIND_PROPAGATION')
    exact(state['OOMKilled'], False, 'OWN_CONTAINER_OOM')
    exact(state['Error'], '', 'OWN_CONTAINER_ERROR')
    if type(state['Pid']) is not int or type(state['Running']) is not bool or type(state['ExitCode']) is not int:
        raise ValueError('STRICT_ACTUAL_STATE_TYPES')
    if not started:
        exact(state['Running'], False, 'INSPECT_BEFORE_START_RUNNING')
        exact(state['Pid'], 0, 'INSPECT_BEFORE_START_PID')
        exact(state['Status'], 'created', 'INSPECT_BEFORE_START_STATUS')
    elif state['Running']:
        if state['Pid'] <= 0 or state['Status'] != 'running':
            raise ValueError('STRICT_RUNNING_STATE')
    elif state['Pid'] != 0 or state['Status'] not in ('exited', 'created'):
        raise ValueError('STRICT_TERMINAL_STATE')
    return {'scope': 'EXACT_PHASE_OWNED_BINDINGS_ONLY', 'phase': expected['phase'],
            'state': state, 'resources': required, 'id': row['Id']}


def volume(row, name, labels):
    if type(row) is not dict:
        raise ValueError('STRICT_VOLUME_OBJECT')
    for key, value in {'Name': name, 'Driver': 'local', 'Labels': labels, 'Scope': 'local'}.items():
        exact(row[key], value, 'EXCLUSIVE_OWNED_VOLUME_' + key)
    if row['Options'] is not None:
        exact(row['Options'], {}, 'EXACT_EMPTY_VOLUME_OPTIONS')
    if type(row['Mountpoint']) is not str or not row['Mountpoint'].startswith('/'):
        raise ValueError('LITERAL_VOLUME_MOUNTPOINT')
    return row['Mountpoint']
