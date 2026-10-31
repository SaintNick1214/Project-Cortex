"""Concrete Root-callable entry; no standalone Source ownership or authority."""
import sys
import types
from pathlib import PurePosixPath

def run(session,caller,source_adapter,argv):
    if not isinstance(session,source_adapter.SourceSession):raise RuntimeError('exact_Root_Source_session_required')
    session._healthy();session.check_current()
    entry=str(PurePosixPath(__file__).relative_to(session.root))
    row=session.rows.get(entry)
    if row is None or session.api.admission_id(row)!=caller:raise RuntimeError('exact_approved_Root_entry_caller_required')
    if session.view.recipe['programApprovals'].get(caller)!=row['sha256']:raise RuntimeError('Root_entry_program_approval_required')
    runner=str(PurePosixPath(entry).parent/'run-actual-review.py');target=session.rows.get(runner)
    if target is None:raise RuntimeError('new_operative_runner_Source_required')
    runner_caller=session.api.admission_id(target)
    if session.view.recipe['programApprovals'].get(runner_caller)!=target['sha256']:raise RuntimeError('operative_runner_program_approval_required')
    code=source_adapter.root_compile(session,caller,runner)
    module=types.ModuleType('operative_u3_Root_held_runner');module.__file__=str(session.root/runner)
    # No pyc/path import or old-U4 invocation. The literal reviewed held bytes
    # are the sole module body. Root retains every Source descriptor.
    exec(code,module.__dict__)
    session.check_current()
    return module.run(session,runner_caller,source_adapter,argv)

if __name__=='__main__':
    raise RuntimeError('standalone_U3_entry_denied_explicit_Root_Source_context_required')
