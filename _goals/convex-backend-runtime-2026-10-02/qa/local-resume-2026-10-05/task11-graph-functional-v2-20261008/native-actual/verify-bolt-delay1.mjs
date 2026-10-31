/** Read-only real Bolt check for the QA delay helper. This is not the worker race verdict. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {openOwnedContext, root} from './common.mjs';
import {openOwnedBoltDelayProxy} from './bolt-delay-proxy.mjs';

const context = await openOwnedContext();
const neo4j = createRequire(join(root, 'package.json'))('neo4j-driver');
const credentials = JSON.parse(await readFile(context.pointer.graphCredentials, 'utf8'));
const report = {version: 1, scope: 'READONLY_REAL_BOLT_DELAY_HELPER', node: process.version,
  graphWrites: 0, workerRaceQualified: false, services: [], cleanupErrors: []};
try {
  await context.verifyTarget('verify-bolt-delay1-target-verified');
  for (const [service, config] of Object.entries(credentials)) {
    const proxy = await openOwnedBoltDelayProxy({upstreamPort: new URL(config.uri).port * 1, maximumDelayMs: 10000});
    const auth = neo4j.auth.basic(config.username, config.password);
    const options = {maxConnectionPoolSize: 1, connectionAcquisitionTimeout: 5000, maxTransactionRetryTime: 0};
    const old = neo4j.driver(proxy.uri, auth, options), direct = neo4j.driver(config.uri, auth, options);
    let initial, delayed, newer;
    try {
      initial = old.session();
      assert.equal((await initial.run('RETURN 1 AS value', {}, {timeout: 5000})).records[0].get('value').toNumber(), 1);
      await initial.close(); initial = null;
      proxy.arm();
      delayed = old.session();
      let oldFinished = false;
      const pending = Promise.resolve(delayed.run('RETURN 7 AS value /* CortexRuntimeGraphScope */', {}, {timeout: 5000}))
        .then(value => {oldFinished = true; return value;});
      pending.catch(() => {}); // The main await below owns the outcome; retain rejection if a helper deadline closes the socket.
      const held = await proxy.waitUntilHeld(5000);
      assert.equal(oldFinished, false);
      newer = direct.session();
      assert.equal((await newer.run('RETURN 2 AS value', {}, {timeout: 5000})).records[0].get('value').toNumber(), 2);
      assert.equal(oldFinished, false, 'Direct later query must complete while the old query is still withheld');
      await newer.close(); newer = null;
      proxy.release();
      assert.equal((await pending).records[0].get('value').toNumber(), 7);
      await delayed.close(); delayed = null;
      report.services.push({service, authenticatedBeforeArm: true, actualRunWithheld: held,
        independentDirectQueryCompletedBeforeRelease: true, originalQueryCompletedAfterRelease: true,
        summary: proxy.summary()});
    } finally {
      const close = async action => {try {await action();} catch (error) {report.cleanupErrors.push({name: error?.name ?? 'unknown', code: error?.code ?? 'CLEANUP_FAILED'});}};
      const earlyClose = proxy.summary().state !== 'released';
      if (earlyClose) await close(() => proxy.close());
      for (const session of [initial, delayed, newer]) if (session) await close(() => session.close());
      await close(() => old.close()); await close(() => direct.close());
      if (!earlyClose) await close(() => proxy.close());
    }
  }
  assert.equal(report.cleanupErrors.length, 0);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = {name: error?.name ?? 'unknown', code: error?.code ?? 'BOLT_DELAY_HELPER_FAILED'};
  process.exitCode = 1;
} finally {
  try {await context.close();} catch (error) {report.cleanupErrors.push(context.publicError(error));}
  report.ownedClientsSocketsClosed = report.cleanupErrors.length === 0; report.credentialsPrinted = false;
  if (report.cleanupErrors.length) {report.status = 'FAIL'; process.exitCode = 1;}
  await context.publish('verify-bolt-delay1', report);
  console.log(JSON.stringify({status: report.status, services: report.services.length,
    graphWrites: 0, workerRaceQualified: false, ownedClientsSocketsClosed: report.ownedClientsSocketsClosed}));
}
