import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import request from 'supertest';
import { textStreamEventSchema, type Language, type TextStreamEvent } from '@approvals/schemas';
import { createMemoryCostLogger } from '../../src/ai/costLog';
import { AiNotConfiguredError } from '../../src/ai/errors';
import { guardedStream } from '../../src/ai/guardedStream';
import { streamTextAnswer } from '../../src/ai/sse';
import { emptyChunk, hang, textPieces, textReply, type FakeReply } from '../helpers/fakeGemini';
import { fakeModel, testAiConfig } from '../helpers/aiTestKit';
import { collectText, parseSse } from '../helpers/sse';

const BACKUP = 'Backup answer from the rules.';

/** A tiny app with one streamed AI endpoint, built on the real layer. */
function appWith(options: { replies?: FakeReply[]; notConfigured?: boolean; fallback?: () => string; language?: Language }) {
  const { model, fake } = fakeModel(...(options.replies ?? [{ kind: 'stream', steps: textReply(['Hi']) }]));
  const app = express();
  app.get('/answer', (req, res) =>
    streamTextAnswer({
      req,
      res,
      language: options.language ?? 'en',
      run: (signal) =>
        guardedStream({
          feature: 'test',
          config: testAiConfig,
          logger: createMemoryCostLogger(),
          signal,
          start: (s) => {
            if (options.notConfigured) throw new AiNotConfiguredError();
            return model.stream('Hello', { signal: s });
          },
        }),
      fallback: options.fallback ?? (() => BACKUP),
    }),
  );
  return { app, fake };
}

async function getEvents(app: express.Express) {
  const res = await request(app).get('/answer').buffer(true).parse(collectText);
  const events = parseSse(res.body as string);
  for (const event of events) expect(textStreamEventSchema.safeParse(event).success).toBe(true);
  return { res, events: events as TextStreamEvent[] };
}

describe('streamTextAnswer (SSE)', () => {
  it('streams tokens as Server-Sent Events and ends with done: ai', async () => {
    const { app } = appWith({ replies: [{ kind: 'stream', steps: textReply(['Four ', 'waiting.']) }] });

    const { res, events } = await getEvents(app);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.headers['cache-control']).toMatch(/no-cache/);
    expect(events).toEqual([
      { type: 'token', text: 'Four ' },
      { type: 'token', text: 'waiting.' },
      { type: 'done', source: 'ai' },
    ]);
  });

  it('serves the backup answer when the AI service is down (never a 500)', async () => {
    const { app } = appWith({ replies: [{ kind: 'error', status: 503 }] });

    const { res, events } = await getEvents(app);

    expect(res.status).toBe(200);
    expect(events).toEqual([
      { type: 'notice', code: 'ai_unavailable', message: expect.any(String) },
      { type: 'fallback', text: BACKUP },
      { type: 'done', source: 'fallback' },
    ]);
  });

  it('serves the backup answer with an "AI is slow" note after the first-word timeout', async () => {
    const { app } = appWith({ replies: [{ kind: 'stream', steps: [emptyChunk(), hang()] }] });

    const { events } = await getEvents(app);

    expect(events).toEqual([
      { type: 'notice', code: 'ai_slow', message: expect.any(String) },
      { type: 'fallback', text: BACKUP },
      { type: 'done', source: 'fallback' },
    ]);
  });

  it('serves the backup answer when no API key is set', async () => {
    const { app } = appWith({ notConfigured: true });

    const { events } = await getEvents(app);

    expect(events.map((e) => e.type)).toEqual(['notice', 'fallback', 'done']);
    expect(events[0]).toMatchObject({ code: 'ai_unavailable' });
  });

  it('keeps the partial text and says it was cut short when the AI goes quiet', async () => {
    const steps = [...textPieces(['Start of the answer']), hang()];
    const { app } = appWith({ replies: [{ kind: 'stream', steps }] });

    const { events } = await getEvents(app);

    expect(events).toEqual([
      { type: 'token', text: 'Start of the answer' },
      { type: 'notice', code: 'cut_short', message: expect.any(String) },
      { type: 'done', source: 'partial' },
    ]);
  });

  it('writes the notices in Hindi when the operator chose Hindi', async () => {
    const { app } = appWith({ language: 'hi', replies: [{ kind: 'error', status: 503 }] });

    const { events } = await getEvents(app);

    expect(events[0]).toMatchObject({ type: 'notice', message: expect.stringMatching(/[ऀ-ॿ]/) });
  });

  it('sends a friendly error event if even the backup answer fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = appWith({
      replies: [{ kind: 'error', status: 503 }],
      fallback: () => {
        throw new Error('rules engine exploded');
      },
    });

    const { res, events } = await getEvents(app);

    expect(res.status).toBe(200);
    expect(events.at(-1)).toEqual({ type: 'error', code: 'answer_failed', message: expect.any(String) });
    expect(JSON.stringify(events)).not.toMatch(/exploded/);
    consoleError.mockRestore();
  });

  it('stops the AI call when the browser disconnects', async () => {
    const { app, fake } = appWith({
      replies: [{ kind: 'stream', steps: [...textPieces(['First words']), hang()] }],
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;

    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get({ port, path: '/answer' }, (res) => {
          res.once('data', () => {
            req.destroy(); // the user closed the panel mid-answer
            resolve();
          });
        });
        req.on('error', () => {});
        setTimeout(() => reject(new Error('no data received')), 1000);
      });

      const deadline = Date.now() + 1000;
      while (!fake.calls[0]?.signal?.aborted && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(fake.calls[0]!.signal?.aborted).toBe(true);
    } finally {
      server.close();
    }
  });
});
