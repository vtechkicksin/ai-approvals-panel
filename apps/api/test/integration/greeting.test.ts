import request from 'supertest';
import { apiErrorSchema, buildGreeting, greetingFacts, textStreamEventSchema, type TextStreamEvent } from '@approvals/schemas';
import { createApp, defaultDeps, type AppDeps } from '../../src/app';
import { createMemoryCostLogger } from '../../src/ai/costLog';
import { rankApprovals } from '../../src/approvals/rankApprovals';
import { emptyChunk, hang, textReply, type FakeReply } from '../helpers/fakeGemini';
import { fakeModel, testAiConfig } from '../helpers/aiTestKit';
import { collectText, parseSse } from '../helpers/sse';

const deps0 = defaultDeps();
const template = buildGreeting(
  greetingFacts(rankApprovals(deps0.getApprovals(), deps0.priorityTable)),
  'en',
  'morning',
);

function appWith(replies: FakeReply[], overrides: Partial<AppDeps> = {}) {
  const { model, fake } = fakeModel(...replies);
  const logger = createMemoryCostLogger();
  const deps: AppDeps = { ...defaultDeps(), ai: { config: testAiConfig, logger, createModel: () => model }, ...overrides };
  return { app: createApp(deps), fake, logger };
}

async function postGreeting(app: ReturnType<typeof createApp>, body: unknown = { language: 'en', partOfDay: 'morning' }) {
  const res = await request(app).post('/api/ai/greeting').send(body as object).buffer(true).parse(collectText);
  const events = parseSse(res.body as string) as TextStreamEvent[];
  for (const event of events) expect(textStreamEventSchema.safeParse(event).success).toBe(true);
  return { res, events };
}

describe('POST /api/ai/greeting', () => {
  it('streams the AI wording when it keeps the real numbers', async () => {
    const { app } = appWith([{ kind: 'stream', steps: textReply(['Morning! 4 approvals ', 'are waiting for you.']) }]);

    const { res, events } = await postGreeting(app);

    expect(res.status).toBe(200);
    expect(events).toEqual([
      { type: 'token', text: 'Morning! 4 approvals ' },
      { type: 'token', text: 'are waiting for you.' },
      { type: 'done', source: 'ai' },
    ]);
  });

  it('gives the model the template and the facts from the queue', async () => {
    const { app, fake } = appWith([{ kind: 'stream', steps: textReply(['Morning! 4 waiting.']) }]);

    await postGreeting(app);

    const sent = JSON.stringify(fake.calls[0]!.body);
    expect(sent).toContain(JSON.stringify(template).slice(1, -1));
    expect(sent).toContain('\\"total\\":4');
  });

  it('replaces AI wording that changes the numbers with the template', async () => {
    const { app } = appWith([{ kind: 'stream', steps: textReply(['Morning! 7 approvals are waiting.']) }]);

    const { events } = await postGreeting(app);

    expect(events.slice(-2)).toEqual([
      { type: 'fallback', text: template },
      { type: 'done', source: 'fallback' },
    ]);
  });

  it('keeps the template when Gemini is down (never a 500)', async () => {
    const { app } = appWith([{ kind: 'error', status: 503 }]);

    const { res, events } = await postGreeting(app);

    expect(res.status).toBe(200);
    expect(events.map((e) => e.type)).toEqual(['notice', 'fallback', 'done']);
    expect(events[1]).toEqual({ type: 'fallback', text: template });
  });

  it('keeps the template when the AI is slow', async () => {
    const { app } = appWith([{ kind: 'stream', steps: [emptyChunk(), hang()] }]);

    const { events } = await postGreeting(app);

    expect(events[0]).toMatchObject({ type: 'notice', code: 'ai_slow' });
    expect(events[1]).toEqual({ type: 'fallback', text: template });
  });

  it('does not call the AI when nothing is waiting', async () => {
    const { app, fake } = appWith([{ kind: 'stream', steps: textReply(['Hi']) }], { getApprovals: () => [] });

    const { events } = await postGreeting(app);

    expect(fake.calls).toHaveLength(0);
    expect(events).toEqual([
      { type: 'fallback', text: "Good morning! No approvals are waiting. You're all caught up." },
      { type: 'done', source: 'rules' },
    ]);
  });

  it('logs the call for cost tracking', async () => {
    const { app, logger } = appWith([{ kind: 'stream', steps: textReply(['Morning! 4 waiting.']) }]);

    await postGreeting(app);

    expect(logger.records).toEqual([expect.objectContaining({ feature: 'greeting', outcome: 'complete' })]);
  });

  it.each([
    ['an unknown language', { language: 'fr', partOfDay: 'morning' }],
    ['an unknown part of the day', { language: 'en', partOfDay: 'midnight' }],
    ['a missing part of the day', { language: 'en' }],
  ])('rejects %s with a JSON 400 before any AI call', async (_label, body) => {
    const { app, fake } = appWith([{ kind: 'stream', steps: textReply(['Hi']) }]);

    const res = await request(app).post('/api/ai/greeting').send(body);

    expect(res.status).toBe(400);
    expect(apiErrorSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('invalid_request');
    expect(fake.calls).toHaveLength(0);
  });
});
