import request from 'supertest';
import { apiErrorSchema, approvalsResponseSchema, type ApprovalItem } from '@approvals/schemas';
import { createApp, type AppDeps } from '../../src/app';
import { loadApprovals, loadPriorityTable } from '../../src/data/seedData';

function realDeps(): AppDeps {
  const approvals = loadApprovals();
  return { getApprovals: () => approvals, priorityTable: loadPriorityTable() };
}

describe('GET /api/approvals', () => {
  it('returns the ranked queue in the shape of the shared contract', async () => {
    const res = await request(createApp(realDeps())).get('/api/approvals');

    expect(res.status).toBe(200);
    const parsed = approvalsResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
    expect(res.body.total).toBe(4);
  });

  it('ranks the seed data: urgent override first, then by policy priority', async () => {
    const res = await request(createApp(realDeps())).get('/api/approvals');
    const body = approvalsResponseSchema.parse(res.body);

    expect(body.items.map((i) => [i.title, i.effectivePriority, i.prioritySource])).toEqual([
      ['360° Spatial Zone Layout & Camera Map', 'urgent', 'item_override'],
      ['Safety Equipment & Sensor Specs', 'high', 'policy'],
      ['Site Patrol Onboarding & Checklists', 'medium', 'policy'], // older than the video
      ['Level 2 Drone Patrol Video Demo', 'medium', 'policy'],
    ]);
  });

  it('returns an empty queue without failing', async () => {
    const deps: AppDeps = { ...realDeps(), getApprovals: () => [] };

    const res = await request(createApp(deps)).get('/api/approvals');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0 });
  });
});

describe('API error responses', () => {
  it('answers an unknown route with a JSON 404 in the error shape', async () => {
    const res = await request(createApp(realDeps())).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(apiErrorSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('not_found');
  });

  it('turns an unexpected crash into a friendly JSON 500 without leaking details', async () => {
    const deps: AppDeps = {
      ...realDeps(),
      getApprovals: (): ApprovalItem[] => {
        throw new Error('disk on fire at /secret/path');
      },
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(createApp(deps)).get('/api/approvals');

    expect(res.status).toBe(500);
    expect(apiErrorSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('internal_error');
    expect(JSON.stringify(res.body)).not.toMatch(/secret|disk on fire/);
    expect(consoleError).toHaveBeenCalled(); // the real error is logged on the server
    consoleError.mockRestore();
  });

  it('answers malformed JSON with a 400 in the error shape', async () => {
    const res = await request(createApp(realDeps()))
      .post('/api/approvals')
      .set('content-type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });
});
