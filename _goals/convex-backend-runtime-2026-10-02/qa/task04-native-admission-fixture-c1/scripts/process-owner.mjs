import { spawn } from "node:child_process";
import { linuxGroupMembers, terminal } from "./process-terminal.mjs";
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
/** Each process has its own Linux group; killing the group also owns descendants. */
export class ProcessOwner {
  records = new Set();
  spawned = 0;
  verifiedGroups = 0;
  async reap(record) {
    if (record.reaping) return await record.reaping;
    record.reaping = (async () => {
      if (!Number.isSafeInteger(record.child.pid)) { this.records.delete(record); return; }
      const signal = (kind) => { try { process.kill(-record.child.pid, kind); } catch (error) { if (error.code !== "ESRCH") throw error; } };
      signal("SIGTERM"); await Promise.race([record.closed, delay(100)]);
      // Reap the group even when its leader exited and grandchildren retain pipes.
      signal("SIGKILL"); await Promise.race([record.closed, delay(2_000)]);
      if (!record.exited) throw new Error("OWNED_PROCESS_REAP_FAILED");
      const deadline = Date.now() + 2_000;
      let members, confirmed = false, verified = false;
      do {
        members = linuxGroupMembers(record.child.pid, deadline);
        if (terminal(members)) { if (confirmed) { verified = true; break; } confirmed = true; }
        else { confirmed = false; signal("SIGKILL"); }
        if (Date.now() >= deadline) throw new Error("OWNED_GROUP_NOT_TERMINAL");
        await delay(20);
      } while (Date.now() <= deadline);
      if (!verified) throw new Error("OWNED_GROUP_NOT_TERMINAL");
      // Retain ownership through leader close AND bounded group verification.
      // A failed/unknown verification rejects and keeps this record in the Set.
      record.terminalVerification = { directChildWaited: true, members: members.length, terminalMembers: members.length };
      this.verifiedGroups++;
      this.records.delete(record);
    })();
    return await record.reaping;
  }
  spawn(args, options) {
    if (this.spawned >= 6 || this.records.size >= 2) throw new Error("QA_PROCESS_BUDGET");
    const child = spawn(process.execPath, args, { ...options, detached: true });
    let settle;
    const closed = new Promise((done) => { settle = done; });
    const record = { child, closed, exited: false };
    this.records.add(record); this.spawned++;
    child.once("close", (code, signal) => { record.exited = true; settle({ code, signal }); });
    child.once("error", () => { record.exited = true; settle({ code: -1, signal: "spawn_error" }); });
    return record;
  }
  async run(args, options, timeoutMs = 25_000) {
    const record = this.spawn(args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", bytes = 0, timedOut = false, overflow = false;
    const collect = (which, chunk) => {
      bytes += chunk.length;
      if (bytes > 256_000) { overflow = true; void this.reap(record).catch(() => {}); return; }
      if (which === "stdout") stdout += chunk; else stderr += chunk;
    };
    record.child.stdout.on("data", (chunk) => collect("stdout", chunk));
    record.child.stderr.on("data", (chunk) => collect("stderr", chunk));
    let timeout;
    const expired = new Promise((done) => { timeout = done; });
    const timer = setTimeout(() => { timedOut = true; void this.reap(record).finally(() => timeout({ code: -1, signal: "timeout" })).catch(() => {}); }, timeoutMs);
    try { const result = await Promise.race([record.closed, expired]); await this.reap(record); return { ...result, stdout, stderr, timedOut, overflow }; }
    finally { clearTimeout(timer); }
  }
  async reapAll() { await Promise.allSettled([...this.records].map((record) => this.reap(record))); }
}
