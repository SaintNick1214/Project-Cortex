from pathlib import Path
N=Path(__file__).resolve().parents[1];p=N/'source/ci-run.py';t=p.read_text().replace('from native_contract import Held,strict,identity,demand,host_demand','from native_contract import Held,strict,identity,demand,host_demand,proc')
a=t.index('\ndef run_phase(');b=t.index('\ndef export_phase(',a)
t=t[:a]+'''
def run_phase(mode,seconds):
    phase(mode+'-execution',seconds);began=time.monotonic()
    polls=[];owner=None;owner_fd=None;primary=None;terminal=None;close_result=None
    try:
        call(['docker','start',OWNED_ID],cap=65536)
        while True:
            remaining()
            row=inspect();polls.append(validate(row,EXPECTED,started=True))
            if len(polls)>640:raise ValueError('FINITE_PHASE_POLL_COUNT')
            if row['State']['Running']:
                pid=row['State']['Pid']
                if owner is None:
                    before=proc(pid);owner_fd=os.pidfd_open(pid,0)
                    opened=proc(pid)
                    if before!=opened:raise ValueError('PHASE_OWNER_PIDFD_ACQUISITION_DRIFT')
                    expected_script='/native-source/native-controller.py'if mode=='native20'else '/reviewed-bootstrap.py'
                    argv=('/usr/local/bin/python3.12'+chr(0)+'-B'+chr(0)+expected_script+chr(0)).encode().hex()
                    if opened['rawArgvHex']!=argv:raise ValueError('EXACT_PHASE_OWNER_KERNEL_ARGV')
                    status=Path('/proc',str(pid),'status').read_text()
                    nsline=next(line for line in status.splitlines()if line.startswith('NSpid:'))
                    if int(nsline.split()[-1])!=1:raise ValueError('ACTUAL_PHASE_NAMESPACE_PID1')
                    owner={**opened,'namespacePID':1,'containerID':OWNED_ID,'labels':LABELS,
                        'scope':'POST_START_OBSERVED_OWNER_NOT_BEFORE_FIRST_USE_STARTUP_PROOF'}
                elif pid!=owner['pid']or proc(pid)['startTime']!=owner['startTime']:
                    raise ValueError('CURRENT_PHASE_OWNER_REPLACED')
                signal.pidfd_send_signal(owner_fd,0)
                poll=select.poll();poll.register(owner_fd,select.POLLIN)
                if poll.poll(0):raise ValueError('RUNNING_PHASE_OWNER_ALREADY_TERMINAL')
            else:
                if row['State']['Pid']!=0 or row['State']['Status']!='exited':raise ValueError('EXACT_PHASE_TERMINAL')
                if owner_fd is None:raise ValueError('PHASE_TERMINAL_WITHOUT_OBSERVED_CURRENT_OWNER_HOLD')
                poll=select.poll();poll.register(owner_fd,select.POLLIN)
                if not poll.poll(0):raise ValueError('PHASE_OWNER_PIDFD_TERMINAL_NOT_READY')
                remaining();terminal=row['State'];break
            time.sleep(min(1,remaining()))
    except BaseException as error:
        primary=error
    finally:
        if owner_fd is not None:
            try:close_result=os.close(owner_fd)
            except BaseException as error:primary=primary or error
        try:remaining()
        except BaseException as error:primary=primary or error
        save(mode+'-terminal.json',{'actual':terminal,'elapsedSeconds':time.monotonic()-began,
            'originalPhaseBound':seconds,'owner':owner,'ownerPidfdCloseReturn':close_result,
            'closeCompleted':owner_fd is not None and close_result is None,
            'nativeOwnerExpiredAtTerminal':terminal is not None,'noCrossPhaseLiveCustody':True,
            'outcome':'FAILED'if primary else 'IN_WINDOW','failure':repr(primary)if primary else None})
        save(mode+'-polls.json',polls)
    if primary:raise primary
    return terminal['ExitCode']

''' +t[b:]
p.write_text(t)
