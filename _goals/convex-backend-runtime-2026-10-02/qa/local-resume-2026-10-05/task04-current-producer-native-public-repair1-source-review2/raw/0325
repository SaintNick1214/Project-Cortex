"""Pure exact Docker binding contract; no generic path aliases or release."""
from native_contract import MEMORY


def validate(row,expected,started=False):
    if type(row)is not dict:raise ValueError('EXACT_CONTAINER_OBJECT')
    if row['Id']!=expected['id']or row['Image']!=expected['image']or row['Name']!='/'+expected['name']:
        raise ValueError('EXACT_CONTAINER_ID_IMAGE_NAME')
    config,hc,state=row['Config'],row['HostConfig'],row['State']
    if config['Labels']!=expected['labels']or config['User']!='0:0'or config['WorkingDir']!='/native-source':raise ValueError('EXACT_OWNER_LABEL_UID_WORKDIR')
    if config['Entrypoint']!=['/usr/local/bin/python3.12']or config['Cmd']!=['-B','/native-source/native-controller.py']:raise ValueError('EXACT_NATIVE_KERNEL_LAUNCH_ARGV')
    if config['Env']!=expected['env']:raise ValueError('EXACT_PUBLIC_RUNTIME_ENV')
    required={'Memory':MEMORY,'MemorySwap':MEMORY,'ReadonlyRootfs':True,'NetworkMode':'none','PidsLimit':128,'Privileged':False,'AutoRemove':False,'CapDrop':['ALL']}
    for field,value in required.items():
        if hc[field]!=value:raise ValueError('EXACT_REQUIRED_RESOURCE_'+field)
    if hc['Tmpfs']!={'/tmp':'rw,noexec,nosuid,nodev,size=16777216,mode=0700'}:raise ValueError('EXACT_FINITE_TMPFS')
    if hc.get('Ulimits')!=[{'Name':'nofile','Hard':8192,'Soft':8192}]:raise ValueError('EXACT_SOURCE_FD_LIMIT')
    actual=sorted((m['Type'],m['Source'],m['Destination'],m['RW'])for m in row['Mounts'])
    required_mounts=sorted((m['type'],m['source'],m['target'],m['rw'])for m in expected['mounts'])
    if actual!=required_mounts:raise ValueError('EXACT_FULL_LITERAL_MOUNT_VECTOR')
    config_mounts=hc['Mounts']
    if len(config_mounts)!=len(expected['mounts']):raise ValueError('EXACT_CONFIG_MOUNT_COUNT')
    for m,e in zip(config_mounts,expected['mounts']):
        source=e['name']if e['type']=='volume'else e['source']
        required_fields={'Type':e['type'],'Source':source,'Target':e['target'],'ReadOnly':not e['rw']}
        for k,v in required_fields.items():
            if m[k]!=v:raise ValueError('EXACT_CONFIG_LITERAL_MOUNT')
        if e['type']=='volume'and m.get('VolumeOptions')!={'NoCopy':True}:raise ValueError('VOLUME_NOCOPY_REQUIRED')
    # OomKillDisable is intentionally not part of the assertion. Its null/false
    # daemon-default transition was a preserved monitor failure, not an original cap.
    if state['OOMKilled']or state['Error']:raise ValueError('OWN_CONTAINER_ERROR_OR_OOM')
    if type(state['Pid'])is not int:raise ValueError('STRICT_ACTUAL_PID')
    if not started and(state['Running']or state['Pid']!=0 or state['Status']!='created'):raise ValueError('INSPECT_BEFORE_START')
    return {'scope':'EXACT_REQUIRED_NATIVE_PUBLIC_BINDINGS_ONLY','state':state,'resources':required,'mounts':actual,'id':row['Id']}


def volume(row,name,labels):
    if row['Name']!=name or row['Driver']!='local'or row['Labels']!=labels or row['Options']not in(None,{}):raise ValueError('EXCLUSIVE_OWNED_LOCAL_VOLUME')
    if type(row['Mountpoint'])is not str or not row['Mountpoint'].startswith('/'):raise ValueError('LITERAL_VOLUME_MOUNTPOINT')
    return row['Mountpoint']
