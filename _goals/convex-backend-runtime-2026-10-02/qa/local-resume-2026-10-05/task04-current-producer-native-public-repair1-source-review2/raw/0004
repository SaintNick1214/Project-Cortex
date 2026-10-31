"""Finite infrastructure pipe collection. Original Task04 dispatch is not implemented."""
import os
import select
import selectors
import signal
import subprocess
import time


class CollectionFailure(RuntimeError):
    def __init__(self, code, receipt):
        super().__init__(code)
        self.receipt = receipt


class BoundedStreams:
    """Retain at most each declared byte limit while draining two nonblocking pipes."""
    def __init__(self, process, stdout_limit, stderr_limit, deadline, read=os.read):
        if stdout_limit < 0 or stderr_limit < 0 or deadline <= time.monotonic():
            raise ValueError('FINITE_STREAM_LIMIT_AND_FUTURE_DEADLINE_REQUIRED')
        self.process = process
        self.limits = {'stdout': stdout_limit, 'stderr': stderr_limit}
        self.buffers = {'stdout': bytearray(), 'stderr': bytearray()}
        self.deadline = deadline
        self.read = read
        self.selector = selectors.DefaultSelector()
        self.closed = False
        try:
            for name in ('stdout', 'stderr'):
                pipe = getattr(process, name)
                if pipe is None: raise ValueError('TWO_OWNED_CAPTURE_PIPES_REQUIRED')
                os.set_blocking(pipe.fileno(), False)
                self.selector.register(pipe, selectors.EVENT_READ, name)
        except BaseException:
            self.selector.close()
            raise

    def partial(self):
        return {name: bytes(value) for name, value in self.buffers.items()}

    def pump(self, wait=0):
        if self.closed: raise ValueError('CLOSED_STREAM_COLLECTOR')
        remaining_time = self.deadline - time.monotonic()
        if remaining_time <= 0: raise CollectionFailure('COMMAND_DEADLINE_EXCEEDED', self.partial())
        for key, _mask in self.selector.select(min(wait, remaining_time)):
            name = key.data
            remaining = self.limits[name] - len(self.buffers[name])
            try:
                # At most one sentinel byte beyond the remaining allowance is read.
                # Overflow is detected before the retained buffer can exceed its cap.
                block = self.read(key.fileobj.fileno(), min(65536, remaining + 1))
            except BlockingIOError:
                continue
            except BaseException as error:
                receipt = self.partial(); receipt['readError'] = repr(error)
                raise CollectionFailure('COMMAND_PIPE_READ_FAILURE', receipt) from error
            if not block:
                self.selector.unregister(key.fileobj)
                continue
            self.buffers[name].extend(block[:remaining])
            if len(block) > remaining:
                raise CollectionFailure('COMMAND_' + name.upper() + '_OVERFLOW', self.partial())
        return not bool(self.selector.get_map())

    def collect(self, progress=None):
        while True:
            eof = self.pump(0.05)
            if progress is not None: progress()
            if eof:
                remaining = self.deadline - time.monotonic()
                if remaining <= 0: raise CollectionFailure('COMMAND_DEADLINE_EXCEEDED', self.partial())
                try: self.process.wait(timeout=remaining)
                except subprocess.TimeoutExpired as error:
                    raise CollectionFailure('COMMAND_DEADLINE_EXCEEDED', self.partial()) from error
                if time.monotonic() >= self.deadline:
                    raise CollectionFailure('COMMAND_DEADLINE_EXCEEDED', self.partial())
                return self.partial()

    def close(self):
        errors = []
        if not self.closed:
            try: self.selector.close()
            except BaseException as error: errors.append({'operation': 'selectorClose', 'error': repr(error)})
            for name in ('stdout', 'stderr'):
                try: getattr(self.process, name).close()
                except BaseException as error: errors.append({'operation': name + 'Close', 'error': repr(error)})
            self.closed = True
        return errors


