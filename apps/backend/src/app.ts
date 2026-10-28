import cors from 'cors';
import express, { type Express } from 'express';
import { errorHandler, notFound } from './middleware/errors';
import { aiRateLimit } from './middleware/rateLimit';
import { sessionCookie } from './middleware/session';
import { apiRouter } from './router';
import { defaultDeps } from './bootstrap/dependencies';
import type { AppDeps } from './types/dependencies';

export { defaultDeps } from './bootstrap/dependencies';
export type { AiDeps, AppDeps } from './types/dependencies';

export function createApp(deps: AppDeps = defaultDeps()): Express {
  const app = express();
  app.use(cors({ origin: [deps.webOrigin], credentials: true }));
  app.use(express.json());

  app.use('/api/ai', sessionCookie, ...aiRateLimit(deps.ai.config));
  app.use(apiRouter(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
