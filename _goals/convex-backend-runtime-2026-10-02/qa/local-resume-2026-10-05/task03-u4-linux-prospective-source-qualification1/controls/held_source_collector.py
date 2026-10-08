"""Finite author SOURCE replay. C, headers and this program are held by bootstrap.

This is an evidence producer, never an independent source approval or release.
No private, Docker, network, management, inference or native qualification path.
"""
import types


def collect(headers, bodies, ledger, directory):
    plan=C.strict(bodies[headers['plan']['path']])
    stop=C.strict(bodies[headers['stop']['path']])
    if plan['scope']!='L_FINITE_AUTHOR_SOURCE_REPLAY_INPUTS_ONLY' or stop['scope']!='L_SOURCE_AUTHOR_WRITERS_STOPPED_ONLY':
        raise ValueError('EXACT_AUTHOR_PLAN_AND_STOP_SCOPE')
    if stop['sourcePlanSha256']!=headers['plan']['sha256'] or stop['remainingSourceWrites']!=[]:
        raise ValueError('STOP_PLAN_HASH_OR_ACTIVE_WRITER')
    rows=plan['members'];stopped=C.integer(stop['stoppedUnixNs'],0,2**63-1,'SOURCE_STOP_TIME')
    if len({r['path'] for r in rows})!=len(rows) or sum(r['bytes'] for r in rows)!=plan['memberBytes']:
        raise ValueError('FINITE_UNIQUE_ROW_CENSUS')
    header_paths={headers[n]['path'] for n in ('C','collector','bootstrap','plan','stop')}
    for row in rows:
        C.valid_nine(row['expectedNine'])
        if max(int(row['expectedNine']['mtime_ns']),int(row['expectedNine']['ctime_ns']))>stopped:
            raise ValueError('SOURCE_WRITER_AFTER_DECLARED_STOP')
    cohort=C.Cohort([r for r in rows if r['path'] not in header_paths],ledger,owner=(501,20))
    primary=None;result=None;closed=None
    try:
        cohort.open_all()
        member_bodies=cohort.read_all();bodies.update(member_bodies)
        if any(r['path'] not in bodies for r in rows):raise ValueError('COMPLETE_SOURCE_BODIES_REQUIRED')
        named={r['name']:r for r in rows if r.get('name')}
        replay=types.ModuleType('verified_qualified_replay');replay.__file__=named['replay']['path']
        exec(compile(bodies[replay.__file__],replay.__file__,'exec',dont_inherit=True),replay.__dict__)
        result=replay.replay(bodies,cohort.owned+headers['ownedEntries'],plan,directory,ledger)
    except BaseException as error:primary=error
    finally:closed=cohort.final_and_close(primary)
    return {'scope':'L_HELD_SOURCE_AUTHOR_REPLAY_AND_CLOSE_ONLY','result':result,
        'primaryFailure':repr(primary) if primary is not None else None,'memberClosure':closed,
        'sourceEligibility':False,'runtimeAuthority':False,'fullTask03':False,'fullGoal':False}
