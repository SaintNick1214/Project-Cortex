"""Finite coordinator capture only; it accepts no product/native outcome."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import time

PIPE_LIMIT = 262144
INPUT_LIMIT = 327692

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def durable(path, raw):
    path = Path(path)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        data = memoryview(raw)
        while data:
            count = os.write(fd, data)
            if count <= 0:
                raise OSError('coordinator_write_failure')
            data = data[count:]
        os.fsync(fd)
    finally:
        os.close(fd)
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)

def durable_json(path, value):
    durable(path, (json.dumps(value, indent=2) + '\n').encode())

def run(label, argv, output_directory, timeout, env, input_bytes=None, progress=None, required=True):
    if not label or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in label):
        raise ValueError('fixed_receipt_label_required')
    if not 0 < timeout <= 190:
        raise ValueError('finite_command_timeout_required')
    if input_bytes is not None and not 0 < len(input_bytes) <= INPUT_LIMIT:
        raise ValueError('finite_stdin_required')
    output_directory = Path(output_directory)
    start = time.monotonic()
    deadline = start + timeout
    input_deadline = start + 12
    observed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    outputs = {'stdout': bytearray(), 'stderr': bytearray()}
    counts = {'stdout': 0, 'stderr': 0}
    offset = 0
    process = selector = None
    failure = None
    close_errors = []
    try:
        process = subprocess.Popen(argv, cwd=env['CORTEX_COORDINATOR_CWD'],
                                   env={k: v for k, v in env.items() if k != 'CORTEX_COORDINATOR_CWD'},
                                   stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        selector = selectors.DefaultSelector()
        for name in outputs:
            stream = getattr(process, name)
            os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_READ, name)
        if process.stdin is not None:
            os.set_blocking(process.stdin.fileno(), False)
            selector.register(process.stdin, selectors.EVENT_WRITE, 'stdin')
        while selector.get_map():
            if time.monotonic() >= deadline:
                raise TimeoutError('finite_command_deadline')
            if process.stdin is not None and not process.stdin.closed and time.monotonic() >= input_deadline:
                raise TimeoutError('finite_stdin_deadline')
            if progress is not None:
                progress()
            for key, _ in selector.select(min(0.05, max(0, deadline - time.monotonic()))):
                stream = key.fileobj
                if key.data == 'stdin':
                    if time.monotonic() >= input_deadline:
                        raise TimeoutError('finite_stdin_deadline')
                    count = os.write(stream.fileno(), input_bytes[offset:offset + 16384])
                    if count <= 0:
                        raise OSError('stdin_write_failure')
                    offset += count
                    if offset == len(input_bytes):
                        selector.unregister(stream)
                        stream.close()
                    continue
                name = key.data
                remaining = PIPE_LIMIT - len(outputs[name])
                try:
                    raw = os.read(stream.fileno(), min(16384, remaining + 1))
                except BlockingIOError:
                    continue
                if not raw:
                    selector.unregister(stream)
                    stream.close()
                    continue
                counts[name] += len(raw)
                outputs[name].extend(raw[:remaining])
                if len(raw) > remaining:
                    raise ValueError('finite_output_overflow')
        process.wait(timeout=max(0.001, deadline - time.monotonic()))
        if time.monotonic() >= deadline:
            raise TimeoutError('finite_command_deadline')
        if progress is not None:
            progress()
    except BaseException as error:
        failure = type(error).__name__
        if process is not None and process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=10)
            except BaseException as cleanup_error:
                close_errors.append(type(cleanup_error).__name__)
    finally:
        if selector is not None:
            selector.close()
        if process is not None:
            for stream in (process.stdin, process.stdout, process.stderr):
                if stream is not None and not stream.closed:
                    try:
                        stream.close()
                    except BaseException as close_error:
                        close_errors.append(type(close_error).__name__)
    row = {'label': label, 'argv': list(argv), 'observedAtUtc': observed_at,
           'elapsedSeconds': time.monotonic() - start,
           'exitCode': process.returncode if process is not None else None,
           'failureClass': failure, 'streamByteCounts': counts, 'stdinBytes': offset,
           'pipeLimits': PIPE_LIMIT, 'stdinLimit': INPUT_LIMIT, 'stdinDeadlineSeconds': 12,
           'terminal': process is not None and process.poll() is not None,
           'closeErrors': close_errors, 'privateContentsPrinted': False}
    for name in outputs:
        raw = bytes(outputs[name])
        durable(output_directory / (label + '.' + name), raw)
        row[name + 'Sha256'] = hashlib.sha256(raw).hexdigest()
    durable_json(output_directory / (label + '.receipt.json'), row)
    if required and (failure is not None or row['exitCode'] != 0 or close_errors or not row['terminal']):
        raise RuntimeError('bounded_coordinator_command_failed')
    return row, bytes(outputs['stdout']), bytes(outputs['stderr'])
