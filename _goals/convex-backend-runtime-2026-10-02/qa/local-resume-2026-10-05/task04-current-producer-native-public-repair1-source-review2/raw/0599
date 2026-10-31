"""Host validation of unchanged PID1 bootstrap's finite public-only export."""
import re
from native_contract import FIELDS
from native_export import PUBLIC
ROOT='/var/tmp/task04-c8-current-canonical-input-producers/'


def validate_public(data):
    required={'scope','files','fileCount','existingBytes','combinedExportBytesMaxIncludingThisManifest',
              'primaryFailure','allDescendantsTerminal','nativeClaims','original122','ROOT'}
    if type(data) is not dict or set(data)!=required or data['scope']!='FINITE_PUBLIC_SOURCE_CONTROL_EXPORT_ONLY':
        raise ValueError('STRICT_PUBLIC_SCHEMA')
    if data['nativeClaims'] is not False or data['allDescendantsTerminal'] is not True or data['original122']!='HELD' or data['ROOT']!='ABSENT':
        raise ValueError('STRICT_PUBLIC_SCOPE_TERMINAL')
    for key in ('fileCount','existingBytes','combinedExportBytesMaxIncludingThisManifest'):
        if type(data[key]) is not int or data[key]<0:raise ValueError('STRICT_PUBLIC_INTEGER')
    if data['fileCount']!=23 or data['combinedExportBytesMaxIncludingThisManifest']!=1048576 or data['existingBytes']>1048576 or type(data['files']) is not list:
        raise ValueError('EXACT_PUBLIC23_CAP')
    total=0;out=[]
    for row,name in zip(data['files'],PUBLIC):
        if type(row) is not dict or row.get('relativePath')!=name:raise ValueError('EXACT_PUBLIC_ROW')
        if row.get('status')=='ABSENT':
            if set(row)!={'relativePath','status'}:raise ValueError('STRICT_PUBLIC_ABSENT')
            out.append({'path':ROOT+name,'status':'ABSENT'});continue
        if row.get('status')!='EXISTS' or set(row)!={'relativePath','status','current'}:raise ValueError('STRICT_PUBLIC_EXISTS')
        current=row['current']
        if type(current) is not dict or set(current)!={'path','bytes','sha256','PRE','OPEN','POST','pathPOST','EOF'} or current['path']!=ROOT+name or type(current['bytes']) is not int or not 0<=current['bytes']<=1048576 or type(current['sha256']) is not str or not re.fullmatch('[0-9a-f]{64}',current['sha256']) or current['EOF'] is not True:
            raise ValueError('STRICT_PUBLIC_CURRENT')
        for phase in ('PRE','OPEN','POST','pathPOST'):
            pin=current[phase]
            if type(pin) is not dict or set(pin)!={'schema','fields'} or pin['schema']!='FS_IDENTITY_DECIMAL_V1' or type(pin['fields']) is not dict or set(pin['fields'])!=set(FIELDS):raise ValueError('STRICT_PUBLIC_NINE')
            for key,token in pin['fields'].items():
                if type(token) is not str or not re.fullmatch('-?(0|[1-9][0-9]*)',token) or token=='-0' or token.startswith('-') and key not in ('mtime_ns','ctime_ns'):raise ValueError('STRICT_PUBLIC_DECIMAL')
            if pin!=current['PRE']:raise ValueError('PUBLIC_NINE_DRIFT')
        fields=current['PRE']['fields']
        if fields['nlink']!='1' or int(fields['mode'])&0o170000!=0o100000 or int(fields['size'])!=current['bytes']:raise ValueError('PUBLIC_ORDINARY_SINGLE_LINK')
        total+=current['bytes'];out.append({'path':ROOT+name,'status':'EXISTS','current':current})
    if len(data['files'])!=23 or total!=data['existingBytes']:raise ValueError('PUBLIC_EXACT_MEMBERSHIP_SUM')
    return out
