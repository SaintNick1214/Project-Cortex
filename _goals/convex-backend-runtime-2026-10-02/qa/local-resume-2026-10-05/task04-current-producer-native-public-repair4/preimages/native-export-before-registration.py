"""Finite public-only export even on failure; no directory/archive transport."""
import hashlib
import os
from pathlib import Path
import re
import sys
from native_contract import Held, strict,FIELDS

FIXED=('native-binding.json','native-primitives.json','native-node.json','native-node-close.json',
       'native-phase-terminal.json','native-public-result.json','native-resource-raw.json','native-source-final.json',
       'native-child-healthy.stdout','native-child-healthy.stderr','native-child-healthy.terminal.json',
       'stdout-overflow.stdout','stdout-overflow.stderr','stderr-overflow.stdout','stderr-overflow.stderr',
       'timeout.stdout','timeout.stderr','c7-own20.stdout','c7-own20.stderr','c7-own20.terminal.json',
       'producer48.stdout','producer48.stderr','producer48.terminal.json')
MAX_BYTES=570425344
PUBLIC=('public-control-receipt.json','bootstrap-failure.json','input-observations.json','runtime-observations.json',
 'control-run.stdout','control-run.stderr','control-run.terminal.json','node-version.stdout','node-version.stderr','node-version.terminal.json',
 'npm-version.stdout','npm-version.stderr','npm-version.terminal.json','python-version.stdout','python-version.stderr','python-version.terminal.json','resource-observations.json',
 'controls/linux-public-repair2/results.json','controls/linux-public-repair2/partial-results.json','controls/linux-public-repair2/healthy/wiring-actual.stdout',
 'controls/linux-public-repair2/healthy/wiring-actual.stdout.stderr','controls/linux-public-repair2/healthy/consumer-adverse.stdout','controls/linux-public-repair2/healthy/consumer-adverse.stdout.stderr')


def validate_manifest(data):
    """Strict remote receipt boundary before ANY host export member copy."""
    required={'scope','files','fileCount','existingCount','bytes','maxBytes','nativeFunctionalAcceptance',
              'original122','ROOT','runtimeBindingsExpireAtJobEnd'}
    if type(data)is not dict or set(data)!=required or data['scope']!='FINITE_NATIVE_PUBLIC_EXPORT_ONLY' or data['nativeFunctionalAcceptance']is not False or data['original122']!='HELD' or data['ROOT']!='ABSENT' or data['runtimeBindingsExpireAtJobEnd']is not True or data['maxBytes']!=MAX_BYTES or type(data['maxBytes'])is not int or type(data['files'])is not list:
        raise ValueError('STRICT_NATIVE_EXPORT_SCHEMA')
    for key in ('fileCount','existingCount','bytes'):
        if type(data[key])is not int or data[key]<0:raise ValueError('STRICT_NATIVE_EXPORT_INTEGER')
    if data['fileCount']!=len(data['files']) or data['fileCount']>4160 or data['bytes']>MAX_BYTES:raise ValueError('FINITE_NATIVE_EXPORT_COUNTS')
    base='/var/tmp/cortex-task04-native-public/';public='/var/tmp/task04-c8-current-canonical-input-producers/'
    paths=[];raw=[];total=0;existing=0
    for row in data['files']:
        if type(row)is not dict or type(row.get('path'))is not str:raise ValueError('STRICT_NATIVE_EXPORT_ROW')
        path=row['path'];paths.append(path)
        is_raw=re.fullmatch(re.escape(base)+'(python-raw|node-raw)/[0-9a-f]{64}',path)is not None
        allowed=path in {base+n for n in FIXED}|{public+n for n in PUBLIC}|{public+'public-export-manifest.json'} or is_raw
        if not allowed:raise ValueError('UNKNOWN_NATIVE_EXPORT_LITERAL')
        if is_raw:raw.append(path)
        if row.get('status')=='ABSENT':
            if set(row)!={'path','status'} or is_raw:raise ValueError('STRICT_NATIVE_EXPORT_ABSENT')
            continue
        if row.get('status')!='EXISTS' or set(row)!={'path','status','current'}:raise ValueError('STRICT_NATIVE_EXPORT_EXISTS')
        current=row['current']
        if type(current)is not dict or set(current)!={'path','bytes','sha256','PRE','OPEN','POST','pathFINAL','EOF','heldFD'} or current['path']!=path or type(current['bytes'])is not int or current['bytes']<0 or current['bytes']>536870912 or type(current['sha256'])is not str or not re.fullmatch('[0-9a-f]{64}',current['sha256']) or current['EOF']is not True or type(current['heldFD'])is not int or current['heldFD']<0:
            raise ValueError('STRICT_NATIVE_EXPORT_CURRENT')
        for phase in ('PRE','OPEN','POST','pathFINAL'):
            pin=current[phase]
            if type(pin)is not dict or set(pin)!={'schema','fields'} or pin['schema']!='FS_IDENTITY_DECIMAL_V1' or type(pin['fields'])is not dict or set(pin['fields'])!=set(FIELDS):raise ValueError('STRICT_NATIVE_EXPORT_NINE')
            for key,token in pin['fields'].items():
                if type(token)is not str or not re.fullmatch('-?(0|[1-9][0-9]*)',token) or token=='-0' or (token.startswith('-') and key not in ('mtime_ns','ctime_ns')):raise ValueError('STRICT_NATIVE_EXPORT_DECIMAL')
            if pin!=current['PRE']:raise ValueError('NATIVE_EXPORT_CURRENT_PIN_DRIFT')
        fields=current['PRE']['fields']
        if fields['nlink']!='1' or int(fields['mode'])&0o170000!=0o100000 or int(fields['size'])!=current['bytes']:raise ValueError('NATIVE_EXPORT_ORDINARY_SINGLE_LINK')
        if is_raw and current['sha256']!=Path(path).name:raise ValueError('NATIVE_EXPORT_RAW_CONTENT_SHA')
        total+=current['bytes'];existing+=1
    expected=[base+n for n in FIXED]+sorted(p for p in raw if '/python-raw/'in p)+sorted(p for p in raw if '/node-raw/'in p)
    if public+'public-export-manifest.json'in paths:expected+=[public+n for n in PUBLIC]+[public+'public-export-manifest.json']
    if len(raw)>4096 or len(set(paths))!=len(paths) or paths!=expected or total!=data['bytes'] or existing!=data['existingCount']:
        raise ValueError('EXACT_NATIVE_EXPORT_MEMBERSHIP_AND_SUM')
    return data


