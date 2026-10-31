/** Bounded private metadata only. Never serialize arbitrary Error/request objects. */
import { semanticHash } from './_cortex/shared/domain/profile';

const own = (value: unknown, key: string): unknown => {
  if (!value || typeof value !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
};
export function redactDiagnosticText(value: string, forbidden: readonly string[] = [], cap = 1024): string {
  let text = value;
  for (const secret of forbidden) if (secret) text = text.split(secret).join('[REDACTED_INPUT]');
  text = text.replace(/-----BEGIN [^-\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\n]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/\b(?:dev|prod|preview):[a-z0-9-]+\|[^\s"'\\]+/g, '[REDACTED_DEPLOY_KEY]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/\bBearer\s+[^\s"'\\]+/gi, '[REDACTED_AUTH]')
    .replace(/\b(?:sk|sk-proj|ghp|github_pat)[-_][A-Za-z0-9_-]{8,}/g, '[REDACTED_TOKEN]')
    .replace(/[A-Za-z0-9+/=_-]{128,}/g, '[REDACTED_LONG_VALUE]');
  return text.slice(0, cap);
}
const code = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)
  && !/^(?:sk[-_]|ghp[-_]|github_pat[-_]|eyJ)/i.test(value) ? value : null;
export async function privateDiagnostic(error: unknown, forbidden: readonly string[] = []) {
  const message = own(error, 'message'), body = own(error, 'responseBody');
  const rawMessage = typeof message === 'string' ? message : '';
  const rawBody = typeof body === 'string' ? body : '';
  const data = own(error, 'data'), upstream = own(data, 'error');
  let parsed: unknown;
  if (rawBody.length <= 8192) { try { parsed = JSON.parse(rawBody); } catch { /* Body hash retains non-JSON identity. */ } }
  const responseError = own(parsed, 'error');
  const status = own(error, 'statusCode');
  const statusCode = Number.isSafeInteger(status) && Number(status) >= 100 && Number(status) <= 599 ? Number(status) : null;
  const headers = own(error, 'responseHeaders'), requestIds: Record<string, string> = {};
  for (const key of ['x-request-id', 'request-id', 'x-convex-request-id', 'cf-ray']) {
    const value = own(headers, key); if (typeof value === 'string') requestIds[key] = redactDiagnosticText(value, forbidden, 128);
  }
  const parsedData = own(parsed, 'data');
  const first = Array.isArray(parsedData) ? parsedData[0] : undefined;
  const providerCode = code(own(upstream, 'code')) ?? code(own(responseError, 'code'));
  const name = code(own(error, 'name')) ?? (error instanceof Error ? 'Error' : 'NonError');
  return { version: 1, name, statusCode, providerCode,
    providerType: code(own(upstream, 'type')) ?? code(own(responseError, 'type')),
    message: redactDiagnosticText(rawMessage, forbidden), messageBytes: new TextEncoder().encode(rawMessage).length,
    messageSha256: await semanticHash(rawMessage),
    responseBodyBytes: new TextEncoder().encode(rawBody).length, responseBodySha256: await semanticHash(rawBody),
    responseErrorMessage: redactDiagnosticText(String(own(responseError, 'message') ?? ''), forbidden, 1024),
    bodyShape: { parsed: parsed !== undefined,
      topLevelKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 24).map(key => redactDiagnosticText(key, forbidden, 64)) : [],
      dataLength: Array.isArray(parsedData) ? parsedData.length : null,
      firstItemKeys: first && typeof first === 'object' ? Object.keys(first).slice(0, 24).map(key => redactDiagnosticText(key, forbidden, 64)) : [] },
    requestIds, isRetryable: own(error, 'isRetryable') === true,
    causeName: code(own(own(error, 'cause'), 'name')),
    automaticRetryForbidden: true };
}