class BoundedFileStream:
    """Stream stdout to a tar consumer while bounding/draining stderr concurrently."""
    def __init__(self, process, stdout_limit, stderr_limit, timeout=60, read=os.read):
        if stdout_limit < 0 or stderr_limit < 0 or timeout <= 0 or timeout > 60:
            raise ValueError('FINITE_FILE_STREAM_LIMITS_REQUIRED')
        self.process = process
        self.stdout_limit = stdout_limit
        self.stderr_limit = stderr_limit
        self.deadline = time.monotonic() + timeout
        self.read_fd = read
        self.pending = bytearray()
        self.stderr = bytearray()
        self.stdout_prefix = bytearray()
        self.stdout_bytes = 0
        self.stdout_eof = False
        self.selector = selectors.DefaultSelector()
        self.closed = False
        try:
            for name in ('stdout', 'stderr'):
                pipe = getattr(process, name)
                os.set_blocking(pipe.fileno(), False)
                self.selector.register(pipe, selectors.EVENT_READ, name)
        except BaseException:
            self.selector.close()
            raise

    def partial(self):
        return {'stdoutPrefix': bytes(self.stdout_prefix), 'stdoutBytes': self.stdout_bytes,
                'stderr': bytes(self.stderr), 'stdoutLimit': self.stdout_limit,
                'stderrLimit': self.stderr_limit}

    def read(self, size):
        if size < 0: raise ValueError('UNBOUNDED_STREAM_READ_FORBIDDEN')
        if size == 0: return b''
        if self.closed: raise ValueError('CLOSED_STREAM_READER')
        while not self.pending and self.selector.get_map():
            remaining_time = self.deadline - time.monotonic()
            if remaining_time <= 0: raise CollectionFailure('STREAM_DEADLINE_EXCEEDED', self.partial())
            for key, _mask in self.selector.select(min(0.05, remaining_time)):
                name = key.data
                remaining = self.stdout_limit - self.stdout_bytes if name == 'stdout' else self.stderr_limit - len(self.stderr)
                try: block = self.read_fd(key.fileobj.fileno(), min(65536, remaining + 1))
                except BlockingIOError: continue
                except BaseException as error:
                    row = self.partial(); row['readError'] = repr(error)
                    raise CollectionFailure('STREAM_PIPE_READ_FAILURE', row) from error
                if not block:
                    self.selector.unregister(key.fileobj)
                    if name == 'stdout': self.stdout_eof = True
                    continue
                accepted = block[:remaining]
                if name == 'stdout':
                    self.pending.extend(accepted); self.stdout_bytes += len(accepted)
                    self.stdout_prefix.extend(accepted[:max(0, 4096 - len(self.stdout_prefix))])
                else: self.stderr.extend(accepted)
                if len(block) > remaining:
                    raise CollectionFailure('STREAM_' + name.upper() + '_OVERFLOW', self.partial())
        result = bytes(self.pending[:min(size, 65536)])
        del self.pending[:len(result)]
        return result

    def finish(self):
        if self.read(1): raise CollectionFailure('STREAM_TRAILING_STDOUT', self.partial())
        remaining = self.deadline - time.monotonic()
        if remaining <= 0: raise CollectionFailure('STREAM_DEADLINE_EXCEEDED', self.partial())
        try: self.process.wait(timeout=remaining)
        except subprocess.TimeoutExpired as error:
            raise CollectionFailure('STREAM_DEADLINE_EXCEEDED', self.partial()) from error
        if time.monotonic() >= self.deadline:
            raise CollectionFailure('STREAM_DEADLINE_EXCEEDED', self.partial())
        row = self.partial(); row['exit'] = self.process.returncode; row['terminal'] = True
        return row

    def close(self):
        errors = []
        if not self.closed:
            try: self.selector.close()
            except BaseException as error: errors.append({'operation': 'streamSelectorClose', 'error': repr(error)})
            for name in ('stdout', 'stderr'):
                try: getattr(self.process, name).close()
                except BaseException as error: errors.append({'operation': name + 'Close', 'error': repr(error)})
            self.closed = True
        return errors


