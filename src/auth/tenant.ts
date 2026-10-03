import { AuthValidationError } from './validators';

/** Keep a scoped SDK instance on its configured tenant. Server authorization is still required. */
export function resolveTenantId(configured?: string, requested?: string): string | undefined {
  if (configured !== undefined && requested !== undefined && configured !== requested) {
    throw new AuthValidationError('Requested tenant does not match the SDK auth context', 'TENANT_SCOPE_MISMATCH', 'tenantId');
  }
  return configured ?? requested;
}
