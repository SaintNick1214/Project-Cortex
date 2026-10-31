"""Concrete U4-successor Source seam; borrows only the existing Root owner.

No ledger factory, source open/stat/read escape, protected effect or own approval.
The original public runner and observer assertions execute in the successor.
"""
import copy
from pathlib import PurePosixPath
import time

class SourceDenied(RuntimeError):pass

class RootSourcePort:
    def __init__(self,session,caller,adapter):
        if not isinstance(session,adapter.SourceSession):raise SourceDenied('exact_Root_SourceSession_required')
        if type(caller)is not str:raise SourceDenied('exact_approved_caller_required')
        session._healthy();session.check_current()
        if session.closed or not session.open_complete:raise SourceDenied('all_FD_held_Root_lifetime_required')
        approved=session.view.recipe['programApprovals']
        if caller not in approved:raise SourceDenied('Root_runner_caller_program_not_approved')
        self.session=session;self.caller=caller;self.adapter=adapter
        self.root=session.root;self.pins={};self.manifest_bound=False;self.released=False
        self.root_fds={path:fd for path,(fd,_row) in session.owned.items()}
        self.lease=session.borrow(caller) # final setup: no fallible owner setup after borrow
    def current(self):
        if self.released:raise SourceDenied('borrowed_U3_Source_view_released')
        self.session._healthy();self.session.check_current()
        if {p:fd for p,(fd,_r) in self.session.owned.items()}!=self.root_fds:
            raise SourceDenied('Root_Source_owned_descriptor_map_changed')
    def relative(self,path):
        value=str(path);pure=PurePosixPath(value)
        if not pure.is_absolute() or str(pure)!=value or '..'in pure.parts:raise SourceDenied('lexical_Source_path_required')
        try:relative=str(pure.relative_to(self.root))
        except ValueError:raise SourceDenied('Source_root_escape')
        if relative=='.':raise SourceDenied('Source_file_path_required')
        return relative
    def reserve(self,path,size):
        self.current();row=self.lease.lookup(self.relative(path))
        if type(size)is not int or size!=row['bytes']:raise SourceDenied('exact_shared_Source_admission_size')
        key=self.session.api.admission_id(row)
        if key not in self.session.ledger.rows:raise SourceDenied('undeclared_shared_Source_admission')
        # The Root boundary revalidates its existing cumulative union and all
        # original MF4M/approval1M/ONE_DATA2M reserves. No counter starts here.
        self.current()
    def capture(self,path,kind,original=None):
        self.current();relative=self.relative(path);row=self.lease.lookup(relative);self.reserve(path,row['bytes'])
        if original is not None and row['nine']!=original:raise SourceDenied('literal_original_Source_nine_changed')
        if str(path) in self.pins:
            pin=self.pins[str(path)]
            if pin['PRE9']!=row['nine']:raise SourceDenied('duplicate_Source_literal_nine_changed')
            return pin
        pin={'path':str(path),'relativePath':relative,'kind':kind,'PRE9':copy.deepcopy(row['nine']),
             'row':copy.deepcopy(row),'capturedUnixNs':str(time.time_ns()),'borrowedViewReleased':False}
        self.pins[str(path)]=pin
        self.current();return pin
    def qualify(self,pin,expected=None,collect=False):
        self.current();current=self.lease.lookup(pin['relativePath'])
        if current!=pin['row'] or pin['PRE9']!=current['nine']:raise SourceDenied('borrowed_Source_pin_changed')
        op='control' if collect and pin['kind'] not in ('Root-reviewed-new-observer','current-approved-operative-source') else 'hash'
        raw=self.lease.read(current,op)
        row={'path':pin['path'],'sha256':self.adapter.sha(raw),'bytes':len(raw),'PRE9':copy.deepcopy(current['nine']),
             'capturedUnixNs':pin['capturedUnixNs'],'fullEOF':True,'finalDescriptorAndPathNineEqual':True}
        if expected is not None and (row['sha256']!=expected['sha256'] or row['bytes']!=expected['bytes']):
            raise SourceDenied('exact_Source_hash_or_size_changed')
        self.current();return row,raw if collect else b''
    def compile(self,path):
        self.current();relative=self.relative(path)
        code=self.adapter.root_compile(self.session,self.caller,relative)
        self.current();return code
    def bind_source_manifest(self,handoff,mf,approval):
        self.current();api=self.session.api;view=self.session.view
        if mf['sourceViewSha256']!=view.view_sha256 or handoff['sourceViewSha256']!=view.view_sha256:
            raise SourceDenied('exact_Source_view_binding_required')
        if mf['partitionRecipeSha256']!=api.digest(view.recipe) or handoff['partitionRecipeSha256']!=api.digest(view.recipe):
            raise SourceDenied('exact_reviewed_partition_recipe_binding_required')
        api.validate_contract(copy.deepcopy(view.recipe))
        exact={r['path']:r for r in view.rows}
        if {r['path']for r in mf['files']}!=set(exact) or len(mf['files'])!=len(exact):raise SourceDenied('exact_Source_only_cohort_required')
        for r in mf['files']:
            original=exact[r['path']]
            if (r['bytes']!=original['bytes'] or r['sha256']!=original['sha256']
                    or any(r[k]!=original['nine']for k in ('PRE9','OPEN9','POST9')) or r['fullEOF']is not True):
                raise SourceDenied('sealed_Source_manifest_original_fields')
        # Original fixed32/current129/Q6seed5/original13 remain declared and
        # Source-approved before any actual1914 step. The API validates counts.
        byid={api.admission_id(r):r for r in exact.values()}
        for name in ('currentPrograms','requiredCurrent','Q6Seeds','originalComparands'):
            if not set(view.recipe['cohorts'][name])<=set(byid):raise SourceDenied('original_required_Source_cohort_missing:'+name)
        for key in view.recipe['cohorts']['currentPrograms']+view.recipe['cohorts']['Q6Seeds']+view.recipe['cohorts']['originalComparands']:
            if view.recipe['programApprovals'].get(key)!=byid[key]['sha256']:raise SourceDenied('original_program_approval_missing')
        if approval['sourceViewSha256']!=view.view_sha256 or approval['partitionRecipeSha256']!=api.digest(view.recipe):
            raise SourceDenied('external_approval_exact_partition_binding')
        self.current();self.manifest_bound=True
    def dispatch_boundary(self):
        self.current()
        if self.manifest_bound is not True:raise SourceDenied('no_actual_dispatch_before_complete_Source_program_approval')
    def release(self):
        if self.released:raise SourceDenied('borrowed_U3_Source_release_once')
        self.released=True
        # Only view release. Cleanup remains possible on budget/failure denial;
        # no Root descriptor closes or foreign signals occur here.
        self.lease.release()
