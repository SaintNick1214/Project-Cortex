/** Prepared SOURCE/MOCK oracle. Imports no U3 source and performs no I/O. */
import assert from 'node:assert/strict';

export class VirtualFDs {
  constructor({openFailure = null, fstatFailure = null, closeFailures = []} = {}) {
    this.openFailure = openFailure;
    this.fstatFailure = fstatFailure;
    this.closeFailures = new Set(closeFailures);
    this.openCalls = [];
    this.successfulOpens = [];
    this.closeCalls = [];
    this.closeErrors = [];
    this.events = [];
  }
  openSync(label) {
    const index = this.openCalls.length;
    this.openCalls.push(label);
    this.events.push(['open-attempt', index, label]);
    if (index === this.openFailure) throw Error(`open:${index}`);
    const fd = 20001 + index;
    this.successfulOpens.push(fd);
    this.events.push(['open-return', fd]);
    return fd;
  }
  fstatSync(fd) {
    assert.ok(this.successfulOpens.includes(fd), 'fstat_foreign_fd');
    this.events.push(['fstat', fd]);
    if (this.successfulOpens.indexOf(fd) === this.fstatFailure) throw Error(`fstat:${fd}`);
    return {fd, stable: true};
  }
  closeSync(fd) {
    this.closeCalls.push(fd);
    this.events.push(['close-attempt', fd]);
    assert.ok(this.successfulOpens.includes(fd), 'foreign_close');
    assert.equal(this.closeCalls.filter(x => x === fd).length, 1, 'unknown_close_retry');
    if (this.closeFailures.has(fd)) {
      const error = `close:${fd}`;
      this.closeErrors.push(error);
      throw Error(error);
    }
    this.events.push(['close-return', fd]);
  }
}

export function assertLifetime(system, {accepted, observedErrors, expectedErrors = []}) {
  assert.equal(typeof accepted, 'boolean', 'acceptance_must_be_exact_bool');
  assert.deepEqual([...system.closeCalls].sort(), [...system.successfulOpens].sort(),
    'each_successful_open_must_have_exactly_one_close_attempt');
  for (const error of [...expectedErrors, ...system.closeErrors]) {
    assert.ok(observedErrors.includes(error), `sticky_error_lost:${error}`);
  }
  if (expectedErrors.length || system.closeErrors.length) {
    assert.equal(accepted, false, 'failure_must_deny_acceptance');
  }
  return {opened: [...system.successfulOpens], closeAttempts: [...system.closeCalls],
    closeFailures: [...system.closeErrors], accepted, observedErrors: [...observedErrors]};
}