def manifest(base,public_root,public_manifest):
    rows=[];total=0
    expected=[base/name for name in FIXED]
    raw_files=[]
    for name in ('python-raw','node-raw'):
        directory=base/name
        for path in sorted(directory.iterdir()):
            if not re.fullmatch('[0-9a-f]{64}',path.name):raise ValueError('UNKNOWN_RAW_EXPORT_MEMBER')
            raw_files.append(path)
    if len(raw_files)>4096:raise ValueError('FINITE_RAW_EXPORT_MEMBERSHIP')
    expected+=raw_files
    public_pins={}
    if public_manifest.exists():
        proof=Held(str(public_manifest),65536)
        try:
            os.lseek(proof.fd,0,os.SEEK_SET);data=strict(os.read(proof.fd,65537));proof.fence()
        finally:proof.close()
        if set(data)!={'scope','files','fileCount','existingBytes','combinedExportBytesMaxIncludingThisManifest','primaryFailure','allDescendantsTerminal','nativeClaims','original122','ROOT'}or data['scope']!='FINITE_PUBLIC_SOURCE_CONTROL_EXPORT_ONLY'or data['nativeClaims']is not False or data['ROOT']!='ABSENT'or data['original122']!='HELD'or data['allDescendantsTerminal']is not True or type(data['fileCount'])is not int or data['fileCount']!=23 or type(data['existingBytes'])is not int or data['existingBytes']>1048576:
            raise ValueError('STRICT_PUBLIC23_SCOPE_AND_TERMINAL')
        if tuple(row['relativePath']for row in data['files'])!=PUBLIC:raise ValueError('EXACT_PUBLIC23_EXPORT')
        for row in data['files']:
            path=public_root/row['relativePath']
            if path.is_relative_to(public_root) is not True or '..'in path.parts:raise ValueError('PUBLIC_EXPORT_NONMEMBER')
            if row['status']=='EXISTS':
                if set(row)!={'relativePath','status','current'}or row['current']['path']!=str(path):raise ValueError('STRICT_PUBLIC_EXISTS_ROW')
                public_pins[str(path)]=row['current']
            elif row['status']=='ABSENT':
                if set(row)!={'relativePath','status'}or path.exists()or path.is_symlink():raise ValueError('PUBLIC_ABSENT_ROW_CHANGED')
            else:raise ValueError('UNKNOWN_PUBLIC_EXPORT_STATUS')
            expected.append(path)
        expected.append(public_manifest)
    held=[]
    try:
        for path in expected:
            if not path.exists() and not path.is_symlink():rows.append({'path':str(path),'status':'ABSENT'});continue
            h=Held(str(path),536870912)
            try:held.append(h)
            except BaseException as primary:
                try:h.close()
                except BaseException as cleanup:
                    error=RuntimeError('UNREGISTERED_EXPORT_CLOSE_FAILED_STICKY')
                    error.primaryFailure=primary;error.closeFailures=[cleanup]
                    raise error from primary
                raise
            row=h.row()
            if str(path)in public_pins:
                old=public_pins[str(path)]
                if h.pin!=old['PRE']or(h.size,h.digest)!=(old['bytes'],old['sha256']):raise ValueError('ORIGINAL_CURRENT_PUBLIC_EXPORT_PIN_DRIFT')
            total+=h.size
            if total>MAX_BYTES:raise ValueError('COMBINED_NATIVE_EXPORT_CAP')
            if path in raw_files and h.digest!=path.name:raise ValueError('RAW_EXPORT_CONTENT_SHA')
            rows.append({'path':str(path),'status':'EXISTS','current':row})
        for h in held:h.fence(full=True)
        return {'scope':'FINITE_NATIVE_PUBLIC_EXPORT_ONLY','files':rows,'fileCount':len(rows),
                'existingCount':len(held),'bytes':total,'maxBytes':MAX_BYTES,'nativeFunctionalAcceptance':False,
                'original122':'HELD','ROOT':'ABSENT','runtimeBindingsExpireAtJobEnd':True}
    finally:
        primary=sys.exc_info()[1];owned=held;held=[];failures=[]
        for h in owned:
            try:h.close()
            except BaseException as error:failures.append(error)
        if failures:
            error=RuntimeError('OWNED_EXPORT_CLOSE_FAILED_STICKY')
            error.primaryFailure=primary;error.closeFailures=failures
            raise error from primary
