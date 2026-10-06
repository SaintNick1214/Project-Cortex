"""Exact reviewed-recipe guards, separate ownership-only cleanup, no effects."""
import json

def require(ok, reason):
    if not ok:
        raise ValueError(reason)

def same(actual, expected):
    return json.dumps(actual, sort_keys=True, separators=(',', ':')) == json.dumps(expected, sort_keys=True, separators=(',', ':'))

def own(c, recipe, cid):
    require(type(cid) is str and len(cid) == 64 and all(x in '0123456789abcdef' for x in cid), 'exact created ID')
    labels = recipe['ownershipBeforeEffects']['containerInspectBeforeStart']['Config.Labels']
    require(c['Id'] == cid and c['Name'] == '/' + recipe['containerName'] and same(c['Config']['Labels'], labels), 'exact owned ID/name/five labels')
    require(labels['com.cortex.operation'] == recipe['operationUUID'], 'same reviewed UUID')
    return {'Id': cid, 'operationUUID': recipe['operationUUID']}

def validate(c, recipe, cid, created=False):
    own(c, recipe, cid)
    guard = recipe['ownershipBeforeEffects']['containerInspectBeforeStart']
    config = c['Config']; host = c['HostConfig']; state = c['State']
    for dotted, expected in guard.items():
        if dotted == 'Mounts' or dotted.startswith('State.'):
            continue
        actual = c
        for part in dotted.split('.'):
            actual = actual[part]
        require(same(actual, expected), 'exact required guard:' + dotted)
    require(config['User'] == '0:0' and config['Image'] == recipe['imageID'], 'exact user/image')
    require(c['Path'] == '/usr/local/bin/python3.12' and c['Args'] == config['Cmd'], 'fixed entrypoint')
    require(host['CapAdd'] is None and host['Devices'] == [] and host['DeviceRequests'] is None and host['AutoRemove'] is False and host['Binds'] is None and host['VolumesFrom'] is None, 'no extra capability/device/mount/remove')
    require(same(host['RestartPolicy'], {'Name':'no','MaximumRetryCount':0}), 'no restart')
    require(host.get('OomKillDisable') is None or host.get('OomKillDisable') is False, 'only observed unset OOM field representations')
    require(host['Tmpfs'] == {'/tmp':'rw,nosuid,nodev,size=16777216,mode=1777'}, 'exact one tmpfs')
    table = recipe['finiteBindCoordinateTable']
    require(len(table) == 6 and all(r['ReadOnly'] is True for r in table), 'exact six source rows')
    hm = host['Mounts']; am = c['Mounts']
    require(len(hm) == len(am) == 7, 'exact seven mounts')
    hb = [x for x in hm if x['Type'] == 'bind']; ab = [x for x in am if x['Type'] == 'bind']
    require(len(hb) == len(ab) == 6, 'exact six binds')
    hset = {(x['Source'], x['Target']) for x in hb}; aset = {(x['Source'], x['Destination']) for x in ab}
    matched = [key for key in ('hostSourceLiteral','desktopSourceLiteral') if hset == aset == {(x[key],x['destination']) for x in table}]
    require(len(matched) == 1, 'one complete enumerated coordinate choice; no mixed or general aliases')
    require(all(x['ReadOnly'] is True for x in hb) and all(x['RW'] is False and x['Propagation'] == 'rprivate' for x in ab), 'readonly private binds')
    hv = [x for x in hm if x['Type'] == 'volume']; av = [x for x in am if x['Type'] == 'volume']; name = recipe['exclusiveNewVolume']
    require(same(hv, [{'Type':'volume','Source':name,'Target':'/var/tmp','VolumeOptions':{'NoCopy':True}}]), 'exact nocopy volume')
    require(len(av) == 1 and av[0]['Name'] == name and av[0]['Driver'] == 'local' and av[0]['Destination'] == '/var/tmp' and av[0]['Source'] == '/var/lib/docker/volumes/' + name + '/_data' and av[0]['RW'] is True, 'one exact owned RW backing')
    env = config['Env']; require(len({x.split('=',1)[0] for x in env}) == len(env), 'unique env')
    values = dict(x.split('=',1) for x in env)
    require(values == {'PYTHONDONTWRITEBYTECODE':'1','HOME':'/var/tmp/task04-c8-producer-repair1/home','PATH':'/usr/local/bin:/usr/bin:/bin','TMPDIR':'/tmp','LANG':'C.UTF-8','GPG_KEY':'7169605F62C751356D054A26A821E680E5FA6305','PYTHON_VERSION':'3.12.15','PYTHON_SHA256':'c2c4321961fab0fb999d66e0cecf521c2ab3994c7992873ea99e306c1094fd5a'}, 'fixed public env')
    require(config['Volumes'] is None and config['WorkingDir'] == '/var/tmp/cortex-native-c8-prospective-preparation', 'immutable default cwd/no volumes')
    require(c['ImageManifestDescriptor']['platform'] == {'architecture':'amd64','os':'linux'}, 'fixed emulated image platform')
    require(set(c['NetworkSettings']['Networks']) == {'none'} and c['NetworkSettings']['Ports'] == {}, 'no network/ports')
    require(type(state['Running']) is bool and type(state['Pid']) is int and type(state['ExitCode']) is int and type(state['OOMKilled']) is bool and type(state['Error']) is str, 'exact state types')
    if created:
        require(state['Status'] == 'created' and state['Running'] is False and state['Pid'] == 0 and state['ExitCode'] == 0 and state['OOMKilled'] is False and state['Error'] == '' and state['StartedAt'] == state['FinishedAt'] == '0001-01-01T00:00:00Z' and type(c['RestartCount']) is int and c['RestartCount'] == 0, 'never started')
    return {'containerId':cid,'operationUUID':recipe['operationUUID'],'coordinateChoice':matched[0],'requiredGuards':'PASS','observedExtraOomKillDisable':host.get('OomKillDisable'),'extraValueIsNotNormalizedOrRequired':True}
