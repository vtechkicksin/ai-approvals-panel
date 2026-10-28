import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const SESSION_COOKIE = 'approvals_session';
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

declare module 'express-serve-static-core' {
  interface Request {
    /** Anonymous browser session id, from the session cookie. */
    sessionId?: string;
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=');
    if (key !== name) continue;
    try {
      return decodeURIComponent(value.join('='));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Gives every browser an anonymous session id in an http-only cookie. There
 * is no login, so this is what "per session" rate limiting counts by.
 * Anything that is not a well-formed id is replaced, never trusted.
 */
export const sessionCookie: RequestHandler = (req, res, next) => {
  const existing = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (existing && SESSION_ID.test(existing)) {
    req.sessionId = existing;
    return next();
  }
  req.sessionId = randomUUID();
  res.cookie(SESSION_COOKIE, req.sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_DAY_MS,
    secure: process.env.NODE_ENV === 'production',
  });
  next();
};
