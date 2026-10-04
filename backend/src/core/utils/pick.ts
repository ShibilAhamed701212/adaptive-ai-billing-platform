/**
 * Copy only explicitly allowed fields from a request body into an update. Passing `req.body`
 * straight to an update lets a caller rewrite organizationId (moving the record into another
 * tenant), balances, counters or ownership fields.
 */
export function pickFields<K extends string>(body: unknown, allowed: readonly K[]): Partial<Record<K, unknown>> {
  const source = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: Partial<Record<K, unknown>> = {};
  for (const key of allowed) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}
