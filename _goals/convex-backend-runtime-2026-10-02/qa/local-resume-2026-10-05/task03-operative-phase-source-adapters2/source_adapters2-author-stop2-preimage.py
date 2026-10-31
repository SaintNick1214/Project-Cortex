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
from pathlib import PurePosixPath
import stat
import time
from dataclasses import dataclass

SCOPE = 'TASK03_OPERATIVE_SOURCE_ADAPTERS2_SOURCE_MEMBERS_ONLY'
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

def shared_admission(api,ledger,future_paths=()):
    """Revalidate the existing Root union, including its one original reserve.

    Cleanup must remain possible after denial; this gate authorizes only new
    metadata/body/compile/approval work, never ownership release or a new pool.
    """
    if api.CAPS != CAPS:raise Denied('original_shared_caps_required')
    if ledger.unknown_close:raise Denied('sticky_unknown_Source_close')
    if len(ledger.owned_fds)>CAPS['paths']:raise Denied('shared_Source_FD_union_exceeded')
    ledger.approval_binding() # every already admitted key remains its literal row
    if ledger.paths!={row['path'] for row in ledger.rows.values()} or not ledger.read_debts<=set(ledger.rows):
        raise Denied('shared_Source_path_or_read_debt_accounting_changed')
    return ledger.preflight(mf=CAPS['MF'],approval=CAPS['approval'],data=CAPS['DATA'],
                            future_paths=future_paths)

