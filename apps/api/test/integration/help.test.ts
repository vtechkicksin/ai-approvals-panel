import request from 'supertest';
import { apiErrorSchema, helpStreamEventSchema, type HelpStreamEvent } from '@approvals/schemas';
import { createApp, defaultDeps, type AppDeps } from '../../src/app';
import { createMemoryCostLogger } from '../../src/ai/costLog';
import { emptyChunk, hang, textReply, type FakeReply } from '../helpers/fakeGemini';
import { fakeModel, testAiConfig } from '../helpers/aiTestKit';
import { collectText, parseSse } from '../helpers/sse';

const REJECT_TEXT = 'Reject an item if the file is missing';
const PURPOSE_TEXT = 'Every item must be reviewed before it is published';

function appWith(replies: FakeReply[]) {
  const { model, fake } = fakeModel(...replies);
  const logger = createMemoryCostLogger();
  const deps: AppDeps = { ...defaultDeps(), ai: { config: testAiConfig, logger, createModel: () => model } };
  return { app: createApp(deps), fake, logger };
}

async function postHelp(app: ReturnType<typeof createApp>, question: string, language = 'en') {
  const res = await request(app).post('/api/ai/help').send({ language, question }).buffer(true).parse(collectText);
  const events = parseSse(res.body as string) as HelpStreamEvent[];
  for (const event of events) expect(helpStreamEventSchema.safeParse(event).success).toBe(true);
  return { res, events };
}

const userText = (body: Record<string, unknown>) => JSON.stringify((body as { contents: unknown }).contents);

describe('POST /api/ai/help', () => {
  it('sends the matching policy sections first, then streams a grounded answer', async () => {
    const { app } = appWith([{ kind: 'stream', steps: textReply(['Reject it if ', 'the file is missing (section 4).']) }]);

    const { res, events } = await postHelp(app, 'When should I reject an item?');

    expect(res.status).toBe(200);
    expect(events[0]).toMatchObject({ type: 'citations' });
    const citations = events[0] as Extract<HelpStreamEvent, { type: 'citations' }>;
    expect(citations.items[0]).toMatchObject({ id: 'policy-4', heading: '4. When to reject' });
    expect(citations.items[0]!.excerpt).toMatch(/^Reject an item/);
    expect(events.slice(1)).toEqual([
      { type: 'token', text: 'Reject it if ' },
      { type: 'token', text: 'the file is missing (section 4).' },
      { type: 'done', source: 'ai' },
    ]);
  });

  it('gives the model only the matched sections', async () => {
    const { app, fake } = appWith([{ kind: 'stream', steps: textReply(['Ok.']) }]);

    await postHelp(app, 'When should I reject an item?');

    const sent = userText(fake.calls[0]!.body);
    expect(sent).toContain(REJECT_TEXT);
    expect(sent).toContain('When should I reject an item?');
    expect(sent).not.toContain(PURPOSE_TEXT);
  });

  it('does not call the AI when the policy does not cover the question', async () => {
    const { app, fake } = appWith([{ kind: 'stream', steps: textReply(['Should not happen']) }]);

    const { events } = await postHelp(app, 'What is the weather in Delhi today?');

    expect(fake.calls).toHaveLength(0);
    expect(events).toEqual([
      { type: 'fallback', text: expect.stringMatching(/not covered by the approval policy/i) },
      { type: 'done', source: 'rules' },
    ]);
  });

  it('logs the call for cost tracking', async () => {
    const { app, logger } = appWith([{ kind: 'stream', steps: textReply(['Ok.']) }]);

    await postHelp(app, 'When should I reject an item?');

    expect(logger.records).toEqual([expect.objectContaining({ feature: 'help', outcome: 'complete' })]);
  });

  describe('backup when the AI is not available', () => {
    it('shows the matching policy sections word for word (never a 500)', async () => {
      const { app } = appWith([{ kind: 'error', status: 503 }]);

      const { res, events } = await postHelp(app, 'When should I reject an item?');

      expect(res.status).toBe(200);
      expect(events.map((e) => e.type)).toEqual(['citations', 'notice', 'fallback', 'done']);
      expect(events[1]).toMatchObject({ code: 'ai_unavailable' });
      const fallback = events[2] as Extract<HelpStreamEvent, { type: 'fallback' }>;
      expect(fallback.text).toContain(REJECT_TEXT);
      expect(events[3]).toEqual({ type: 'done', source: 'fallback' });
    });

    it('says the AI is slow after the first-word timeout', async () => {
      const { app } = appWith([{ kind: 'stream', steps: [emptyChunk(), hang()] }]);

      const { events } = await postHelp(app, 'When should I reject an item?');

      expect(events[1]).toMatchObject({ type: 'notice', code: 'ai_slow' });
    });
  });

  it('answers a Hindi question from the whole policy, in Hindi', async () => {
    const { app, fake } = appWith([{ kind: 'stream', steps: textReply(['उत्तर।']) }]);

    const { events } = await postHelp(app, 'मैं किसी आइटम को कब अस्वीकार करूँ?', 'hi');

    const citations = events[0] as Extract<HelpStreamEvent, { type: 'citations' }>;
    expect(citations.items).toHaveLength(5);
    expect(JSON.stringify(fake.calls[0]!.body.systemInstruction)).toMatch(/Hindi/);
  });

  it.each([
    ['an empty question', { language: 'en', question: '  ' }],
    ['a question that is too long', { language: 'en', question: 'x'.repeat(501) }],
    ['an unknown language', { language: 'fr', question: 'Why?' }],
    ['a missing question', { language: 'en' }],
  ])('rejects %s with a JSON 400 before any AI call', async (_label, body) => {
    const { app, fake } = appWith([{ kind: 'stream', steps: textReply(['Hi']) }]);

    const res = await request(app).post('/api/ai/help').send(body);

    expect(res.status).toBe(400);
    expect(apiErrorSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('invalid_request');
    expect(fake.calls).toHaveLength(0);
  });
});
