import request from 'supertest';
import { apiErrorSchema } from '@approvals/schemas';
import { createApp, defaultDeps, type AppDeps } from '../../src/app';
import { createMemoryCostLogger } from '../../src/ai/costLog';
import { SESSION_COOKIE } from '../../src/middleware/session';
import { textReply } from '../helpers/fakeGemini';
import { fakeModel, testAiConfig } from '../helpers/aiTestKit';
import { collectText } from '../helpers/sse';

const WEB_ORIGIN = 'http://localhost:5173';
/** A question the policy does not cover: answered by rules, no AI call, so it is quick. */
const notCovered = { language: 'en', question: 'What is the weather today?' };

function appWith(limits: { perSession: number; perIp: number }, replies = [{ kind: 'stream' as const, steps: textReply(['Hi.']) }]) {
  const { model, fake } = fakeModel(...replies);
  const deps: AppDeps = {
    ...defaultDeps(),
    webOrigin: WEB_ORIGIN,
    ai: {
      config: { ...testAiConfig, rateLimitPerMinute: limits.perSession, rateLimitPerIpPerMinute: limits.perIp },
      logger: createMemoryCostLogger(),
      createModel: () => model,
    },
  };
  return { app: createApp(deps), fake };
}

const sessionFrom = (res: request.Response) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
const cookieHeader = (setCookie: string) => setCookie.split(';')[0]!;

async function ask(app: ReturnType<typeof createApp>, cookie?: string, body: object = notCovered) {
  const req = request(app).post('/api/ai/help').set('Origin', WEB_ORIGIN);
  if (cookie) req.set('Cookie', cookie);
  return req.send(body).buffer(true).parse(collectText);
}

describe('session cookie', () => {
  it('gives a new browser an anonymous, http-only session cookie on its first AI request', async () => {
    const { app } = appWith({ perSession: 20, perIp: 60 });

    const res = await ask(app);

    const cookie = sessionFrom(res);
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[0-9a-f-]{36};`));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
  });

  it('keeps an existing session instead of starting a new one', async () => {
    const { app } = appWith({ perSession: 20, perIp: 60 });
    const first = cookieHeader(sessionFrom(await ask(app))!);

    const res = await ask(app, first);

    expect(sessionFrom(res)).toBeUndefined();
  });

  it('replaces a session cookie that is not a valid id', async () => {
    const { app } = appWith({ perSession: 20, perIp: 60 });

    const res = await ask(app, `${SESSION_COOKIE}=../../etc/passwd`);

    expect(sessionFrom(res)).toMatch(/^approvals_session=[0-9a-f-]{36};/);
  });

  it('does not set a cookie on endpoints that do not use the AI', async () => {
    const { app } = appWith({ perSession: 20, perIp: 60 });

    const res = await request(app).get('/api/approvals');

    expect(sessionFrom(res)).toBeUndefined();
  });
});

describe('AI rate limit', () => {
  it('allows the per-session limit, then answers with a friendly 429', async () => {
    const { app } = appWith({ perSession: 3, perIp: 100 });
    const cookie = cookieHeader(sessionFrom(await ask(app))!);
    await ask(app, cookie);
    await ask(app, cookie);

    const res = await ask(app, cookie);

    expect(res.status).toBe(429);
    const body = JSON.parse(res.body as string) as unknown;
    expect(apiErrorSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ error: { code: 'rate_limited' } });
    expect((body as { error: { message: string } }).error.message).toMatch(/please wait about \d+ seconds/i);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('blocks the AI call itself once the limit is reached', async () => {
    const { app, fake } = appWith({ perSession: 1, perIp: 100 }, [
      { kind: 'stream', steps: textReply(['One.']) },
      { kind: 'stream', steps: textReply(['Two.']) },
    ]);
    const talk = { language: 'en', messages: [{ role: 'user', content: 'Hi' }] };
    const first = await request(app).post('/api/ai/talk').send(talk).buffer(true).parse(collectText);
    const cookie = cookieHeader(sessionFrom(first)!);

    const second = await request(app).post('/api/ai/talk').set('Cookie', cookie).send(talk);

    expect(second.status).toBe(429);
    expect(fake.calls).toHaveLength(1);
  });

  it('counts each session separately', async () => {
    const { app } = appWith({ perSession: 1, perIp: 100 });
    const a = cookieHeader(sessionFrom(await ask(app))!);
    const b = cookieHeader(sessionFrom(await ask(app))!);

    expect((await ask(app, a)).status).toBe(429);
    expect((await ask(app, b)).status).toBe(429);
    expect(a).not.toBe(b);
  });

  it('stops a client that drops its cookie to dodge the limit (per-IP backstop)', async () => {
    const { app } = appWith({ perSession: 2, perIp: 4 });
    for (let i = 0; i < 4; i++) expect((await ask(app)).status).toBe(200); // a new session each time

    expect((await ask(app)).status).toBe(429);
  });

  it('writes the message in Hindi when the request is in Hindi', async () => {
    const { app } = appWith({ perSession: 1, perIp: 100 });
    const cookie = cookieHeader(sessionFrom(await ask(app))!);

    const res = await ask(app, cookie, { language: 'hi', question: 'मौसम कैसा है?' });

    expect(res.status).toBe(429);
    expect(res.body).toMatch(/[ऀ-ॿ]/);
  });

  it('keeps the CORS headers on a 429, so the browser can read the message', async () => {
    const { app } = appWith({ perSession: 1, perIp: 100 });
    const cookie = cookieHeader(sessionFrom(await ask(app))!);

    const res = await ask(app, cookie);

    expect(res.status).toBe(429);
    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not limit endpoints that do not use the AI', async () => {
    const { app } = appWith({ perSession: 1, perIp: 1 });

    for (let i = 0; i < 5; i++) expect((await request(app).get('/api/approvals')).status).toBe(200);
  });
});
