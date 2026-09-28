/**
 * 极简内存限流（固定窗口），按 key（通常为 IP）计数。
 * 服务端无状态，仅在同一实例内有效，作为 MVP 的基础防护。
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}