"""Collector/G/Root SOURCE seam; no effects and no independent authority.

The caller supplies the existing Root ledger and already held bootstrap bodies.
No ledger is constructed here. A5 and all downstream adapters require external
review before this proposed interface is usable outside SOURCE/mock controls.
"""
import copy
import hashlib
import json
import math
import os
from pathlib import Path
import stat
import time
from dataclasses import dataclass

SCOPE = 'TASK03_OPERATIVE_SOURCE_ADAPTERS1_SOURCE_MEMBERS_ONLY'
FIELDS = ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
CAPS = {'paths':4096,'bytes':67108864,'file':16777216,'MF':4194304,
        'approval':1048576,'DATA':2097152}

class Denied(RuntimeError):
    pass

class Failures(BaseException):
    """Python 3.9-compatible retention of every original BaseException."""
    def __init__(self, failures):
        self.failures = tuple(failures)
        super().__init__('; '.join(stage+':'+type(error).__name__+':'+str(error)
                                  for stage,error in self.failures))

def nine(s):
    return {k:str(getattr(s,'st_'+k)) for k in FIELDS}

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def encode(value):
    return (json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n').encode()

def strict_json(raw):
    def pairs(items):
        result={}
        for key,value in items:
            if key in result: raise Denied('duplicate_JSON_key')
            result[key]=value
        return result
    def nonfinite(_value): raise Denied('nonfinite_JSON')
    def floating(value):
        parsed=float(value)
        if not math.isfinite(parsed): raise Denied('nonfinite_JSON')
        return parsed
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=nonfinite,parse_float=floating)

@dataclass(frozen=True)
class Bootstrap:
    row: dict
    raw: bytes

@dataclass(frozen=True)
class RuntimePermit:
    authority: object
    view_sha256: str
    adapter_sha256: str
    phase_sha256: str

@dataclass(frozen=True)
class SourceView:
    recipe: dict
    rows: tuple
    custody_rows: tuple
    view_sha256: str
    phase_sha256: str
    bootstrap_admissions: tuple
    witness: object

def source_view(api, ledger, bootstrap, external_partition_verifier,
                external_held_bootstrap_verifier):
    """Derive exact current SOURCE rows; no pathname or custody-body read.

    Bootstrap must contain recipe/proof/A5 module, already FD-held and charged
    by Root. Neither an author JSON PASS nor this function supplies authority.
    The independent nonuse proof also binds all five downstream adapter seams.
    """
    if api.CAPS != CAPS or set(bootstrap) != {'recipe','proof','phase'}:
        raise Denied('exact_bootstrap_and_original_caps')
    if ledger.unknown_close:raise Denied('sticky_unknown_Source_close_before_partition')
    if external_partition_verifier is None or external_held_bootstrap_verifier is None:
        raise Denied('external_independent_bootstrap_and_partition_review_required')
    admissions=[]
    for name in ('recipe','proof','phase'):
        body=bootstrap[name]
        if not isinstance(body,Bootstrap) or type(body.raw) is not bytes:
            raise Denied('held_bootstrap_native_type')
        key=api.admission_id(body.row)
        if key not in ledger.rows or key not in ledger.read_debts:
            raise Denied('uncharged_bootstrap_read_debt')
        if (api.admission_id(ledger.rows[key]) != key or len(body.raw)!=body.row['bytes']
                or sha(body.raw)!=body.row['sha256']):
            raise Denied('bootstrap_EOF_hash_size_original_tuple')
        if external_held_bootstrap_verifier(name,body,key,ledger) is not True:
            raise Denied('bootstrap_not_currently_Root_held_verified')
        admissions.append(key)
    recipe=strict_json(bootstrap['recipe'].raw); proof=strict_json(bootstrap['proof'].raw)
    byid=api.validate_contract(recipe)
    custody,witness=api.proof_of_nonuse(recipe,proof,external_partition_verifier)
    source={key:row for key,row in byid.items() if key not in custody}
    for name,key in zip(('recipe','proof','phase'),admissions):
        body=bootstrap[name]
        if key in custody: raise Denied('enabling_bootstrap_cannot_be_custody_only')
        if key in source and api.admission_id(source[key])!=key:
            raise Denied('bootstrap_recipe_conflict')
        source[key]=copy.deepcopy(body.row)
    if not set(ledger.read_debts)<=set(source):
        raise Denied('existing_current_Source_read_debt_missing_from_exact_SourceMembers')
    canonical={}
    for key,row in source.items():
        if row['path'] in canonical and api.admission_id(canonical[row['path']])!=key:
            raise Denied('conflicting_same_path_versions_before_open')
        canonical[row['path']]=copy.deepcopy(row)
    view_hash=sha(encode({'recipeSha256':api.digest(recipe),'source':source,
                         'custody':sorted(custody),'bootstrap':admissions,
                         'reviewReceiptSha256':witness.review_receipt_sha256}))
    return SourceView(copy.deepcopy(recipe),tuple(canonical.values()),
                      tuple(copy.deepcopy(byid[k]) for k in sorted(custody)),view_hash,
                      bootstrap['phase'].row['sha256'],tuple(admissions),witness)

