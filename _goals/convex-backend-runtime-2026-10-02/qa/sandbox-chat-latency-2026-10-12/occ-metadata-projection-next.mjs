/** Prospective metadata only; K15 discarded these fields and cannot be repaired. */
import { createHash } from 'node:crypto';
const digest = value => createHash('sha256').update(value).digest('hex');
const scalar = value => typeof value === 'string' && value.length > 0 && value.length <= 512;
const path = value => scalar(value) && /^[A-Za-z0-9_./:-]+$/.test(value);
const knownFunction = value => path(value) && /^(?:runtime[A-Za-z0-9_]*|runs|agents|agent|workflow|workpool)(?:[./][A-Za-z0-9_./-]+)?:[A-Za-z0-9_]+$/.test(value);
export function projectOccMetadata(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const out = {};
  if (Number.isSafeInteger(input.retryCount) && input.retryCount >= 0) out.retryCount = input.retryCount;
  for (const key of ['tableName', 'componentPath']) if (path(input[key])) out[key] = input[key];
  if (scalar(input.documentId)) out.documentIdSha256 = digest(input.documentId);
  if (scalar(input.writeSource)) {
    if (knownFunction(input.writeSource)) out.writeSource = input.writeSource;
    else out.writeSourceSha256 = digest(input.writeSource);
  }
  return out;
}
