import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, randomInt } from 'node:crypto';

/** First hop of x-forwarded-for (set by Vercel's edge), else the socket address. */
export function clientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff || '').split(',')[0].trim();
  const real = req.headers['x-real-ip'];
  return first || (Array.isArray(real) ? real[0] : real) || req.socket?.remoteAddress || 'unknown';
}

export function send(
  res: VercelResponse,
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.status(status).json(body);
}

/** Vercel parses JSON bodies; anything else (or oversized) becomes null. */
export function jsonBody(req: VercelRequest): unknown {
  const body = req.body;
  if (body == null) return null;
  if (typeof body === 'string') {
    if (body.length > 2048) return null;
    try { return JSON.parse(body); } catch { return null; }
  }
  return body;
}

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** 250–550 ms, uniform for success and failure paths. */
export const settle = (): Promise<void> => new Promise(r => setTimeout(r, 250 + randomInt(0, 300)));

export function logEvent(event: string, detail: Record<string, unknown> = {}): void {
  // Structured, PII-light: no DOBs, no full phone numbers, no emails.
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...detail }));
}

/** Serialise Firestore values (Timestamps → ISO strings) for JSON transport. */
export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function') {
      return (v as { toDate: () => Date }).toDate().toISOString();
    }
    return v;
  })) as T;
}