class SourceSession:
    """Own a finite current SOURCE union against the one borrowed Root ledger.

    Every declared row is charged before the first open. Every descriptor is
    registered immediately and detached before exactly one close attempt.
    A denied or failed read remains debt; closing never resets byte accounting.
    """
    def __init__(self,api,root,view,ledger,stop_ns,adapter_sha256,
                 external_runtime_verifier,io=os,clock=time.time_ns):
        if not isinstance(view,SourceView) or external_runtime_verifier is None:
            raise Denied('external_runtime_review_required')
        if ledger.unknown_close:raise Denied('sticky_unknown_Source_close_before_runtime_review')
        permit=external_runtime_verifier(view,adapter_sha256,ledger)
        if (not isinstance(permit,RuntimePermit) or permit.authority is None
                or permit.view_sha256!=view.view_sha256
                or permit.adapter_sha256!=adapter_sha256
                or permit.phase_sha256!=view.phase_sha256):
            raise Denied('runtime_review_binding_not_native_or_exact')
        if type(stop_ns) is not int or stop_ns<0 or len(adapter_sha256)!=64:
            raise Denied('stop_or_adapter_binding')
        self.api=api;self.root=Path(root).absolute();self.view=view;self.ledger=ledger
        self.stop_ns=stop_ns;self.io=io;self.clock=clock;self.owned={};self.rows={}
        self.events=[];self.failures=[];self.close_attempts=[];self.open_complete=False
        self.closed=False;self.final_checked=False;self.bodies={}
        self.view=copy.deepcopy(view)
        for row in view.rows:
            api.valid_row(row);path=row['path'];key=api.admission_id(row)
            if path in self.rows and api.admission_id(self.rows[path])!=key:
                raise Denied('conflicting_duplicate_before_any_member_open')
            self.rows[path]=copy.deepcopy(row)
        for row in self.rows.values(): ledger.admit(row,reason='exact_successor_SourceMember')
        ledger.preflight(future_paths=[r['path'] for r in view.recipe['futureDATA']])
        self._source_seal=sha(encode({'rows':self.rows,'recipe':self.view.recipe,
                                     'viewSha256':self.view.view_sha256}))

    def _sealed(self):
        if sha(encode({'rows':self.rows,'recipe':self.view.recipe,
                       'viewSha256':self.view.view_sha256}))!=self._source_seal:
            raise Denied('reviewed_Source_rows_edges_program_bindings_changed')

    def _failure(self,stage,error):
        self.failures.append((stage,error))

    def _path(self,relative):
        path=self.root/relative
        if path.resolve()!=path or self.root not in path.parents:
            raise Denied('noncanonical_or_escaping_path')
        for parent in (path,)+tuple(path.parents):
            if stat.S_ISLNK(self.io.lstat(parent).st_mode): raise Denied('symlink_component')
            if parent==self.root: break
        return path

    def _fence(self,path,row,fd=None,mature=False):
        observed=self.io.lstat(path)
        if (not stat.S_ISREG(observed.st_mode) or observed.st_nlink!=1
                or observed.st_uid!=501 or observed.st_gid!=20 or nine(observed)!=row['nine']):
            raise Denied('original_literal9_identity_mode_link_changed')
        if fd is not None and nine(self.io.fstat(fd))!=row['nine']:
            raise Denied('original_literal9_descriptor_changed')
        if mature:
            maximum=max(observed.st_mtime_ns,observed.st_ctime_ns)
            if maximum>self.stop_ns or self.clock()-maximum<240000000000 or self.clock()-self.stop_ns<240000000000:
                raise Denied('SOURCE_not_stopped_and_currently240s_mature')

    def _register(self,path,fd,row):
        try:
            self.owned[path]=(fd,row)
        except BaseException as primary:
            self._failure('ownership_registration',primary)
            try:
                self.io.close(fd);error=None
            except BaseException as failure:
                error=failure;self._failure('registration_fallback_close',failure)
                self.ledger.unknown_close=True
            self.close_attempts.append({'path':path,'fd':fd,'attempt':1,'error':None if error is None else repr(error)})
            raise Failures(self.failures)
        try:
            self.ledger.own_fd(fd,self)
        except BaseException as primary:
            self._failure('shared_ledger_ownership',primary)
            # Our owner already retains this fd. close() attempts it once even
            # if the shared ledger failed before or after registering it.
            raise

    def open_all(self,caller):
        if self.closed or self.open_complete or self.owned: raise Denied('duplicate_open_lifetime')
        try:
            self._sealed()
            for row in self.rows.values():
                self.ledger.authorize_use(row,caller,'read',self.view.recipe['bodyUseEdges'])
            for relative,row in self.rows.items():
                path=self._path(relative);self._fence(path,row,mature=True)
                self.ledger.can_open()
                fd=self.io.open(path,self.io.O_RDONLY|self.io.O_NOFOLLOW)
                self._register(relative,fd,row) # BEFORE fstat/maturity/parser/body
                self._fence(path,row,fd,mature=True)
            self.open_complete=True
            self.events.append({'event':'ALL_SOURCE_FDS_BEFORE_FIRST_MEMBER_BODY','count':len(self.owned)})
        except BaseException as error:
            if not isinstance(error,Failures): self._failure('open_all',error)
            self.close()

    def read(self,caller,path,operation='read'):
        self._sealed()
        if self.closed or not self.open_complete or path not in self.owned:
            raise Denied('undeclared_or_body_before_all_member_FDs')
        row=self.rows[path]
        self.ledger.authorize_use(row,caller,operation,self.view.recipe['bodyUseEdges'])
        fd,_=self.owned[path];chunks=[];offset=0
        while True:
            chunk=self.io.pread(fd,65536,offset)
            if not chunk:break
            offset+=len(chunk)
            if offset>row['bytes']:raise Denied('body_overdeclared_size')
            chunks.append(chunk)
        raw=b''.join(chunks)
        if len(raw)!=row['bytes'] or sha(raw)!=row['sha256']:raise Denied('fullEOF_hash_size_changed')
        self._fence(self.root/path,row,fd)
        self.bodies[path]={'fullEOF':True,'sha256':sha(raw),'bytes':len(raw),'POST9':copy.deepcopy(row['nine'])}
        self.events.append({'event':'ACTUAL_SOURCE_BODY_USE','caller':caller,'path':path,'operation':operation})
        return raw

    def final(self,caller):
        if self.closed or not self.open_complete:raise Denied('final_without_complete_held_lifetime')
        errors=[]
        for path in self.owned:
            try:self.read(caller,path,'hash')
            except BaseException as error:
                errors.append(error);self._failure('final_member:'+path,error)
        if errors:raise Failures(tuple(('final_member',error) for error in errors))
        self.final_checked=True
        self.events.append({'event':'FINAL_ALL_FULL_EOF_HASH_NINE_WHILE_HELD','count':len(self.owned)})

    def close(self):
        if self.closed:raise Denied('owned_close_never_retried')
        self.closed=True;owned=self.owned;self.owned={}
        for path,(fd,_row) in owned.items():
            error=None
            try:self.io.close(fd)
            except BaseException as failure:
                error=failure;self._failure('owned_close:'+path,failure)
            try:
                if self.ledger.owned_fds.get(fd) is self:
                    self.ledger.release_fd(fd,self,error is None)
                else:
                    self.ledger.unknown_close=True
                    raise Denied('ledger_ownership_registration_failed_no_retry')
            except BaseException as failure:self._failure('ledger_release:'+path,failure)
            self.close_attempts.append({'path':path,'fd':fd,'attempt':1,'error':None if error is None else repr(error)})
        if self.failures:raise Failures(self.failures)

    def run(self,caller,action,publish=None):
        """Whole lifetime includes setup/body/final/publication and all closes."""
        result=None
        try:
            self.open_all(caller)
            try:result=action(self)
            except BaseException as error:self._failure('primary',error)
            try:self.final(caller)
            except BaseException as error:self._failure('final',error)
            if publish is not None:
                try:publish(result)
                except BaseException as error:self._failure('publication',error)
        except BaseException as error:
            if not isinstance(error,Failures):self._failure('setup',error)
        finally:
            if not self.closed:self.close()
        if self.failures:raise Failures(self.failures)
        return result

    def borrow(self,caller):
        self._sealed()
        if self.closed or not self.open_complete:raise Denied('borrow_before_all_FDs_or_after_close')
        return BorrowedSourceLease(self,caller)

