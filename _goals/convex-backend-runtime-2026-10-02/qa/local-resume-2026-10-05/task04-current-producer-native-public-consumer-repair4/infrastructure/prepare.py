"""Finite repaired candidate generation. Importing this recipe causes no writes.

The two changed producer programs come from R4; the other 110 come from exact
R3 references. This replaces the old C5 generator's finite candidate-generation
stage without reacquiring/copying its unrelated historical evidence graph.
The reviewed caller must compile this recipe from held verified source bytes.
"""
import hashlib,json,math,os,stat,sys,time
from pathlib import Path

N=Path(__file__).resolve().parents[1];R=N.parent.parents[3]
FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
MAX_FILES=4096;MAX_BYTES=67108864;MAX_FILE=16777216

def ident(value):return {key:str(getattr(value,'st_'+key))for key in FIELDS}

def strict(raw):
    def pairs(values):
        result={}
        for key,value in values:
            if key in result:raise ValueError('DUPLICATE_PREPARATION_KEY')
            result[key]=value
        return result
    def nonfinite(_):raise ValueError('NONFINITE_PREPARATION_VALUE')
    def floating(token):
        value=float(token)
        if not math.isfinite(value):raise ValueError('NONFINITE_PREPARATION_VALUE')
        return value
    return json.loads(raw,object_pairs_hook=pairs,parse_float=floating,parse_constant=nonfinite)

def render_candidate(plan,source_bytes):
    """The actual generated source map is also the source-control input map."""
    if plan['scope']!='TASK04_REPAIR4_FINITE_GENERATED_CANDIDATE_INPUT_DESIGN_ONLY' or plan['sourceOnly']is not True or plan['runtimeAuthority']is not False or plan['sourceEligibility']is not False:raise ValueError('NO_PREPARATION_AUTHORITY_ALIAS')
    if plan['fileCount']!=112 or len(plan['files'])!=112:raise ValueError('ORIGINAL112_CANDIDATE_COUNT')
    old=plan['originalManifest'];old_by={row['path']:row for row in old['files']}
    if len(old_by)!=112 or {row['path']for row in plan['files']}!=set(old_by):raise ValueError('ORIGINAL112_EXACT_NAMES')
    result={};changed=[];mf=[]
    for row in plan['files']:
        name=row['path'];path=Path(name)
        if path.is_absolute()or '..'in path.parts or str(path)!=name:raise ValueError('EXACT_CANDIDATE_RELATIVE_PATH')
        raw=source_bytes[row['sourcePath']]
        if type(raw)is not bytes or len(raw)!=row['bytes']or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ValueError('EXACT_SOURCE_REFERENCE_BYTES')
        if (len(raw),row['sha256'])!=(old_by[name]['bytes'],old_by[name]['sha256']):changed.append(name)
        result[name]=raw;mf.append({'path':name,'bytes':len(raw),'sha256':row['sha256']})
    if changed!=['ci-run.py','native_export.py'] or plan['unchangedFromR3']!=110 or plan['unchangedFromOriginalR1']!=109:raise ValueError('EXACT_TWO_NEW_REPAIRS_THREE_ORIGINAL_DELTAS')
    manifest={**old,'files':mf,'sourceBytes':sum(row['bytes']for row in mf)}
    result['source-manifest.json']=(json.dumps(manifest,sort_keys=True,separators=(',',':'))+'\n').encode()
    return result

def close_owned(rows):
    primary=sys.exc_info()[1];failures=[]
    for row in rows:
        fd=row.pop('fd',None)
        if fd is None:continue
        try:os.close(fd)
        except BaseException as error:failures.append((row['path'],fd,error))
    if failures:
        error=RuntimeError('PREPARATION_SOURCE_CLOSE_FAILED_STICKY')
        error.primaryFailure=primary;error.closeFailures=failures
        raise error from primary

