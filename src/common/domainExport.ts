import { convexToJson, type Value } from "convex/values";
import type { Conversation, FactRecord, MemoryEntry } from "../types";

/** Full official Convex JSON. Callers pass persisted documents, without SDK receipts. */
export function domainJson(value: unknown): string { return JSON.stringify(convexToJson(clean(value) as Value), null, 2); }
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object" && !(value instanceof ArrayBuffer)) return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, clean(v)]));
  return value;
}
export function domainCsv(headers: string[], rows: unknown[][]): string {
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.map(quote).join(","), ...rows.map(row => row.map(quote).join(","))].join("\r\n");
}
export function memoryExport(memories: MemoryEntry[], options: {format: "json" | "csv"; includeEmbeddings?: boolean; includeFacts?: boolean}, facts: FactRecord[] = []) {
  const projectFacts = (m: MemoryEntry) => facts.filter(f => f.sourceRef?.memoryId === m.memoryId).map(f => ({factId: f.factId, fact: f.fact, factType: f.factType, confidence: f.confidence, tags: f.tags}));
  const data = options.format === "json" ? domainJson(memories.map(m => ({memoryId: m.memoryId, content: m.content, sourceType: m.sourceType, importance: m.importance, tags: m.tags, createdAt: m.createdAt, ...(options.includeEmbeddings && m.embedding ? {embedding: m.embedding} : {}), ...(options.includeFacts ? {facts: projectFacts(m)} : {})}))) : domainCsv(["memoryId", "content", "sourceType", "importance", "tags", "createdAt", ...(options.includeFacts ? ["facts"] : [])], memories.map(m => [m.memoryId, m.content, m.sourceType, m.importance, m.tags.join(";"), new Date(m.createdAt).toISOString(), ...(options.includeFacts ? [domainJson(projectFacts(m))] : [])]));
  return {format: options.format, data, count: memories.length, exportedAt: Date.now()};
}
export function factsExport(facts: FactRecord[], format: "json" | "jsonld" | "csv") {
  const data = format === "json" ? domainJson(facts) : format === "jsonld" ? domainJson({"@context": "https://schema.org/", "@graph": facts.map(f => ({"@type": "Fact", "@id": f.factId, subject: f.subject, predicate: f.predicate, object: f.object, factStatement: f.fact, confidence: f.confidence, factType: f.factType, dateCreated: new Date(f.createdAt).toISOString(), ...(f.validFrom !== undefined ? {validFrom: new Date(f.validFrom).toISOString()} : {}), ...(f.validUntil !== undefined ? {validThrough: new Date(f.validUntil).toISOString()} : {})}))}) : domainCsv(["factId", "fact", "factType", "subject", "predicate", "object", "confidence", "sourceType", "tags", "createdAt"], facts.map(f => [f.factId, f.fact, f.factType, f.subject, f.predicate, f.object, f.confidence, f.sourceType, f.tags.join(";"), new Date(f.createdAt).toISOString()]));
  return {format, data, count: facts.length, exportedAt: Date.now()};
}
export function conversationsExport(conversations: Conversation[], format: "json" | "csv", includeMetadata?: boolean) {
  const data = format === "json" ? domainJson(conversations.map(c => ({conversationId: c.conversationId, type: c.type, participants: c.participants, messages: c.messages, messageCount: c.messageCount, createdAt: c.createdAt, updatedAt: c.updatedAt, ...(includeMetadata && c.metadata ? {metadata: c.metadata} : {})}))) : domainCsv(["conversationId", "type", "participants", "messageCount", "createdAt", "updatedAt", ...(includeMetadata ? ["metadata"] : [])], conversations.map(c => [c.conversationId, c.type, domainJson(c.participants), c.messageCount, new Date(c.createdAt).toISOString(), new Date(c.updatedAt).toISOString(), ...(includeMetadata ? [domainJson(c.metadata ?? {})] : [])]));
  return {format, data, count: conversations.length, exportedAt: Date.now()};
}
