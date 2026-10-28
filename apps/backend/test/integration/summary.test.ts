import request from 'supertest';
import { apiErrorSchema, summaryStreamEventSchema, type SummaryStreamEvent } from '@approvals/schemas';
import { createApp, defaultDeps, type AppDeps } from '../../src/app';
import { createMemoryCostLogger } from '../../src/ai/costLog';
import { AiNotConfiguredError } from '../../src/ai/errors';
import { buildRuleSummary } from '../../src/features/summary/ruleSummary';
import { emptyChunk, hang, textPieces, textReply, type FakeReply } from '../helpers/fakeGemini';
import { fakeModel, testAiConfig } from '../helpers/aiTestKit';
import { collectText, parseSse } from '../helpers/sse';
import { chunkText, goodSummaryJson, seedCards } from '../helpers/summaryKit';

const RANKED_IDS = ['apr-004', 'apr-003', 'apr-001', 'apr-002'];

function appWith(replies: FakeReply[], overrides: Partial<AppDeps> = {}) {
  const { model, fake } = fakeModel(...replies);
  const logger = createMemoryCostLogger();
  const deps: AppDeps = {
    ...defaultDeps(),
    ai: { config: testAiConfig, logger, createModel: () => model },
    ...overrides,
  };
  return { app: createApp(deps), fake, logger };
}

const replyWith = (json: unknown, size = 40): FakeReply => ({
  kind: 'stream',
  steps: textReply(chunkText(typeof json === 'string' ? json : JSON.stringify(json), size)),
});

async function postSummary(app: ReturnType<typeof createApp>, body: unknown = { language: 'en' }) {
  const res = await request(app).post('/api/ai/summary').send(body as object).buffer(true).parse(collectText);
  const events = res.headers['content-type']?.includes('text/event-stream')
    ? (parseSse(res.body as string) as SummaryStreamEvent[])
    : [];
  for (const event of events) expect(summaryStreamEventSchema.safeParse(event).success).toBe(true);
  return { res, events };
}

const complete = (events: SummaryStreamEvent[]) => events.find((e) => e.type === 'complete');
const ofType = <T extends SummaryStreamEvent['type']>(events: SummaryStreamEvent[], type: T) =>
  events.filter((e): e is Extract<SummaryStreamEvent, { type: T }> => e.type === type);