def source_view(api, ledger, bootstrap, external_partition_verifier,
                external_held_bootstrap_verifier):
    """Derive exact current SOURCE rows; no pathname or custody-body read.

    Bootstrap must contain recipe/proof/A5 module, already FD-held and charged
    by Root. Neither an author JSON PASS nor this function supplies authority.
    The independent nonuse proof also binds all five downstream adapter seams.
    """
    if api.CAPS != CAPS or set(bootstrap) != {'recipe','proof','phase'}:
        raise Denied('exact_bootstrap_and_original_caps')
    shared_admission(api,ledger)
    if external_partition_verifier is None or external_held_bootstrap_verifier is None:
        raise Denied('external_independent_bootstrap_and_partition_review_required')
    admissions=[]
    for name in ('recipe','proof','phase'):
        shared_admission(api,ledger)
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
        shared_admission(api,ledger)
        if api.admission_id(body.row)!=key or len(body.raw)!=body.row['bytes'] or sha(body.raw)!=body.row['sha256']:
            raise Denied('bootstrap_original_binding_changed_by_verifier')
        admissions.append(key)
    recipe=strict_json(bootstrap['recipe'].raw); proof=strict_json(bootstrap['proof'].raw)
    recipe_seal=sha(encode(recipe));proof_seal=sha(encode(proof))
    shared_admission(api,ledger,future_paths=[r['path'] for r in recipe['futureDATA']])
    byid=api.validate_contract(recipe)
    custody,witness=api.proof_of_nonuse(recipe,proof,external_partition_verifier)
    shared_admission(api,ledger,future_paths=[r['path'] for r in recipe['futureDATA']])
    if sha(encode(recipe))!=recipe_seal or sha(encode(proof))!=proof_seal:
        raise Denied('partition_verifier_changed_original_recipe_or_proof')
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
        root_text=os.fspath(root);lexical_root=PurePosixPath(root_text)
        if (not lexical_root.is_absolute() or str(lexical_root)!=root_text
                or '..' in lexical_root.parts or lexical_root==PurePosixPath('/')):
            raise Denied('lexically_canonical_absolute_Source_root_required')
        shared_admission(api,ledger,future_paths=[r['path'] for r in view.recipe['futureDATA']])
        permit=external_runtime_verifier(copy.deepcopy(view),adapter_sha256,ledger)
        shared_admission(api,ledger,future_paths=[r['path'] for r in view.recipe['futureDATA']])
        if (not isinstance(permit,RuntimePermit) or permit.authority is None
                or permit.view_sha256!=view.view_sha256
                or permit.adapter_sha256!=adapter_sha256
                or permit.phase_sha256!=view.phase_sha256):
            raise Denied('runtime_review_binding_not_native_or_exact')
        if type(stop_ns) is not int or stop_ns<0 or len(adapter_sha256)!=64:
            raise Denied('stop_or_adapter_binding')
        self.api=api;self.root=lexical_root;self.view=view;self.ledger=ledger
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
        shared_admission(api,ledger,future_paths=[r['path'] for r in view.recipe['futureDATA']])
        self._source_seal=sha(encode(self._seal_value()))

    def _seal_value(self):
        return {'rows':self.rows,'recipe':self.view.recipe,'viewRows':self.view.rows,
                'custodyRows':self.view.custody_rows,'viewSha256':self.view.view_sha256,
                'phaseSha256':self.view.phase_sha256,'bootstrap':self.view.bootstrap_admissions}

    def _sealed(self):
        if sha(encode(self._seal_value()))!=self._source_seal:
            raise Denied('reviewed_Source_rows_edges_program_bindings_changed')

    def _boundary(self):
        self._sealed()
        return shared_admission(self.api,self.ledger,
                         future_paths=[r['path'] for r in self.view.recipe['futureDATA']])

    def _healthy(self):
        self._boundary()
        if self.failures:raise Denied('prior_Source_failure_cannot_authorize_callback_or_compile')

    def _failure(self,stage,error):
        self.failures.append((stage,error))

    def _path(self,relative):
        self._boundary()
        if (type(relative) is not str or not relative or '\\' in relative
                or '\x00' in relative):raise Denied('noncanonical_or_escaping_path')
        pure=PurePosixPath(relative)
        if pure.is_absolute() or '..' in pure.parts or str(pure)!=relative or pure==PurePosixPath('.'):
            raise Denied('noncanonical_or_escaping_path')
        path=self.root/pure
        # Root-first lexical components; all actual metadata stays injected.
        components=list(reversed(self.root.parents))+[self.root]
        for part in pure.parts:components.append(components[-1]/part)
        for parent in components:
            self._boundary();observed=self.io.lstat(parent);self._boundary()
            if stat.S_ISLNK(observed.st_mode):raise Denied('symlink_component')
        return path

    def _fence(self,path,row,fd=None,mature=False):
        self._boundary();observed=self.io.lstat(path);self._boundary()
        if (not stat.S_ISREG(observed.st_mode) or observed.st_nlink!=1
                or observed.st_uid!=501 or observed.st_gid!=20 or nine(observed)!=row['nine']):
            raise Denied('original_literal9_identity_mode_link_changed')
        if fd is not None:
            self._boundary();descriptor=self.io.fstat(fd);self._boundary()
            if nine(descriptor)!=row['nine']:raise Denied('original_literal9_descriptor_changed')
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
            self._boundary()
            for row in self.rows.values():
                self.ledger.authorize_use(row,caller,'read',self.view.recipe['bodyUseEdges'])
                self._boundary()
            for relative,row in self.rows.items():
                path=self._path(relative);self._fence(path,row,mature=True)
                self.ledger.can_open()
                self._boundary()
                fd=self.io.open(path,self.io.O_RDONLY|self.io.O_NOFOLLOW)
                self._register(relative,fd,row) # BEFORE fstat/maturity/parser/body
                self._boundary()
                self._fence(path,row,fd,mature=True)
            self.open_complete=True
            self.events.append({'event':'ALL_SOURCE_FDS_BEFORE_FIRST_MEMBER_BODY','count':len(self.owned)})
        except BaseException as error:
            if not isinstance(error,Failures): self._failure('open_all',error)
            self.close()

    def read(self,caller,path,operation='read'):
        self._boundary()
        if self.closed or not self.open_complete or path not in self.owned:
            raise Denied('undeclared_or_body_before_all_member_FDs')
        row=self.rows[path]
        self.ledger.authorize_use(row,caller,operation,self.view.recipe['bodyUseEdges'])
        self._boundary()
        fd,_=self.owned[path];chunks=[];offset=0
        while True:
            self._fence(self._path(path),row,fd,mature=True)
            self._boundary();chunk=self.io.pread(fd,65536,offset);self._boundary()
            if not chunk:break
            offset+=len(chunk)
            if offset>row['bytes']:raise Denied('body_overdeclared_size')
            chunks.append(chunk)
        raw=b''.join(chunks)
        if len(raw)!=row['bytes'] or sha(raw)!=row['sha256']:raise Denied('fullEOF_hash_size_changed')
        self._fence(self.root/path,row,fd)
        self.bodies[path]={'fullEOF':True,'sha256':sha(raw),'bytes':len(raw),'POST9':copy.deepcopy(row['nine'])}
        self.events.append({'event':'ACTUAL_SOURCE_BODY_USE','caller':caller,'path':path,'operation':operation})
        self._boundary()
        return raw

    def check_current(self,caller=None):
        """Actual held Source/control identity, before and after callbacks."""
        self._boundary()
        if self.closed or not self.open_complete:raise Denied('current_check_outside_held_lifetime')
        for path,(fd,_row) in self.owned.items():
            self._fence(self._path(path),self.rows[path],fd,mature=True)
            if caller is not None:self.read(caller,path,'hash')
        self._boundary()

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
            try:
                self.check_current();result=action(self);self.check_current()
            except BaseException as error:self._failure('primary',error)
            try:self.final(caller)
            except BaseException as error:self._failure('final',error)
            if publish is not None:
                try:
                    self.check_current();publish(result);self.check_current()
                except BaseException as error:self._failure('publication',error)
        except BaseException as error:
            if not isinstance(error,Failures):self._failure('setup',error)
        finally:
            if not self.closed:self.close()
        if self.failures:raise Failures(self.failures)
        return result

    def borrow(self,caller):
        self._healthy()
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
        self._owner._boundary()
        return copy.deepcopy(self._owner.rows[path])

    def read(self,row,operation='read'):
        if self.closed:raise Denied('released_borrowed_view')
        path=row.get('path') if isinstance(row,dict) else None
        self._owner._boundary()
        if path not in self.by_path or self._owner.api.admission_id(row)!=self._owner.api.admission_id(self._owner.rows[path]):
            raise Denied('borrowed_original_tuple_mismatch')
        return self._owner.read(self._caller,path,operation)

    def release(self):
        if self.closed:raise Denied('borrowed_view_release_once')
        self.closed=True # descriptor ownership and ledger accounting stay Root's

