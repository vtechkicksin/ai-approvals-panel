import type { RequestHandler } from 'express';

export const SESSION_COOKIE = 'approvals_session';

declare module 'express-serve-static-core' {
  interface Request {
    /** Anonymous browser session id, from the session cookie. */
    sessionId?: string;
  }
}

/** Gives every browser an anonymous session id in an http-only cookie. */
export const sessionCookie: RequestHandler = (_req, _res, next) => {
  next(); // Not implemented yet
};
