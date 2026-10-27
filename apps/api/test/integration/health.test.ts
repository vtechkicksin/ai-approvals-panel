import request from 'supertest';
import { healthResponseSchema } from '@approvals/schemas';
import { createApp } from '../../src/app';

describe('GET /api/health', () => {
  it('returns a body that matches the shared contract', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });
});
