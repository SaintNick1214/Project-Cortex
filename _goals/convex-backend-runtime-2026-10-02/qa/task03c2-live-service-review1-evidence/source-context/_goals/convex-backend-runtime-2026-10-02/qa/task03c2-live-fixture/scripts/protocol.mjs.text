import { cases } from "./cases.mjs";
import { reasons } from "./case-ledger.mjs";
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const reject = () => { throw new Error("PROTOCOL_REJECTED"); };
export const variants = Object.freeze(["valid", "wrong-issuer", "wrong-audience", "expired", "forged"]);
export function validateMessage(message) {
  if (Buffer.byteLength(JSON.stringify(message)) > 16_384) reject();
  if (message?.type === "case-start" && exact(message, ["type", "name"]) && cases.includes(message.name)) return message;
  if (message?.type === "case-end" && exact(message, ["type", "name", "status", "reason"]) && cases.includes(message.name)
    && ["PASS", "FAIL", "BLOCKED"].includes(message.status) && reasons.includes(message.reason)) return message;
  if (message?.type === "case-block" && exact(message, ["type", "name"]) && cases.includes(message.name)) return message;
  if (message?.type === "complete" && exact(message, ["type"])) return message;
  if (message?.type === "ready" && exact(message, ["type"])) return message;
  if (message?.type === "metric" && exact(message, ["type", "name", "baseline", "updated", "before", "after", "quietMs", "payloadFields", "observedValues"])
    && ["sdk-logout", "late-credential-fencing"].includes(message.name)
    && (message.name === "sdk-logout" ? message.baseline === 41 && message.updated === 42 : message.baseline === 42 && message.updated === 43)
    && Number.isSafeInteger(message.before) && message.before >= 1 && message.after === message.before && message.quietMs === 750
    && Array.isArray(message.payloadFields) && message.payloadFields.join(",") === "value"
    && Array.isArray(message.observedValues) && message.observedValues.length > 0 && message.observedValues.length <= 64
    && message.observedValues.length === message.before && message.observedValues.every((value) => value === message.baseline)) return message;
  if (message?.type === "rpc" && exact(message, ["type", "id", "action", "args"]) && Number.isSafeInteger(message.id) && message.id > 0) {
    if (message.action === "sign" && exact(message.args, ["subject", "variant"]) && typeof message.args.subject === "string" && variants.includes(message.args.variant)) return message;
    if (message.action === "operator" && exact(message.args, ["name", "args"]) && typeof message.args.name === "string" && message.args.args && typeof message.args.args === "object" && !Array.isArray(message.args.args)) return message;
  }
  reject();
}
/** The interception audit is accepted only by the offline engine branch. */
export function validateOfflineAudit(message) {
  if (!exact(message, ["type", "sensitiveReads", "keyValues", "selectorVariables", "networkAttempts", "privateProtocolFields"]) || message.type !== "offline-audit"
    || ["sensitiveReads", "keyValues", "selectorVariables", "networkAttempts", "privateProtocolFields"].some((key) => !Number.isSafeInteger(message[key]) || message[key] < 0 || message[key] > 1_000)) reject();
  return message;
}
export function sdkEnvironment(env) {
  const selected = {};
  for (const name of ["PATH", "LANG", "CI", "NO_COLOR", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "no_proxy", "NODE_EXTRA_CA_CERTS", "NODE_USE_ENV_PROXY"]) {
    if (env[name]) selected[name] = env[name];
  }
  return selected;
}
const referenceFields = ["principalId", "principalVersion", "membershipId", "membershipVersion", "grantId", "grantVersion", "tenantId", "tenantEpoch", "memorySpaceId", "memorySpaceEpoch"];
export class AuthorityProtocol {
  constructor(runId) { this.runId = runId; this.owned = []; this.attemptedScopes = new Map(); this.operations = []; }
  validateOperator(name, args) {
    const scope = (value) => typeof value.tenantId === "string" && value.tenantId.startsWith(`task03c2-${this.runId}-`)
      && (value.memorySpaceId === undefined || (typeof value.memorySpaceId === "string" && value.memorySpaceId.startsWith(`space-${this.runId}-`)));
    const knownReference = (reference) => this.owned.some((row) => referenceFields.every((key) => row.reference[key] === reference?.[key]) && Object.keys(reference).every((key) => referenceFields.includes(key)));
    const keys = Object.keys(args);
    if (name === "runtimeAuth:provision") {
      if (!exact(args, ["issuer", "subject", "actorKind", "metadataUserId", "tenantId", "memorySpaceId", "capabilities", "resourceAccess"])
        || args.issuer !== "https://cortex-qualification.invalid" || args.actorKind !== "user"
        || !args.subject.startsWith(`subject-${this.runId}-`) || !args.metadataUserId.startsWith(`user-${this.runId}-`)
        || !scope(args) || !Array.isArray(args.capabilities) || !args.capabilities.length || args.capabilities.some((value) => !["read", "write", "admin"].includes(value))
        || !["own", "space"].includes(args.resourceAccess)) reject();
      this.attemptedScopes.set(args.tenantId, { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId });
      return;
    }
    const idKey = name === "runtimeAuth:revokeGrant" ? "grantId" : name === "runtimeAuth:revokeMembership" ? "membershipId" : name === "runtimeAuth:deletePrincipal" ? "principalId" : undefined;
    if (idKey && exact(args, [idKey]) && this.owned.some((row) => row.reference[idKey] === args[idKey])) return;
    if (name === "runtimeAuth:deleteScope" && keys.every((key) => ["tenantId", "memorySpaceId"].includes(key)) && scope(args)
      && this.attemptedScopes.has(args.tenantId) && (args.memorySpaceId === undefined || args.memorySpaceId === this.attemptedScopes.get(args.tenantId).memorySpaceId)) return;
    if (name === "runtimeAuth:recheck" && exact(args, ["reference", "requirement"]) && knownReference(args.reference)
      && exact(args.requirement, ["capability", "tenantId", "memorySpaceId"]) && ["read", "write"].includes(args.requirement.capability)
      && args.requirement.tenantId === args.reference.tenantId && args.requirement.memorySpaceId === args.reference.memorySpaceId) return;
    if (["sessions:incrementMessageCount", "sessions:incrementMemoryCount"].includes(name) && exact(args, ["sessionId", "reference"]) && knownReference(args.reference)
      && typeof args.sessionId === "string" && [`sdk-session-${this.runId}`, `revoked-worker-${this.runId}`].includes(args.sessionId)) return;
    reject();
  }
  enroll(args, result) {
    const fields = [...referenceFields, "actorKind", "userId", "capabilities", "resourceAccess"];
    if (!exact(result, fields) || result.actorKind !== "user" || result.userId !== args.metadataUserId
      || result.tenantId !== args.tenantId || result.memorySpaceId !== args.memorySpaceId || result.resourceAccess !== args.resourceAccess
      || !Array.isArray(result.capabilities) || [...result.capabilities].sort().join(",") !== [...new Set(args.capabilities)].sort().join(",")) reject();
    const reference = {};
    for (const key of referenceFields) {
      if (key.endsWith("Id")) { if (typeof result[key] !== "string" || !result[key]) reject(); }
      else if (!Number.isSafeInteger(result[key]) || result[key] < 1) reject();
      reference[key] = result[key];
    }
    this.owned.push({ subject: args.subject, userId: args.metadataUserId, scope: { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId }, reference });
    return Object.fromEntries(fields.map((key) => [key, result[key]]));
  }
  validateSign(subject, variant) {
    if (!variants.includes(variant) || (!this.owned.some((row) => row.subject === subject) && subject !== `unprovisioned-${this.runId}`)) reject();
  }
}
