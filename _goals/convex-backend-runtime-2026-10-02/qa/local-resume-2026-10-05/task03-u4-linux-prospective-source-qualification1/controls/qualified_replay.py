"""Replay only from a complete externally held, verified public Source cohort.

No source path import/read, private input, Docker, target or network operation.
Own-process controls use reviewed Common and its held-byte anchor interface.
"""
import json
import os
import sys
import types
from pathlib import Path


def replay(bodies,entries,plan,directory,ledger):
    named={row['name']:row for row in plan['members'] if row.get('name')}
    def raw(name):return bodies[named[name]['path']]
    def load(name,deps):
        module=types.ModuleType('held_replay_'+name);module.__file__=named[name]['path'];module.__dict__.update(deps)
        exec(compile(raw(name),module.__file__,'exec',dont_inherit=True),module.__dict__)
        return module
    C=load('C',{});L=load('L',{'C':C})
    old=raw('originalCommon').decode()
    replacement="[sys.executable,'-B','-c',SOURCE_ANCHOR['bootstrap'],str(SOURCE_ANCHOR['fd']),json.dumps(SOURCE_ANCHOR['row']),str(child_control.fileno()),json.dumps(list(argv))]"
    conserved=old.replace("[sys.executable,'-B',__file__,'--owned-anchor',str(child_control.fileno()),json.dumps(list(argv))]",replacement)
    conserved=conserved.replace('pass_fds=(child_control.fileno(),)','pass_fds=(child_control.fileno(),SOURCE_ANCHOR[\'fd\'])')
    if conserved.encode()!=raw('M'):raise ValueError('ONLY_REVIEWED_COMMON_HELD_SOURCE_DELTA')
    carry=C.strict(raw('carry'));wire=C.strict(raw('wire'));proof=C.strict(raw('proof'))
    if proof['carrySha256']!=C.digest(raw('carry')) or wire['macCarrySha256']!=C.digest(raw('carry')):
        raise ValueError('EXACT_HELD_CARRY_FILE_PROOF_WIRE_BYTES')
    original=L.original113(carry,C.strict(bodies[proof['receiptSource']['path']]),C.strict(bodies[proof['planSource']['path']]))
    if any(proof[k]!=value for k,value in original.items()):raise ValueError('ORIGINAL_113_PROOF_NOT_REPRODUCED')
    controls=load('controls',{})
    sources={n:raw(n) for n in ('C','T','Q','L','B','S','D','E','M','A','R')}
    sources.update(carryRaw=raw('carry'),wireRaw=raw('wire'),proofRaw=raw('proof'))
    mocked=controls.run(sources,carry,wire,proof)
    if mocked['failed']:raise ValueError('QUALIFIED_SOURCE_MOCK_CONDITIONS_FAILED')
    mrow=named['M'];owned=next(e for e in entries if e['row']['path']==mrow['path'])
    anchor={'bootstrap':raw('A').decode(),'fd':owned['fd'],
        'row':{'path':mrow['path'],'PRE9':owned['pin'],'sha256':mrow['sha256'],'bytes':mrow['bytes']}}
    M=load('M',{'SOURCE_ANCHOR':anchor})
    directory=Path(directory);directory.mkdir(mode=0o700,exist_ok=False)
    environment={'PATH':'/usr/bin:/bin','HOME':str(Path.home()),'CORTEX_COORDINATOR_CWD':str(directory)}
    process=[]
    for label,code,timeout,exit_code in (
        ('held-source-common-positive',"print('owned-source-positive')",5,0),
        ('held-source-common-child-failure','raise SystemExit(7)',5,7),
        ('held-source-common-own-timeout','import time;time.sleep(5)',1,None)):
        # The child borrows its own Source descriptor copy; it is not a new
        # parent-owned handle. Preserve the combined prospective peak gate.
        ledger.can_open()
        ledger.peak=max(ledger.peak,ledger.snapshot()['liveOwnedSourceFDs']+1)
        row,out,err=M.run(label,[sys.executable,'-B','-c',code],directory,timeout,environment,required=False)
        if not row['terminal'] or row['closeErrors']:raise ValueError('OWN_PROCESS_TERMINAL_OR_CLOSE_UNKNOWN')
        if exit_code is not None and (row['exitCode']!=exit_code or row['failureClass'] is not None):raise ValueError('OWN_PROCESS_WRONG_OUTCOME')
        if exit_code is None and row['failureClass'] is None:raise ValueError('OWN_TIMEOUT_DID_NOT_DENY')
        process.append({'receipt':row,'stdoutBytes':len(out),'stderrBytes':len(err),'scope':'OWN_PUBLIC_SOURCE_PROCESS_ONLY'})
    return {'scope':'HELD_PUBLIC_SOURCE_AUTHOR_REPLAY_ONLY','sourceMock':mocked,'original113Proof':original,
        'ownProcessCases':process,'sourceChildBorrowPeak':ledger.peak,'commonOnlyExplicitHeldSourceDelta':True,'DockerEffects':0,'serviceEffects':0,'privateReads':0,
        'sourceEligibility':False,'runtimeAuthority':False,'fullTask03':False,'fullGoal':False}
