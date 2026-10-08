"""Explicit Root held-source entry; C is a verified held dependency.

Root qualifies the manifest/approval/release headers prospectively first. This
entry never substitutes a Linux artifact for an existing Mac G/B3/Root gate.
"""
import types


def run_from_closed_headers(rows,ledger,directory,manifest_sha256,approval_sha256,source_fs=None):
    """Concrete Root entry after C/this entry were independently held-verified.

    The caller supplies the SAME existing cumulative ledger, never a reset.
    All four Source headers are owned and opened before any header body read.
    This API cannot substitute for G/B3 or establish an upstream Mac gate.
    """
    if type(rows)is not list or len(rows)!=4 or {r['name'] for r in rows}!={'manifest','approval','release','sender'}:
        raise ValueError('EXACT_FOUR_ROOT_SOURCE_HEADERS')
    limits={'manifest':4194304,'approval':262144,'release':65536,'sender':65536}
    for row in rows:C.integer(row['bytes'],0,limits[row['name']],'ROOT_SOURCE_HEADER_FINITE_CAP')
    source=C.Cohort([dict(r,expectedNine=r['PRE9'],kind='ROOT_SOURCE_HEADER') for r in rows],ledger,owner=(501,20),fs=source_fs)
    error=None;result=None;closed=None
    try:
        source.open_all();bodies=source.read_all();by_name={r['name']:r for r in rows}
        raw=lambda name:bodies[by_name[name]['path']]
        if C.digest(raw('manifest'))!=manifest_sha256 or C.digest(raw('approval'))!=approval_sha256:
            raise ValueError('ROOT_KNOWN_INDEPENDENT_MANIFEST_APPROVAL_HASHES')
        manifest=C.strict(raw('manifest'));approval=C.strict(raw('approval'));release=C.strict(raw('release'))
        if (approval['scope']!='TASK03_U4_LINUX_ADAPTER_INDEPENDENT_SOURCE_ONLY' or approval['verdict']!='PASS' or
            approval['independent']is not True or approval['sourceManifestSha256']!=manifest_sha256 or
            approval['sourceManifestOriginalNine']!=by_name['manifest']['PRE9']):
            raise ValueError('EXACT_FRESH_INDEPENDENT_ADAPTER_SOURCE_APPROVAL')
        expected={r['path']:r['sha256'] for r in manifest['runtimeSourceInputs']}
        if approval['runtimeSources']!=expected:raise ValueError('COMPLETE_REVIEWED_RUNTIME_SOURCE_SET')
        # Header custody remains held through every child and all original
        # Source phase lifetimes. Late sender bytes are reacquired under their
        # same current pin by the source lease and charge no second admission.
        result=run(manifest,manifest_sha256,approval_sha256,release,ledger,directory,[by_name['sender']],source_fs=source_fs)
    except BaseException as failure:error=failure
    finally:closed=source.final_and_close(error)
    if error is not None or closed['closeErrors']:raise C.SourceFailure(closed['closeErrors']) from error
    result['rootHeaderClose']=closed
    return result