class BorrowedSourceLease:
    """Read facade only. Session/Root retains every descriptor and its lifetime."""
    def __init__(self,owner,caller):
        self._owner=owner;self._caller=caller;self.ownerToken=owner
        self.ledger=owner.ledger
        self.rows=tuple(copy.deepcopy(row) for row in owner.rows.values())
        self.by_path={row['path']:row for row in self.rows}
        self.closed=False

    @property
    def source_bytes(self):return self.ledger.byte_count

    @property
    def data_bytes(self):return CAPS['DATA'] # ONE reservation, not a borrower pool

    def lookup(self,path):
        if self.closed or path not in self.by_path:raise Denied('borrowed_undeclared_path')
        return copy.deepcopy(self.by_path[path])

    def read(self,row,operation='read'):
        if self.closed:raise Denied('released_borrowed_view')
        path=row.get('path') if isinstance(row,dict) else None
        if path not in self.by_path or self._owner.api.admission_id(row)!=self._owner.api.admission_id(self.by_path[path]):
            raise Denied('borrowed_original_tuple_mismatch')
        return self._owner.read(self._caller,path,operation)

    def release(self):
        if self.closed:raise Denied('borrowed_view_release_once')
        self.closed=True # descriptor ownership and ledger accounting stay Root's

def collector_manifest(session,caller):
    """Concrete collector replacement: exact SOURCE cohort, held throughout."""
    files=[]
    for path,row in session.rows.items():
        session.read(caller,path,'hash')
        files.append({'path':path,'bytes':row['bytes'],'sha256':row['sha256'],
                      'PRE9':row['nine'],'OPEN9':row['nine'],'POST9':row['nine'],
                      'fullEOF':True})
    return {'scope':SCOPE,'sourceViewSha256':session.view.view_sha256,
            'files':files,'sourceMembers':[session.api.admission_id(r) for r in session.rows.values()],
            'custodyTableAdmissions':[session.api.admission_id(r) for r in session.view.custody_rows],
            'sourceReadDebtAdmissions':sorted(session.ledger.read_debts),
            'sourceMemberBytes':sum(r['bytes'] for r in session.rows.values()),
            'sourceEligibility':False,'effects':0}

