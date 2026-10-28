import request from 'supertest';
import { createApp, defaultDeps } from '../../src/app';

const WEB_ORIGIN = 'http://localhost:5173';
const app = () => createApp({ ...defaultDeps(), webOrigin: WEB_ORIGIN });

describe('CORS: the browser app calls the API directly', () => {
  it('allows the web app origin, with cookies', async () => {
    const res = await request(app()).get('/api/approvals').set('Origin', WEB_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('answers the browser preflight for a JSON POST', async () => {
    const res = await request(app())
      .options('/api/approvals')
      .set('Origin', WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
  });

  it('does not allow other websites', async () => {
    const res = await request(app()).get('/api/approvals').set('Origin', 'https://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
