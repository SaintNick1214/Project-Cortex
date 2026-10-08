"""Additional pure Source/mock close-fence controls; no actual native authority."""

def run(M, F):
    results = []
    receipt = {'counts': dict(M.COUNTS), 'assertions': list(M.ASSERTIONS),
               'originalProgramsUnchanged': True,
               'allProgramsIndependentlyApprovedBefore1914': True}

    def case(name, action):
        try:
            detail = action()
            results.append({'name': name, 'status': 'PASS', 'detail': detail})
        except BaseException as error:
            results.append({'name': name, 'status': 'FAIL', 'error': repr(error)})

    def deny(action):
        try:
            action()
        except M.Denied as error:
            assert str(error) == 'sticky_unknown_SOURCE_close', str(error)
            return str(error)
        raise AssertionError('failed-close eligibility was accepted')

    def closed_ledger():
        ledger = M.Ledger()
        ledger.admit(F.row('one'))
        owner = object()
        ledger.own_fd(100, owner)
        ledger.release_fd(100, owner, False)
        assert ledger.unknown_close and not ledger.owned_fds
        return ledger

    case('failed_close_preflight_denied', lambda: deny(closed_ledger().preflight))
    case('failed_close_approval_binding_denied', lambda: deny(closed_ledger().approval_binding))

    def phase_case(phase):
        ledger = M.Ledger()
        ledger.admit(F.row('one'))
        machine = M.PhaseMachine(ledger)
        for next_phase in M.PhaseMachine.ORDER[1:]:
            if machine.phase == phase:
                break
            machine.advance(next_phase, receipt, lambda *_: True)
        owner = object()
        ledger.own_fd(100, owner)
        ledger.release_fd(100, owner, False)
        callbacks = []
        next_phase = M.PhaseMachine.ORDER[M.PhaseMachine.ORDER.index(phase) + 1]
        reason = deny(lambda: machine.advance(next_phase, receipt,
                       lambda *args: callbacks.append(args) or True))
        assert machine.phase == phase and not callbacks
        return {'denial': reason, 'externalCallbacks': 0, 'phaseChanged': False}

    for phase in M.PhaseMachine.ORDER[:-1]:
        case('failed_close_before_' + phase + '_advance_denied', lambda phase=phase: phase_case(phase))

    def post_close_mutation():
        ledger = closed_ledger()
        return deny(lambda: ledger.admit(F.row('late')))

    case('failed_close_late_admission_denied', post_close_mutation)
    case('failed_close_future_open_denied', lambda: deny(closed_ledger().can_open))

    def healthy():
        ledger = M.Ledger()
        ledger.admit(F.row('one'))
        owner = object()
        ledger.own_fd(100, owner)
        ledger.release_fd(100, owner, True)
        machine = M.PhaseMachine(ledger)
        for phase in M.PhaseMachine.ORDER[1:]:
            machine.advance(phase, receipt, lambda *_: True)
        assert machine.phase == 'ACTUAL_READY' and ledger.unknown_close is False
        return {'originalStages': 6, 'mockReady': True, 'effectAuthority': False}

    case('successful_close_preserves_original_mock_stages', healthy)
    return {'scope': 'REPAIR6_ADDITIONAL_SOURCE_MOCK_ONLY',
            'results': results, 'passed': sum(r['status'] == 'PASS' for r in results),
            'failed': sum(r['status'] == 'FAIL' for r in results),
            'actualNativeCloses': 0, 'sourceEligibility': False, 'actualEffects': 0}