def acquire_sources(plan,control_bytes=0,control_paths=0):
    # One cumulative unique-path ledger including plan data, never per subgroup.
    refs={str(R/row['repositoryRelativeSourcePath']):{'bytes':row['bytes'],'sha256':row['sha256'],'logicalPath':row['sourcePath']}for row in plan['files']}
    for ref in (plan['sourceManifestTemplate'],plan['original100ConservationReference'],plan['oldGeneratorReference']):refs[str(R/ref['repositoryRelativePath'])]={**ref,'logicalPath':ref['path']}
    if type(control_bytes)is not int or type(control_paths)is not int or control_bytes<0 or control_paths<0 or len(refs)+control_paths>MAX_FILES:raise ValueError('ONE_SOURCE_PATH_CEILING')
    owned=[];total=control_bytes
    try:
        for path in sorted(refs):
            p=Path(path)
            if not p.is_absolute()or p.resolve()!=p:raise ValueError('EXACT_NO_ALIAS_SOURCE_PATH')
            pin=ident(p.lstat());size=int(pin['size']);total+=size
            if not stat.S_ISREG(int(pin['mode']))or pin['nlink']!='1' or not 0<=size<=MAX_FILE or total>MAX_BYTES:raise ValueError('ONE_SOURCE_GRAPH_CAP')
            if time.time_ns()-max(int(pin['mtime_ns']),int(pin['ctime_ns']))<60000000000:raise ValueError('SOURCE_MUST_BE_MATURE60')
            row={'path':path,'pin':pin,'fd':None};fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
            try:row['fd']=fd;owned.append(row)
            except BaseException as primary:
                row.pop('fd',None)
                try:os.close(fd)
                except BaseException as cleanup:raise RuntimeError('PREPARATION_UNREGISTERED_CLOSE_FAILED')from primary
                raise
        # Every descriptor precedes the first body read.
        bodies={};observations=[]
        for row in owned:
            p=Path(row['path']);fd=row['fd'];pin=row['pin'];parts=[]
            if ident(os.fstat(fd))!=pin or ident(p.lstat())!=pin:raise ValueError('OPEN_SOURCE_NINE_DRIFT')
            size=0;digest=hashlib.sha256()
            while block:=os.read(fd,65536):
                size+=len(block)
                if size>int(pin['size'])or size>MAX_FILE:raise ValueError('SOURCE_READ_CAP')
                digest.update(block);parts.append(block)
            expected=refs[row['path']]
            if size!=int(pin['size'])or (size,digest.hexdigest())!=(expected['bytes'],expected['sha256']):raise ValueError('FULL_SOURCE_EOF_HASH_SIZE')
            if ident(os.fstat(fd))!=pin or ident(p.lstat())!=pin:raise ValueError('FINAL_SOURCE_NINE_DRIFT')
            bodies[expected['logicalPath']]=b''.join(parts);observations.append({'path':row['path'],'PRE':pin,'OPEN':pin,'POST':pin,'pathFINAL':pin,'bytes':size,'sha256':digest.hexdigest(),'EOF':True})
        rendered=render_candidate(plan,bodies)
        template=plan['sourceManifestTemplate'];old=strict(bodies[template['path']])
        if old!=plan['originalManifest']:raise ValueError('EXACT_ORIGINAL_MANIFEST_REFERENCE')
        for row in owned:
            if ident(os.fstat(row['fd']))!=row['pin']or ident(Path(row['path']).lstat())!=row['pin']:raise ValueError('HELD_THROUGH_GENERATION_NINE_DRIFT')
        return rendered,observations
    finally:close_owned(owned)

def materialize(plan,control_bytes=0,control_paths=0):
    """Explicit future reviewed source-generation step; no service/native effects."""
    destination=N/'runtime-stage/generated-candidate'
    if R/plan['destinationRelative']!=destination or destination.exists():raise ValueError('NEW_EXACT_OWNED_SOURCE_DESTINATION_ONLY')
    rendered,observations=acquire_sources(plan,control_bytes,control_paths)
    # Generation follows completed source qualification and all attempted closes.
    destination.mkdir(parents=True,exist_ok=False)
    for name,raw in rendered.items():
        path=destination/'source'/name;path.parent.mkdir(parents=True,exist_ok=True)
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        try:
            view=memoryview(raw)
            while view:
                written=os.write(fd,view)
                if written<=0:raise ValueError('FULL_SOURCE_WRITE')
                view=view[written:]
            os.fsync(fd)
        finally:os.close(fd)
    return {'scope':'GENERATED_SOURCE_CANDIDATE_ONLY_NOT_NATIVE_ACCEPTANCE','fileCount':112,'manifestCompanion':1,'sourceInputs':observations,'runtimeAuthority':False,'sourceEligibility':False,'original100Copied':False}

def prepare():
    """Finite plan header stays held and charged through the complete source stage."""
    path=N/'candidate-source-plan.json';pin=ident(path.lstat());owned=[]
    if int(pin['size'])>MAX_FILE or not stat.S_ISREG(int(pin['mode']))or pin['nlink']!='1':raise ValueError('FINITE_ORDINARY_PLAN_HEADER')
    if time.time_ns()-max(int(pin['mtime_ns']),int(pin['ctime_ns']))<60000000000:raise ValueError('PLAN_HEADER_MATURE60')
    row={'path':str(path),'fd':None};fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        try:row['fd']=fd;owned.append(row)
        except BaseException as primary:
            row.pop('fd',None)
            try:os.close(fd)
            except BaseException as cleanup:raise RuntimeError('PLAN_UNREGISTERED_CLOSE_FAILED')from primary
            raise
        if ident(os.fstat(fd))!=pin:raise ValueError('PLAN_OPEN_NINE_DRIFT')
        parts=[];size=0
        while block:=os.read(fd,65536):
            size+=len(block)
            if size>int(pin['size'])or size>MAX_FILE:raise ValueError('PLAN_FULL_READ_CAP')
            parts.append(block)
        if size!=int(pin['size'])or ident(os.fstat(fd))!=pin or ident(path.lstat())!=pin:raise ValueError('PLAN_FULL_EOF_FINAL_NINE')
        result=materialize(strict(b''.join(parts)),control_bytes=size,control_paths=1)
        if ident(os.fstat(fd))!=pin or ident(path.lstat())!=pin:raise ValueError('PLAN_HELD_THROUGH_SOURCE_GENERATION')
        return result
    finally:close_owned(owned)

if __name__=='__main__':
    if sys.argv[1:]!=['--prepare-source-only']:raise ValueError('EXPLICIT_FINITE_SOURCE_PREPARATION_COMMAND_REQUIRED')
    print(json.dumps(prepare(),separators=(',',':')))