class Lease:
    def __init__(self, manifest, manifest_sha256, approval_sha256, ledger, late_rows,source_fs=None):
        if manifest['scope']!='TASK03_U4_LINUX_ADAPTER_PROSPECTIVE_SOURCE_CLOSURE_ONLY':
            raise ValueError('EXACT_NEW_ADAPTER_SOURCE_SCOPE')
        if manifest['operation']!=C.OPERATION or manifest['writers']!='STOPPED':
            raise ValueError('GENUINE_CLOSED_SOURCE_OPERATION')
        if manifest['remainingSourceWrites']!=[] or manifest['sourceEligibility'] is not False:
            raise ValueError('AUTHOR_PACKET_CANNOT_ENABLE_ITSELF')
        self.manifest_sha256=manifest_sha256; self.approval_sha256=approval_sha256
        self.manifest=manifest; self.ledger=ledger; self.closed=False; self.modules={}
        rows=[dict(row,expectedNine=row['PRE9']) for row in manifest['runtimeSourceInputs']]
        if len({row['name'] for row in rows})!=len(rows): raise ValueError('DUPLICATE_RUNTIME_SOURCE_NAME')
        self.cohort=C.Cohort(rows,ledger,owner=(501,20),fs=source_fs)
        self.late=None
        self.bodies=None; error=None
        try:
            self.cohort.open_all(); self.bodies=self.cohort.read_all()
            for entry in self.cohort.owned:
                if max(int(entry['pin']['mtime_ns']),int(entry['pin']['ctime_ns']))>int(manifest['sourceStoppedUnixNs']):
                    raise ValueError('LATE_SOURCE_AFTER_STOP')
            self.by_name={row['name']:row for row in rows}
            specs=manifest['lateSourceInputSpecs']
            if len(late_rows)!=len(specs) or {r['name'] for r in late_rows}!={r['name'] for r in specs}:
                raise ValueError('COMPLETE_LATE_SOURCE_DATA_SET')
            for row in late_rows:
                spec=next(s for s in specs if s['name']==row['name'])
                if row['path']!=spec['path'] or type(row['bytes']) is not int or not 0<=row['bytes']<=spec['maximumBytes']:
                    raise ValueError('LATE_SOURCE_DATA_PATH_CAP')
                C.valid_nine(row['PRE9'])
            self.late=C.Cohort([dict(r,expectedNine=r['PRE9'],kind='ROOT_LATE_SOURCE_ENABLING_DATA') for r in late_rows],ledger,owner=(501,20),fs=source_fs)
            self.late.open_all(); self.bodies.update(self.late.read_all())
            self.by_name.update({r['name']:r for r in late_rows})
        except BaseException as failure:
            error=failure
        if error is not None:
            check=self.close(error)
            raise C.SourceFailure(check['closeErrors']) from error

    def check(self):
        if self.closed: raise ValueError('SOURCE_LEASE_ALREADY_CLOSED')
        for entry in self.cohort.owned:
            if entry['fd'] is None or C.nine(self.cohort.fs.fstat(entry['fd']))!=entry['pin'] or C.nine(self.cohort.fs.lstat(entry['row']['path']))!=entry['pin']:
                raise ValueError('CURRENT_HELD_ROOT_MAC_SOURCE_NINE')
        if self.late is not None:
            for entry in self.late.owned:
                if entry['fd'] is None or C.nine(self.late.fs.fstat(entry['fd']))!=entry['pin'] or C.nine(self.late.fs.lstat(entry['row']['path']))!=entry['pin']:
                    raise ValueError('CURRENT_HELD_ROOT_LATE_SOURCE_DATA_NINE')

    def raw(self,name):
        self.check(); return self.bodies[self.by_name[name]['path']]

    def module(self,name,dependencies):
        if name in self.modules: raise ValueError('NO_LIVE_MODULE_REPLACEMENT_OR_CACHE_FALLBACK')
        row=self.by_name[name]; module=types.ModuleType('held_'+name); module.__file__=row['path']
        module.__dict__.update(dependencies)
        exec(compile(self.raw(name),row['path'],'exec',dont_inherit=True),module.__dict__)
        self.modules[name]=module
        self.check(); return module

    def close(self,primary=None):
        if self.closed: raise ValueError('SOURCE_LEASE_CLOSE_RETRY_FORBIDDEN')
        self.closed=True
        late=None;main=None;failures=[]
        if self.late is not None:
            try:late=self.late.final_and_close(primary)
            except BaseException as error:failures.append(repr(error))
        try:main=self.cohort.final_and_close(primary)
        except BaseException as error:failures.append(repr(error))
        if main is None:main={'closeErrors':[],'sourceEligibility':False,'runtimeAuthority':False}
        main['closeErrors']+=failures
        if late is not None:
            main['lateDataClose']=late; main['closeErrors']+=late['closeErrors']
        return main


def run(manifest,manifest_sha256,approval_sha256,release,ledger,directory,late_rows,source_fs=None):
    """The caller owns qualified header custody; this function owns all sources."""
    lease=None; primary=None; result=None; closed=None
    try:
        lease=Lease(manifest,manifest_sha256,approval_sha256,ledger,late_rows,source_fs=source_fs)
        T=lease.module('T',{'C':C}); S=lease.module('S',{'C':C,'T':T})
        L=lease.module('L',{'C':C})
        common_row=lease.by_name['M']; common_entry=next(e for e in lease.cohort.owned if e['row']['name']=='M')
        anchor={'bootstrap':lease.raw('A').decode(),'fd':common_entry['fd'],
            'row':{'path':common_row['path'],'PRE9':common_entry['pin'],'bytes':common_row['bytes'],'sha256':common_row['sha256']}}
        M=lease.module('M',{'SOURCE_ANCHOR':anchor})
        D=lease.module('D',{'C':C,'T':T,'S':S,'L':L,'M':M})
        carry=C.strict(lease.raw('carry')); wire=C.strict(lease.raw('wire')); proof=C.strict(lease.raw('proof'))
        if proof['carrySha256']!=C.digest(lease.raw('carry')) or wire['macCarrySha256']!=C.digest(lease.raw('carry')):
            raise ValueError('EXACT_CARRY_WIRE_ORIGINAL113_PROOF_DIGEST')
        result=D.execute(release,lease,ledger,carry,wire,proof,
            {'C':lease.raw('C'),'Q':lease.raw('Q'),'B':lease.raw('B'),'carry':lease.raw('carry'),'wire':lease.raw('wire')},directory,C.strict(lease.raw('sender')))
    except BaseException as error:
        primary=error
    finally:
        if lease is not None: closed=lease.close(primary)
    if primary is not None or (closed is not None and closed['closeErrors']):
        raise C.SourceFailure(([repr(primary)] if primary else [])+(closed['closeErrors'] if closed else [])) from primary
    result['rootSourceLeaseClose']=closed
    result['sourceEligibility']=False; result['runtimeAuthority']=False
    return result
