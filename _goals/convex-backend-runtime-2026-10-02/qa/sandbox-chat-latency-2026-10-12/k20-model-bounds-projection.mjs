/** Fixed scalar projection for the opt-in original Gateway validation trace. */
const fields = ['inputTokens', 'outputTokens', 'toolSteps', 'timeoutMs', 'contextTokens'];
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
export function projectK20ModelBounds(event) {
  if (!event || event.phase !== 'gateway.model.bounds' || !['native', 'preflight'].includes(event.stage)
    || !count(event.ordinal) || !['semanticIdHash', 'runBudgetIdHash', 'modelIdentityHash'].every(key => hash(event[key]))
    || !event.dimensions || !event.limits || !Array.isArray(event.exceeded)
    || event.exceeded.some(key => !fields.includes(key))) return null;
  const numbers = value => Object.fromEntries(fields.filter(key => count(value[key])).map(key => [key, value[key]]));
  return { phase: event.phase, stage: event.stage, ordinal: event.ordinal,
    semanticIdHash: event.semanticIdHash, runBudgetIdHash: event.runBudgetIdHash, modelIdentityHash: event.modelIdentityHash,
    dimensions: numbers(event.dimensions), limits: numbers(event.limits), exceeded: [...new Set(event.exceeded)] };
}
