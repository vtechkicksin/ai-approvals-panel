import request from 'supertest';
import {
  apiErrorSchema,
  teachGuideSchema,
  textStreamEventSchema,
  type TextStreamEvent,
} from '@approvals/schemas';
import { createApp, defaultDeps, type AppDeps } from '../../src/app';
import { createMemoryCostLogger } from '../../src/ai/costLog';
import { emptyChunk, hang, textReply, type FakeReply } from '../helpers/fakeGemini';
import { fakeModel, testAiConfig } from '../helpers/aiTestKit';
import { collectText, parseSse } from '../helpers/sse';

const STEP_4 = 'Approve it, or reject it with a clear reason.';
const REJECT_TEXT = 'Reject an item if the file is missing';

function appWith(replies: FakeReply[]) {
  const { model, fake } = fakeModel(...replies);
  const logger = createMemoryCostLogger();
  const deps: AppDeps = { ...defaultDeps(), ai: { config: testAiConfig, logger, createModel: () => model } };
  return { app: createApp(deps), fake, logger };
}

const followUp = (step: number, content: string, language = 'en') => ({
  language,
  step,
  messages: [{ role: 'user', content }],
});

async function postTeach(app: ReturnType<typeof createApp>, body: unknown) {
  const res = await request(app).post('/api/ai/teach').send(body as object).buffer(true).parse(collectText);
  const events = parseSse(res.body as string) as TextStreamEvent[];
  for (const event of events) expect(textStreamEventSchema.safeParse(event).success).toBe(true);
  return { res, events };
}

describe('GET /api/teach/guide', () => {
  it('returns the five steps from the policy, with no AI call', async () => {
    const { app, fake } = appWith([]);

    const res = await request(app).get('/api/teach/guide');

    expect(res.status).toBe(200);
    expect(teachGuideSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.steps).toHaveLength(5);
    expect(res.body.steps[3]).toEqual({ number: 4, text: STEP_4 });
    expect(fake.calls).toHaveLength(0);
  });
});

describe('POST /api/ai/teach', () => {
  it('streams an answer to a follow-up question', async () => {
    const { app } = appWith([{ kind: 'stream', steps: textReply(['A clear reason ', 'names what is wrong.']) }]);

    const { res, events } = await postTeach(app, followUp(4, 'What is a clear reason?'));

    expect(res.status).toBe(200);
    expect(events).toEqual([
      { type: 'token', text: 'A clear reason ' },
      { type: 'token', text: 'names what is wrong.' },
      { type: 'done', source: 'ai' },
    ]);
  });

  it('grounds the answer in the current step and the policy text it relates to', async () => {
    const { app, fake } = appWith([{ kind: 'stream', steps: textReply(['Ok.']) }]);

    await postTeach(app, followUp(4, 'When should I reject instead of approve?'));

    const system = JSON.stringify(fake.calls[0]!.body.systemInstruction);
    expect(system).toContain(`Step 4 of 5: ${STEP_4}`);
    expect(system).toContain(REJECT_TEXT);
  });

  it('sends the earlier questions about this step, so the explanation can adapt', async () => {
    const { app, fake } = appWith([{ kind: 'stream', steps: textReply(['Simpler: …']) }]);

    await postTeach(app, {
      language: 'en',
      step: 2,
      messages: [
        { role: 'user', content: 'Why open the file?' },
        { role: 'assistant', content: 'To check its content matches the title.' },
        { role: 'user', content: 'I still do not get it. Simpler please?' },
      ],
    });

    const contents = (fake.calls[0]!.body as { contents: { role: string }[] }).contents;
    expect(contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('logs the call for cost tracking', async () => {
    const { app, logger } = appWith([{ kind: 'stream', steps: textReply(['Ok.']) }]);

    await postTeach(app, followUp(1, 'Why check the location?'));

    expect(logger.records).toEqual([expect.objectContaining({ feature: 'teach', outcome: 'complete' })]);
  });

  describe('backup when the AI is not available', () => {
    it('repeats the step with the policy text (never a 500)', async () => {
      const { app } = appWith([{ kind: 'error', status: 503 }]);

      const { res, events } = await postTeach(app, followUp(4, 'When should I reject?'));

      expect(res.status).toBe(200);
      expect(events.map((e) => e.type)).toEqual(['notice', 'fallback', 'done']);
      const fallback = events[1] as Extract<TextStreamEvent, { type: 'fallback' }>;
      expect(fallback.text).toMatch(/can.t answer follow-up questions/i);
      expect(fallback.text).toContain(STEP_4);
      expect(fallback.text).toContain(REJECT_TEXT);
    });

    it('says the AI is slow after the first-word timeout', async () => {
      const { app } = appWith([{ kind: 'stream', steps: [emptyChunk(), hang()] }]);

      const { events } = await postTeach(app, followUp(1, 'Why?'));

      expect(events[0]).toMatchObject({ type: 'notice', code: 'ai_slow' });
    });
  });

  it.each([
    ['step 0', followUp(0, 'Why?')],
    ['a step past the end of the guide', followUp(6, 'Why?')],
    ['a step that is not a whole number', followUp(1.5, 'Why?')],
    ['no messages', { language: 'en', step: 1, messages: [] }],
    ['an empty question', followUp(1, '  ')],
    ['an unknown language', followUp(1, 'Why?', 'fr')],
  ])('rejects %s with a JSON 400 before any AI call', async (_label, body) => {
    const { app, fake } = appWith([{ kind: 'stream', steps: textReply(['Hi']) }]);

    const res = await request(app).post('/api/ai/teach').send(body);

    expect(res.status).toBe(400);
    expect(apiErrorSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('invalid_request');
    expect(fake.calls).toHaveLength(0);
  });
});