describe('POST /api/ai/summary', () => {
  describe('success', () => {
    it('sends rule-ranked cards first, then streams validated AI text, then the final summary', async () => {
      const { app } = appWith([replyWith(goodSummaryJson)]);

      const { res, events } = await postSummary(app);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      expect(events[0]).toMatchObject({ type: 'skeleton', total: 4 });
      expect(ofType(events, 'skeleton')[0]!.items.map((i) => i.id)).toEqual(RANKED_IDS);
      expect(ofType(events, 'delta').length).toBeGreaterThan(3);
      expect(ofType(events, 'item').map((e) => [e.itemId, e.status])).toEqual(RANKED_IDS.map((id) => [id, 'ok']));
      expect(events.at(-1)).toEqual({ type: 'complete', source: 'ai', summary: goodSummaryJson });
    });

    it('asks Gemini for JSON that follows a schema, with the fixed-order rules', async () => {
      const { app, fake } = appWith([replyWith(goodSummaryJson)]);

      await postSummary(app);

      const body = fake.calls[0]!.body as {
        generationConfig: { responseMimeType: string; responseSchema: { properties: Record<string, unknown> } };
        systemInstruction: unknown;
      };
      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(Object.keys(body.generationConfig.responseSchema.properties)).toEqual([
        'headline',
        'items',
        'spokenScript',
      ]);
      expect(JSON.stringify(body.systemInstruction)).toMatch(/never change the order/i);
    });

    it('asks for Hindi when the operator chose Hindi', async () => {
      const { app, fake } = appWith([replyWith(goodSummaryJson)]);

      await postSummary(app, { language: 'hi' });

      expect(JSON.stringify(fake.calls[0]!.body.systemInstruction)).toMatch(/Hindi/);
    });

    it('logs the call for cost tracking', async () => {
      const { app, logger } = appWith([replyWith(goodSummaryJson)]);

      await postSummary(app);

      expect(logger.records).toEqual([expect.objectContaining({ feature: 'summary', outcome: 'complete' })]);
    });
  });

  describe('a broken AI reply never reaches the UI', () => {
    it('replaces broken JSON with the rule-based summary', async () => {
      const { app } = appWith([replyWith('{"headline":"Four approvals waiting","items":[{"id":"apr-004","rea')]);

      const { events } = await postSummary(app);

      expect(complete(events)).toEqual({
        type: 'complete',
        source: 'fallback',
        summary: buildRuleSummary(seedCards, 'en'),
      });
    });

    it('replaces a reply with the wrong shape', async () => {
      const { app } = appWith([replyWith({ headline: 42, items: 'nope', spokenScript: null })]);

      const { events } = await postSummary(app);

      expect(complete(events)).toMatchObject({ source: 'fallback' });
    });

    it('keeps the queue order and drops invented items', async () => {
      const reply = {
        ...goodSummaryJson,
        items: [{ id: 'apr-999', reason: 'Invented item' }, ...goodSummaryJson.items].reverse(),
      };
      const { app } = appWith([replyWith(reply)]);

      const { events } = await postSummary(app);

      expect(complete(events)!.type === 'complete' && complete(events)!.summary.items.map((i) => i.id)).toEqual(
        RANKED_IDS,
      );
      expect(JSON.stringify(events)).not.toContain('Invented');
    });
  });

  describe('AI failures degrade gracefully (never a 500)', () => {
    it('serves the rule-based summary with a notice when Gemini is down', async () => {
      const { app } = appWith([{ kind: 'error', status: 503 }]);

      const { res, events } = await postSummary(app);

      expect(res.status).toBe(200);
      expect(events.map((e) => e.type)).toEqual(['skeleton', 'notice', 'complete']);
      expect(events[1]).toMatchObject({ code: 'ai_unavailable' });
      expect(complete(events)).toMatchObject({ source: 'fallback', summary: buildRuleSummary(seedCards, 'en') });
    });

    it('serves the rule-based summary with an "AI is slow" notice after the first-word timeout', async () => {
      const { app } = appWith([{ kind: 'stream', steps: [emptyChunk(), hang()] }]);

      const { events } = await postSummary(app);

      expect(events[1]).toMatchObject({ type: 'notice', code: 'ai_slow' });
      expect(complete(events)).toMatchObject({ source: 'fallback' });
    });

    it('serves the rule-based summary when no API key is set', async () => {
      const notConfigured: AppDeps['ai'] = {
        config: testAiConfig,
        logger: createMemoryCostLogger(),
        createModel: () => {
          throw new AiNotConfiguredError();
        },
      };

      const { events } = await postSummary(createApp({ ...defaultDeps(), ai: notConfigured }));

      expect(events[1]).toMatchObject({ type: 'notice', code: 'ai_unavailable' });
      expect(complete(events)).toMatchObject({ source: 'fallback' });
    });

    it('keeps what was finished when the reply is cut short', async () => {
      const partial = '{"headline":"Four waiting.","items":[{"id":"apr-004","reason":"Urgent first."},{"id":"apr-003","reason":"Sa';
      const { app } = appWith([{ kind: 'stream', steps: [...textPieces(chunkText(partial, 30)), hang()] }]);

      const { events } = await postSummary(app);

      const notice = ofType(events, 'notice')[0];
      expect(notice).toMatchObject({ code: 'cut_short' });
      const final = complete(events);
      expect(final).toMatchObject({ source: 'partial' });
      expect(final!.type === 'complete' && final!.summary.headline).toBe('Four waiting.');
      expect(final!.type === 'complete' && final!.summary.items[0]!.reason).toBe('Urgent first.');
    });
  });

  describe('AI judgment and input checks', () => {
    it('does not call the AI at all when nothing is waiting', async () => {
      const { app, fake } = appWith([replyWith(goodSummaryJson)], { getApprovals: () => [] });

      const { events } = await postSummary(app);

      expect(fake.calls).toHaveLength(0);
      expect(events).toEqual([
        { type: 'skeleton', items: [], total: 0 },
        { type: 'complete', source: 'rules', summary: buildRuleSummary([], 'en') },
      ]);
    });

    it('rejects an invalid request with a JSON 400 before any AI call', async () => {
      const { app, fake } = appWith([replyWith(goodSummaryJson)]);

      const res = await request(app).post('/api/ai/summary').send({ language: 'fr' });

      expect(res.status).toBe(400);
      expect(apiErrorSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.error.code).toBe('invalid_request');
      expect(fake.calls).toHaveLength(0);
    });
  });
});
