/**
 * /api/parent-login behaviour, with every Firebase dependency faked:
 * valid and invalid credentials, uniform failure responses (no account
 * enumeration), per-code and per-IP rate limits, Google-account linking.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createParentLoginHandler, type ParentLoginDeps, type LoginStudent } from '../api/_lib/parent-login-core';
import { RATE_LIMIT, applyRateLimit, type AttemptWindow, type ParentClaims } from '@/lib/parent-portal/core';

const STUDENTS: LoginStudent[] = [
  { id: 'stu-a', name: 'Arun', phone: '98765 43210', email: 'ravi.k@gmail.com', dob: new Date(2018, 5, 15), status: 'active' },
  { id: 'stu-b', name: 'Bala', phone: '9876543210', email: '', dob: new Date(2020, 0, 2), status: 'active' },
  { id: 'stu-x', name: 'Xavi', phone: '9000001111', email: 'xavi@x.com', dob: new Date(2019, 2, 3), status: 'archived' },
];

interface Harness {
  handle: ReturnType<typeof createParentLoginHandler>;
  tokens: Array<{ uid: string; claims: ParentClaims }>;
  claimsSet: Array<{ uid: string; claims: ParentClaims }>;
  users: Array<{ uid: string; data: Record<string, unknown> }>;
  logs: string[];
  settles: number;
  windows: Map<string, AttemptWindow>;
  verify: ParentLoginDeps['verifyIdToken'];
  now: number;
}

function harness(overrides: Partial<ParentLoginDeps> = {}): Harness {
  const h = {
    tokens: [], claimsSet: [], users: [], logs: [], settles: 0,
    windows: new Map<string, AttemptWindow>(), now: 1_700_000_000_000,
    verify: (async () => { throw new Error('bad token'); }) as ParentLoginDeps['verifyIdToken'],
  } as unknown as Harness;
  const deps: ParentLoginDeps = {
    loadStudents: async () => STUDENTS,
    consumeAttempt: async (bucket, key, limit, now) => {
      const k = `${bucket}:${key}`;
      const d = applyRateLimit(h.windows.get(k) || null, limit, now);
      if (d.allowed) h.windows.set(k, d.next);
      return { allowed: d.allowed, retryAfterSec: d.retryAfterSec };
    },
    createCustomToken: async (uid, claims) => { h.tokens.push({ uid, claims }); return `tok-${uid}`; },
    verifyIdToken: (t) => h.verify(t),
    setParentClaims: async (uid, claims) => { h.claimsSet.push({ uid, claims }); },
    upsertParentUser: async (uid, data) => { h.users.push({ uid, data }); },
    familyUid: key => `parent_${key}`,
    now: () => h.now,
    settle: async () => { h.settles += 1; },
    log: e => { h.logs.push(e); },
    ...overrides,
  };
  h.handle = createParentLoginHandler(deps);
  return h;
}

const post = (body: unknown, ip = '1.2.3.4') => ({ method: 'POST', ip, body });

describe('parent-login: credentials', () => {
  let h: Harness;
  beforeEach(() => { h = harness(); });

  it('issues a token naming the whole family for a valid code + DOB', async () => {
    const res = await h.handle(post({ code: '3210', dob: '02012020' }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: 'tok-parent_9876543210', studentIds: ['stu-b', 'stu-a'] });
    expect(h.tokens[0].claims).toEqual({ role: 'parent', studentIds: ['stu-b', 'stu-a'] });
    expect(h.claimsSet[0]).toEqual({ uid: 'parent_9876543210', claims: { role: 'parent', studentIds: ['stu-b', 'stu-a'] } });
    expect(h.users[0].data).toMatchObject({ role: 'parent', studentId: 'stu-b', loginMethod: 'code' });
  });

  it('the same phone always gets the same uid, so a family keeps one account', async () => {
    await h.handle(post({ code: '3210', dob: '02012020' }));
    await h.handle(post({ code: '3210', dob: '15062018' }));
    expect(h.tokens.map(t => t.uid)).toEqual(['parent_9876543210', 'parent_9876543210']);
  });

  it('answers wrong DOB, unknown code, archived student and malformed input IDENTICALLY', async () => {
    const wrongDob = await h.handle(post({ code: '3210', dob: '01012000' }));
    const unknownCode = await h.handle(post({ code: '4444', dob: '15062018' }));
    const archived = await h.handle(post({ code: '1111', dob: '03032019' }));
    const malformed = await h.handle(post({ code: '32', dob: 'x' }));
    for (const r of [wrongDob, unknownCode, archived, malformed]) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual(wrongDob.body);
      expect(JSON.stringify(r)).not.toMatch(/stu-|Arun|Bala|exists|not found/i);
    }
    expect(h.tokens).toHaveLength(0);
    expect(h.users).toHaveLength(0);
  });

  it('applies the settle delay on success and on every failure path', async () => {
    await h.handle(post({ code: '3210', dob: '02012020' }));
    await h.handle(post({ code: '3210', dob: '01012000' }));
    await h.handle(post({ code: 'zz', dob: '01012000' }));
    expect(h.settles).toBe(3);
  });

  it('rejects non-POST, non-object and oversized bodies without touching the store', async () => {
    let loads = 0;
    h = harness({ loadStudents: async () => { loads += 1; return STUDENTS; } });
    expect((await h.handle({ method: 'GET', ip: '1', body: null })).status).toBe(405);
    expect((await h.handle(post('code=1'))).status).toBe(400);
    expect((await h.handle(post({ a: 1, b: 2, c: 3, d: 4, e: 5 }))).status).toBe(400);
    expect(loads).toBe(0);
  });
});

describe('parent-login: rate limiting', () => {
  it('locks a login code after RATE_LIMIT.perCode attempts, even with the right DOB afterwards', async () => {
    const h = harness();
    for (let i = 0; i < RATE_LIMIT.perCode; i += 1) {
      expect((await h.handle(post({ code: '3210', dob: '01012000' }, `10.0.0.${i}`))).status).toBe(401);
    }
    const blocked = await h.handle(post({ code: '3210', dob: '02012020' }, '10.0.0.99'));
    expect(blocked.status).toBe(429);
    expect(blocked.headers?.['Retry-After']).toMatch(/^\d+$/);
    expect(blocked.body).toMatchObject({ error: 'too_many_attempts' });
    expect(h.tokens).toHaveLength(0);
    // Another code is unaffected.
    expect((await h.handle(post({ code: '9999', dob: '02012020' }, '10.0.0.99'))).status).toBe(401);
  });

  it('locks an IP after RATE_LIMIT.perIp attempts across any codes', async () => {
    const h = harness();
    for (let i = 0; i < RATE_LIMIT.perIp; i += 1) {
      await h.handle(post({ code: String(1000 + i), dob: '01012000' }, '9.9.9.9'));
    }
    expect((await h.handle(post({ code: '3210', dob: '02012020' }, '9.9.9.9'))).status).toBe(429);
    expect((await h.handle(post({ code: '3210', dob: '02012020' }, '9.9.9.8'))).status).toBe(200);
  });

  it('lifts the lock once the window has passed', async () => {
    const h = harness();
    for (let i = 0; i <= RATE_LIMIT.perCode; i += 1) await h.handle(post({ code: '3210', dob: '01012000' }, `7.0.0.${i}`));
    expect((await h.handle(post({ code: '3210', dob: '02012020' }, '7.0.0.50'))).status).toBe(429);
    h.now += RATE_LIMIT.windowMs;
    expect((await h.handle(post({ code: '3210', dob: '02012020' }, '7.0.0.51'))).status).toBe(200);
  });
});

describe('parent-login: Google account linking', () => {
  it('pins parent claims when the verified email is on a student record', async () => {
    const h = harness();
    h.verify = async () => ({ uid: 'google-1', email: 'Ravi.K@gmail.com', emailVerified: true });
    const res = await h.handle(post({ idToken: 'good' }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ linked: true, studentIds: ['stu-a', 'stu-b'] });
    expect(h.claimsSet[0]).toEqual({ uid: 'google-1', claims: { role: 'parent', studentIds: ['stu-a', 'stu-b'] } });
    expect(h.tokens).toHaveLength(0); // the Google session itself is reused
  });

  it('refuses an unverified email, an unknown email and a bad token alike (401, no claims)', async () => {
    const h = harness();
    h.verify = async () => ({ uid: 'g', email: 'ravi.k@gmail.com', emailVerified: false });
    expect((await h.handle(post({ idToken: 'x' }))).status).toBe(401);
    h.verify = async () => ({ uid: 'g', email: 'stranger@gmail.com', emailVerified: true });
    expect((await h.handle(post({ idToken: 'x' }))).status).toBe(401);
    h.verify = async () => { throw new Error('expired'); };
    expect((await h.handle(post({ idToken: 'x' }))).status).toBe(401);
    expect(h.claimsSet).toHaveLength(0);
  });

  it('never links through an archived student email', async () => {
    const h = harness();
    h.verify = async () => ({ uid: 'g', email: 'xavi@x.com', emailVerified: true });
    expect((await h.handle(post({ idToken: 'x' }))).status).toBe(401);
  });
});
