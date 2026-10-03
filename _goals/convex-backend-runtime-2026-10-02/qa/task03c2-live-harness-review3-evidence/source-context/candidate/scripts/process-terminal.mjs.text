import { readdirSync, readFileSync } from "node:fs";
/** Linux /proc group snapshot. An unreadable or malformed row is unknown, never
 * terminal. Zombies remain owned by PID1; this does not claim waitpid authority.
 */
export function linuxGroupMembers(groupId, deadline) {
  if (process.platform !== "linux" || !Number.isSafeInteger(groupId) || groupId < 1) throw new Error("OWNED_GROUP_VERIFICATION_UNAVAILABLE");
  const members = [];
  for (const name of readdirSync("/proc")) {
    if (!/^[0-9]+$/.test(name)) continue;
    if (Date.now() > deadline) throw new Error("OWNED_GROUP_VERIFICATION_TIMEOUT");
    let stat;
    try { stat = readFileSync(`/proc/${name}/stat`, "utf8"); }
    catch (error) { if (error.code === "ENOENT" || error.code === "ESRCH") continue; throw new Error("OWNED_GROUP_VERIFICATION_UNAVAILABLE", { cause: error }); }
    const end = stat.lastIndexOf(")"), fields = stat.slice(end + 2).trim().split(/ +/);
    if (end < 1 || fields.length < 20 || !/^[A-Za-z]$/.test(fields[0]) || !/^[0-9]+$/.test(fields[2])) throw new Error("OWNED_GROUP_VERIFICATION_UNAVAILABLE");
    if (Number(fields[2]) === groupId) members.push({ pid: Number(name), state: fields[0] });
  }
  return members;
}
export const terminal = (members) => members.every((row) => row.state === "Z" || row.state === "X");
