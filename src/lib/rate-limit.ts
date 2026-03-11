const windowMs = 60_000;
const maxRequests = 30;

const hits = new Map<string, number[]>();

export function rateLimit(ip: string): { limited: boolean } {
  const now = Date.now();
  const timestamps = hits.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return { limited: recent.length > maxRequests };
}
