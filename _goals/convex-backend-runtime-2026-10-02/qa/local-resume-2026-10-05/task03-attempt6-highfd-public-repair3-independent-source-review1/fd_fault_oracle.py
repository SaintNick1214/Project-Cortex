"""Prepared SOURCE/MOCK oracle; no U3 imports, reads, dispatch, or effects.

Future adapters must invoke actual held verified U3 lifetime code. This module
only records independent virtual ownership facts and judges observed outcomes.
"""
from collections import Counter


class InjectedFault(OSError):
    pass


class VirtualFDs:
    def __init__(self, *, open_failure=None, fstat_failure=None, close_failures=()):
        self.open_failure = open_failure
        self.fstat_failure = fstat_failure
        self.close_failures = set(close_failures)
        self.open_calls = []
        self.successful_opens = []
        self.close_calls = []
        self.close_errors = []
        self.events = []

    def open(self, label, *args, **kwargs):
        index = len(self.open_calls)
        self.open_calls.append(label)
        self.events.append(('open-attempt', index, label))
        if index == self.open_failure:
            raise InjectedFault('open:' + str(index))
        fd = 10001 + index
        self.successful_opens.append(fd)
        self.events.append(('open-return', fd))
        return fd

    def fstat(self, fd):
        assert fd in self.successful_opens, 'fstat_foreign_fd'
        self.events.append(('fstat', fd))
        if self.successful_opens.index(fd) == self.fstat_failure:
            raise InjectedFault('fstat:' + str(fd))
        return {'fd': fd, 'stable': True}

    def close(self, fd):
        self.close_calls.append(fd)
        self.events.append(('close-attempt', fd))
        if fd not in self.successful_opens:
            raise InjectedFault('foreign_close:' + str(fd))
        if self.close_calls.count(fd) > 1:
            raise InjectedFault('unknown_close_retry:' + str(fd))
        if fd in self.close_failures:
            error = 'close:' + str(fd)
            self.close_errors.append(error)
            raise InjectedFault(error)
        self.events.append(('close-return', fd))


def assert_lifetime(system, *, accepted, observed_errors, expected_errors=()):
    """Assert external effects, not candidate self-reported owner counts."""
    assert type(accepted) is bool, 'acceptance_must_be_exact_bool'
    opened = Counter(system.successful_opens)
    attempted = Counter(system.close_calls)
    assert opened == attempted, {
        'error': 'each_successful_open_must_have_exactly_one_close_attempt',
        'opened': list(system.successful_opens),
        'attempted': list(system.close_calls),
    }
    for error in (*expected_errors, *system.close_errors):
        assert error in observed_errors, ('sticky_error_lost', error, observed_errors)
    if expected_errors or system.close_errors:
        assert accepted is False, 'failure_must_deny_acceptance'
    return {
        'opened': list(system.successful_opens),
        'closeAttempts': list(system.close_calls),
        'closeFailures': list(system.close_errors),
        'accepted': accepted,
        'observedErrors': list(observed_errors),
    }


def fault_matrix():
    return [
        {'name': 'complete-positive', 'owned': 3},
        {'name': 'empty-owned-positive', 'owned': 0},
        {'name': 'early-before-open', 'owned': 3, 'primary': 'setup-before-open'},
        {'name': 'first-open-rejected', 'owned': 3, 'open_failure': 0},
        {'name': 'middle-partial-open-rejected', 'owned': 3, 'open_failure': 1},
        {'name': 'last-partial-open-rejected', 'owned': 3, 'open_failure': 2},
        {'name': 'first-fstat-rejected', 'owned': 3, 'fstat_failure': 0},
        {'name': 'middle-fstat-rejected', 'owned': 3, 'fstat_failure': 1},
        {'name': 'last-fstat-rejected', 'owned': 3, 'fstat_failure': 2},
        {'name': 'content-rejected', 'owned': 3, 'primary': 'content-hash-assert'},
        {'name': 'primary-rejected', 'owned': 3, 'primary': 'primary-work'},
        {'name': 'report-rejected', 'owned': 3, 'publication': 'report-write'},
        {'name': 'first-close-rejected', 'owned': 3, 'close_positions': [0]},
        {'name': 'middle-close-rejected', 'owned': 3, 'close_positions': [1]},
        {'name': 'last-close-rejected', 'owned': 3, 'close_positions': [2]},
        {'name': 'allclose-rejected', 'owned': 3, 'close_positions': [0, 1, 2]},
        {'name': 'primary-report-firstclose', 'owned': 3, 'primary': 'primary-work',
         'publication': 'report-write', 'close_positions': [0]},
        {'name': 'primary-report-allclose', 'owned': 3, 'primary': 'primary-work',
         'publication': 'report-write', 'close_positions': [0, 1, 2]},
    ]
