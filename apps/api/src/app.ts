import express, { type Express } from 'express';
import { healthResponseSchema, type HealthResponse } from '@approvals/schemas';

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = healthResponseSchema.parse({ status: 'ok' });
    res.json(body);
  });

  return app;
}