def collector_manifest(session,caller):
    """Concrete collector replacement: exact SOURCE cohort, held throughout."""
    session._boundary();files=[]
    for path,row in session.rows.items():
        session.read(caller,path,'hash')
        files.append({'path':path,'bytes':row['bytes'],'sha256':row['sha256'],
                      'PRE9':copy.deepcopy(row['nine']),'OPEN9':copy.deepcopy(row['nine']),
                      'POST9':copy.deepcopy(row['nine']),
                      'fullEOF':True})
    session.check_current(caller)
    return {'scope':SCOPE,'sourceViewSha256':session.view.view_sha256,
            'files':files,'sourceMembers':[session.api.admission_id(r) for r in session.rows.values()],
            'custodyTableAdmissions':[session.api.admission_id(r) for r in session.view.custody_rows],
            'sourceReadDebtAdmissions':sorted(session.ledger.read_debts),
            'sourceMemberBytes':sum(r['bytes'] for r in session.rows.values()),
            'sourceEligibility':False,'effects':0}

def guard_source_contract(session,caller,controls,plan_path,mf_path,approval_path,external_approval_verifier):
    """G seam charges/reads headers, agrees exact source set, releases no key."""
    if external_approval_verifier is None:raise Denied('independent_Source_approval_required')
    session._healthy();session.check_current(caller)
    if (not isinstance(controls,BorrowedSourceLease) or controls.ledger is not session.ledger
            or controls.ownerToken is not controls._owner or controls._owner.ledger is not session.ledger
            or controls._caller!=caller or controls.ownerToken.closed or not controls.ownerToken.open_complete):
        raise Denied('headers_require_same_Root_ledger_already_all_FD_held_control_lease')
    controls._owner._healthy();controls._owner.check_current(caller)
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
    session.check_current(caller);controls._owner.check_current(caller)
    accepted=external_approval_verifier(copy.deepcopy(docs),copy.deepcopy(session.view),session.ledger)
    session.check_current(caller);controls._owner.check_current(caller)
    session._healthy();controls._owner._healthy()
    if accepted is not True:
        raise Denied('no_own_JSON_PASS_or_stale_approval_authority')
    return {'sourceViewSha256':session.view.view_sha256,'guardSourceOnly':True,'protectedEffects':False}

def root_compile(session,caller,path):
    """Compile approved held program bytes. Execute/import remains unimplemented."""
    session._healthy();row=session.rows.get(path)
    if row is None:raise Denied('undeclared_Root_program')
    key=session.api.admission_id(row)
    if session.view.recipe['programApprovals'].get(key)!=row['sha256']:
        raise Denied('Root_program_not_independently_bound')
    raw=session.read(caller,path,'compile')
    session.check_current()
    code=compile(raw,path,'exec',dont_inherit=True)
    session.check_current()
    return code

def protected_action(*_args,**_kwargs):
    raise Denied('first_portion_has_no_actual_or_protected_effect_entry')