def bounded_command(argv, stdout_limit=1048576, stderr_limit=1048576,
                    timeout=900, env=None, native_pidfd=False, progress=None,
                    popen=subprocess.Popen, read=os.read):
    """Bootstrap uses its created Popen handle; native controller requires pidfd.

    The modes are explicit different obligations. There is no pidfd-to-PID fallback.
    This function cannot dispatch original Task04 commands or accept their lifecycle.
    """
    if timeout <= 0 or timeout > 900 or stdout_limit < 0 or stderr_limit < 0:
        raise ValueError('FINITE_INFRASTRUCTURE_COMMAND_LIMITS')
    began = time.monotonic()
    receipt = {'argv': list(argv), 'authorityMode': 'NATIVE_REQUIRED_PIDFD' if native_pidfd else 'BOOTSTRAP_CREATED_POPEN_HANDLE_ONLY_NOT_TASK04',
               'stdoutLimit': stdout_limit, 'stderrLimit': stderr_limit, 'timeoutSeconds': timeout,
               'stdout': b'', 'stderr': b'', 'signals': [], 'terminal': False, 'closeErrors': []}
    process = streams = None
    pidfd = None
    poll = None
    primary = None
    if native_pidfd:
        # Check the actual syscall before creating a child. hasattr is inadequate.
        ownfd = os.pidfd_open(os.getpid(), 0)
        try:
            receipt['actualNativeSelfSignal0Return'] = signal.pidfd_send_signal(ownfd, 0)
            ownpoll = select.poll(); ownpoll.register(ownfd, select.POLLIN)
            receipt['actualNativeSelfLivePoll'] = ownpoll.poll(0)
            if receipt['actualNativeSelfLivePoll']: raise ValueError('NATIVE_CONTROLLER_ALREADY_TERMINAL')
        finally: os.close(ownfd)
    try:
        try:
            process = popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env=env)
        except BaseException as error:
            receipt['spawnError'] = repr(error)
            raise CollectionFailure('COMMAND_SPAWN_FAILURE', receipt) from error
        receipt['createdChildPID'] = process.pid
        if native_pidfd:
            try:
                pidfd = os.pidfd_open(process.pid, 0)
                poll = select.poll(); poll.register(pidfd, select.POLLIN)
                receipt['actualChildPidfdOpen'] = True
                receipt['actualChildSignal0Return'] = signal.pidfd_send_signal(pidfd, 0)
            except BaseException as error:
                receipt['pidfdError'] = repr(error)
                raise CollectionFailure('COMMAND_NATIVE_PIDFD_BIND_FAILURE_NO_FALLBACK', receipt) from error
        streams = BoundedStreams(process, stdout_limit, stderr_limit, began + timeout, read=read)
        receipt.update(streams.collect(progress))
        receipt['exit'] = process.returncode
        receipt['terminal'] = True
        if time.monotonic() >= began + timeout:
            raise CollectionFailure('COMMAND_DEADLINE_EXCEEDED', receipt)
        if poll is not None:
            receipt['actualChildTerminalPoll'] = poll.poll(0)
            if not receipt['actualChildTerminalPoll']:
                raise CollectionFailure('COMMAND_NATIVE_TERMINAL_POLL_FAILURE', receipt)
    except BaseException as error:
        primary = error
        if streams is not None: receipt.update(streams.partial())
        if isinstance(error, CollectionFailure):
            receipt.update({k: v for k, v in error.receipt.items() if k not in ('stdout', 'stderr')})
        receipt['failure'] = str(error)
        # Signal only the process created by this invocation. Original Task04
        # native authority is never replaced with a numeric-PID/group lookup.
        if process is not None and process.poll() is None:
            try:
                if native_pidfd:
                    if pidfd is None: raise ValueError('NATIVE_CHILD_CLEANUP_AUTHORITY_MISSING_NO_PID_FALLBACK')
                    returned = signal.pidfd_send_signal(pidfd, signal.SIGTERM)
                    receipt['signals'].append({'signal': 'SIGTERM', 'authority': 'actualPidfd', 'return': returned})
                else:
                    returned = process.terminate()
                    receipt['signals'].append({'signal': 'SIGTERM', 'authority': 'createdPopenHandle', 'return': returned})
                try: process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    if native_pidfd: returned = signal.pidfd_send_signal(pidfd, signal.SIGKILL)
                    else: returned = process.kill()
                    receipt['signals'].append({'signal': 'SIGKILL', 'authority': 'actualPidfd' if native_pidfd else 'createdPopenHandle', 'return': returned})
                    process.wait(timeout=3)
            except BaseException as cleanup:
                receipt['cleanupError'] = repr(cleanup)
        if process is not None:
            receipt['terminal'] = process.poll() is not None
            receipt['exit'] = process.returncode
            if poll is not None: receipt['actualChildTerminalPoll'] = poll.poll(0)
    finally:
        if streams is not None: receipt['closeErrors'].extend(streams.close())
        elif process is not None:
            for name in ('stdout', 'stderr'):
                pipe = getattr(process, name)
                if pipe is not None:
                    try: pipe.close()
                    except BaseException as error: receipt['closeErrors'].append({'operation': name + 'Close', 'error': repr(error)})
        if pidfd is not None:
            try: receipt['actualChildPidfdCloseReturn'] = os.close(pidfd)
            except OSError as error: receipt['closeErrors'].append({'operation': 'pidfdClose', 'error': repr(error)})
        receipt['elapsedSeconds'] = time.monotonic() - began
    # Cleanup time is recorded separately and never clears an expired call.
    receipt['absoluteDeadline'] = began + timeout
    receipt['acceptanceCheckedAfterFDCloses'] = True
    if receipt['elapsedSeconds'] >= timeout and primary is None:
        primary = CollectionFailure('COMMAND_DEADLINE_EXCEEDED', receipt)
        receipt['failure'] = 'COMMAND_DEADLINE_EXCEEDED'
    receipt['outcome'] = 'FAILED' if primary is not None or receipt['closeErrors'] or not receipt['terminal'] else 'IN_WINDOW'
    if primary is not None:
        raise CollectionFailure(str(primary), receipt) from primary
    if receipt['closeErrors'] or not receipt['terminal']:
        raise CollectionFailure('COMMAND_OWNED_TERMINAL_OR_CLOSE_FAILURE', receipt)
    return receipt
