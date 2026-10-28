import { Router } from 'express';
import { healthResponseSchema, type HealthResponse } from '@approvals/schemas';

export function healthRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const body: HealthResponse = healthResponseSchema.parse({ status: 'ok' });
    res.json(body);
  });
  return router;
}