def guard_source_contract(session,caller,controls,plan_path,mf_path,approval_path,external_approval_verifier):
    """G seam charges/reads headers, agrees exact source set, releases no key."""
    if external_approval_verifier is None:raise Denied('independent_Source_approval_required')
    if session.ledger.unknown_close:raise Denied('sticky_unknown_Source_close_before_G_approval')
    if (not isinstance(controls,BorrowedSourceLease) or controls.ledger is not session.ledger
            or controls._caller!=caller or controls.ownerToken.closed or not controls.ownerToken.open_complete):
        raise Denied('headers_require_same_Root_ledger_already_all_FD_held_control_lease')
    docs={}
    for kind,path,cap in [('plan',plan_path,CAPS['file']),('MF',mf_path,CAPS['MF']),('approval',approval_path,CAPS['approval'])]:
        row=controls.lookup(path)
        raw=controls.read(row,'control')
        if len(raw)>cap:raise Denied('original_'+kind+'_body_cap')
        docs[kind]=strict_json(raw)
    expected={row['path'] for row in session.view.rows}
    mf=docs['MF'];plan=docs['plan']
    if (mf.get('scope')!=SCOPE or mf.get('sourceViewSha256')!=session.view.view_sha256
            or plan.get('sourceViewSha256')!=session.view.view_sha256
            or set(plan.get('sourceMemberPaths',()))!=expected
            or len(plan.get('sourceMemberPaths',()))!=len(expected)):
        raise Denied('G_plan_exact_SourceMembers_agreement')
    files=mf.get('files')
    if not isinstance(files,list) or len(files)!=len(expected) or len({r.get('path') for r in files})!=len(expected):
        raise Denied('G_missing_extra_duplicate_Source_key')
    if {r.get('path') for r in files}!=expected:raise Denied('G_missing_extra_Source_key')
    for row in files:
        original=session.rows[row['path']]
        if (row.get('sha256')!=original['sha256'] or row.get('bytes')!=original['bytes']
                or row.get('PRE9')!=original['nine'] or row.get('OPEN9')!=original['nine']
                or row.get('POST9')!=original['nine'] or row.get('fullEOF') is not True):
            raise Denied('G_original_Source_tuple_EOF_hash_changed')
    if external_approval_verifier(docs,session.view,session.ledger) is not True:
        raise Denied('no_own_JSON_PASS_or_stale_approval_authority')
    if session.ledger.unknown_close:raise Denied('sticky_unknown_Source_close_after_G_approval')
    return {'sourceViewSha256':session.view.view_sha256,'guardSourceOnly':True,'protectedEffects':False}

def root_compile(session,caller,path):
    """Compile approved held program bytes. Execute/import remains unimplemented."""
    row=session.rows.get(path)
    if row is None:raise Denied('undeclared_Root_program')
    key=session.api.admission_id(row)
    if session.view.recipe['programApprovals'].get(key)!=row['sha256']:
        raise Denied('Root_program_not_independently_bound')
    return compile(session.read(caller,path,'compile'),path,'exec',dont_inherit=True)

def protected_action(*_args,**_kwargs):
    raise Denied('first_portion_has_no_actual_or_protected_effect_entry')
