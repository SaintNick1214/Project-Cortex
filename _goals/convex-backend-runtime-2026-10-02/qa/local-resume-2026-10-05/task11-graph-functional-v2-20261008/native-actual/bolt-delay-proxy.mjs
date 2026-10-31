/** QA-only real TCP delay. Packets stay in memory and are never logged or persisted.
 * Call arm() only after the old connector's connect() has authenticated and finished schema work.
 * Hold the first apply RUN, before that transaction obtains any remote fence lock.
 */
import assert from 'node:assert/strict';
import net from 'node:net';

function runContains(payload, marker) {
  if ((payload[0] & 0xf0) !== 0xb0 || payload[1] !== 0x10) return false;
  // RUN's first field is the Cypher string. Only inspect it, never parameters/auth messages.
  let offset = 3, length;
  const type = payload[2];
  if ((type & 0xf0) === 0x80) length = type & 0x0f;
  else if (type === 0xd0) {assert.ok(payload.length >= 4); length = payload[3]; offset = 4;}
  else if (type === 0xd1) {assert.ok(payload.length >= 5); length = payload.readUInt16BE(3); offset = 5;}
  else if (type === 0xd2) {assert.ok(payload.length >= 7); length = payload.readUInt32BE(3); offset = 7;}
  else throw new Error('UNSUPPORTED_RUN_QUERY_ENCODING');
  assert.ok(offset + length <= payload.length, 'TRUNCATED_RUN_QUERY');
  return payload.subarray(offset, offset + length).includes(marker);
}

export async function openOwnedBoltDelayProxy({upstreamPort, marker = 'CortexRuntimeGraphScope',
  maximumHeldBytes = 262144, maximumDelayMs = 15000} = {}) {
  assert.ok([51389, 51397].includes(upstreamPort), 'Only the two explicitly owned graph services are allowed');
  assert.ok(['CortexRuntimeGraphScope', 'CortexRuntimeGraphSource'].includes(marker));
  assert.ok(Number.isInteger(maximumHeldBytes) && maximumHeldBytes >= 32768 && maximumHeldBytes <= 262144);
  assert.ok(Number.isInteger(maximumDelayMs) && maximumDelayMs > 0 && maximumDelayMs <= 120000);
  const markerBytes = Buffer.from(marker, 'ascii');
  const sockets = new Set();
  const events = [];
  let state = 'transparent', connection, pending = Buffer.alloc(0), frames = [], payloads = [];
  let assembledBytes = 0, held = [], heldBytes = 0, holdTimer, failure;
  let resolveHold;
  const holdPromise = new Promise(resolve => {resolveHold = resolve;});
  const event = (kind, details = {}) => events.push({kind, elapsedMs: performance.now() - began, ...details});
  const began = performance.now();
  function deny(code) {
    if (!failure) {failure = code; event('failure', {code});}
    state = 'failed'; clearTimeout(holdTimer);
    for (const socket of sockets) socket.destroy();
    resolveHold(false);
  }
  function retain(bytes) {
    heldBytes += bytes.length;
    if (heldBytes > maximumHeldBytes) {deny('HELD_BYTE_LIMIT'); return;}
    held.push(Buffer.from(bytes));
  }
  function forward(bytes) {
    if (!connection.upstream.write(bytes)) {
      connection.client.pause();
      connection.upstream.once('drain', () => connection.client.resume());
    }
  }
  function consume(bytes) {
    if (state === 'transparent' || state === 'released') {forward(bytes); return;}
    if (state === 'held') {retain(bytes); return;}
    if (state !== 'armed') return;
    pending = Buffer.concat([pending, bytes]);
    if (pending.length + assembledBytes > maximumHeldBytes) {deny('FRAME_BYTE_LIMIT'); return;}
    while (pending.length >= 2 && state === 'armed') {
      const length = pending.readUInt16BE(0);
      if (pending.length < length + 2) return;
      const frame = Buffer.from(pending.subarray(0, length + 2));
      pending = pending.subarray(length + 2);
      frames.push(frame); assembledBytes += frame.length;
      if (length !== 0) {payloads.push(frame.subarray(2)); continue;}
      const packet = Buffer.concat(frames), payload = Buffer.concat(payloads);
      frames = []; payloads = []; assembledBytes = 0;
      if (payload.length && runContains(payload, markerBytes)) {
        state = 'held'; retain(packet);
        if (pending.length) {retain(pending); pending = Buffer.alloc(0);}
        event('run-held', {packetBytes: packet.length, marker});
        holdTimer = setTimeout(() => deny('MAXIMUM_DELAY_REACHED'), maximumDelayMs);
        resolveHold(true);
      } else forward(packet);
    }
  }
  const server = net.createServer(client => {
    if (connection || state === 'closed') {client.destroy(); deny('UNEXPECTED_ADDITIONAL_CONNECTION'); return;}
    const upstream = net.createConnection({host: '127.0.0.1', port: upstreamPort});
    connection = {client, upstream}; sockets.add(client); sockets.add(upstream);
    event('connected');
    for (const socket of [client, upstream]) {
      socket.setNoDelay(true);
      socket.on('error', error => deny(error.code ?? 'SOCKET_ERROR'));
      socket.on('close', () => {
        sockets.delete(socket);
        if (state === 'armed' || state === 'held') deny('SOCKET_CLOSED_BEFORE_RELEASE');
      });
    }
    client.on('data', bytes => {try {consume(bytes);} catch {deny('BOLT_FRAME_PARSE_FAILED');}});
    upstream.on('data', bytes => {
      if (!client.write(bytes)) {upstream.pause(); client.once('drain', () => upstream.resume());}
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    uri: 'bolt://127.0.0.1:' + server.address().port,
    arm() {assert.equal(state, 'transparent'); assert.ok(connection); state = 'armed'; event('armed-after-connect');},
    async waitUntilHeld(timeoutMs = 5000) {
      let timer;
      try {
        const held = await Promise.race([holdPromise, new Promise(resolve => {timer = setTimeout(() => resolve(false), timeoutMs);})]);
        assert.equal(held, true, failure ?? 'NO_MATCHING_APPLY_RUN_BEFORE_DEADLINE');
        return {heldBytes, matchedProjectionRun: true};
      } finally {clearTimeout(timer);}
    },
    release() {
      assert.equal(state, 'held'); clearTimeout(holdTimer); state = 'released';
      for (const bytes of held) forward(bytes);
      held = []; event('released', {heldBytes});
    },
    summary() {return {state, events: [...events], heldBytes, maximumHeldBytes, maximumDelayMs, failure: failure ?? null,
      rawPacketContentsRecorded: false, upstreamPort, credentialsRecorded: false};},
    async close() {
      clearTimeout(holdTimer); state = 'closed'; pending = Buffer.alloc(0); frames = []; payloads = []; held = [];
      const closures = [...sockets].map(socket => new Promise(resolve => {socket.once('close', resolve); socket.destroy();}));
      const serverClosed = new Promise(resolve => server.close(resolve));
      await Promise.all([...closures, serverClosed]); event('closed', {ownedSocketCount: sockets.size});
    },
  };
}
