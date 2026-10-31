/** Isolated admin-internal commissioning collector only. No shipped fetch override. */
export type ImageWireObservation = {
  issuedRequests: 1; nativeHttpStatus: number; requestBytes: number; requestHash: string;
  encodedResponseBytes: number; rawModelId: string | null; rawUsageCanonical: string | null;
  servingModelIdentityUnqualified: true; aggregateCostCompletenessUnattested: true;
};
const utf8 = (value: string) => new TextEncoder().encode(value).length;
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
};
async function hash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** The callback must forward the product's exact original job/ledger checkpoint,
 * then persist an issued receipt before the official native HTTP request. */
export async function withImageWireCollector<T>(args: {
  expectedBody: { model: 'openai/gpt-image-1'; prompt: string; n: 1; size: '1024x1024'; quality: 'low'; output_format: 'png' };
  beforeDispatch: () => Promise<void>; observe: (value: ImageWireObservation) => Promise<void>;
  work: () => Promise<T>;
}): Promise<T> {
  const expected = canonical(args.expectedBody);
  if (!args.expectedBody.prompt.trim() || utf8(args.expectedBody.prompt) > 1024 || utf8(expected) > 8192) throw Error('COMMISSION_IMAGE_INPUT_LIMIT');
  const original = globalThis.fetch;
  let issued = false;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url !== 'https://ai-gateway.convex.dev/v1/images/generations' || init?.method !== 'POST'
      || typeof init.body !== 'string' || utf8(init.body) !== utf8(expected) || canonical(JSON.parse(init.body)) !== expected || issued) throw Error('COMMISSION_IMAGE_WIRE_MISMATCH');
    if (!new Headers(init.headers).get('Authorization')?.startsWith('Bearer ')) throw Error('COMMISSION_SERVICE_JWT_MISSING');
    // This runs after the official factory has awaited its service JWT. No token
    // values, response binary or private handles enter the public observations.
    await args.beforeDispatch();
    issued = true;
    const response = await original(input, init);
    if (!response.body) throw Error('COMMISSION_IMAGE_BODY_MISSING');
    const reader = response.body.getReader(), chunks: ArrayBuffer[] = [];
    let total = 0;
    try {
      for (;;) {
        const item = await reader.read(); if (item.done) break;
        total += item.value.byteLength;
        if (total > 28_000_000) throw Error('COMMISSION_IMAGE_ENCODED_RESPONSE_TOO_LARGE');
        chunks.push(new Uint8Array(item.value).buffer);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
    const collected = new Blob(chunks), text = await collected.text();
    let rawModelId: string | null = null, rawUsageCanonical: string | null = null;
    try {
      const body = JSON.parse(text) as { model?: unknown; usage?: unknown };
      if (typeof body.model === 'string' && utf8(body.model) <= 256) rawModelId = body.model;
      if (body.usage !== undefined) { const value = canonical(body.usage); if (utf8(value) <= 8192) rawUsageCanonical = value; }
    } catch { /* Official native parsing still determines response validity. */ }
    await args.observe({issuedRequests: 1, nativeHttpStatus: response.status, requestBytes: utf8(expected), requestHash: await hash(expected),
      encodedResponseBytes: total, rawModelId, rawUsageCanonical, servingModelIdentityUnqualified: true, aggregateCostCompletenessUnattested: true});
    return new Response(collected, {status: response.status, statusText: response.statusText, headers: response.headers});
  };
  try { return await args.work(); }
  finally { globalThis.fetch = original; }
}
