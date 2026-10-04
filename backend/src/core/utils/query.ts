const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

/** Escape user text so it matches literally inside a MongoDB $regex (no injection, no ReDoS). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" matcher for list search boxes. */
export function containsText(value: unknown): { $regex: string; $options: string } {
  return { $regex: escapeRegex(String(value).trim().slice(0, 100)), $options: 'i' };
}

/** Parse ?page=&limit= defensively: integers only, page >= 1, 1 <= limit <= MAX_PAGE_SIZE. */
export function parsePagination(page: unknown, limit: unknown): { page: number; limit: number; skip: number } {
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const l = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(limit)) || DEFAULT_PAGE_SIZE));
  return { page: p, limit: l, skip: (p - 1) * l };
}
