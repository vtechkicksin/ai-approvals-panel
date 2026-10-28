import { z } from 'zod';
import { API_URL, ApiClientError } from '../src/api/client';
import { streamSse } from '../src/api/sseClient';
import { controlledSse, jsonResponse, sseResponse } from './helpers';

const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), text: z.string() }),
  z.object({ type: z.literal('done') }),
]);
type Event = z.infer<typeof eventSchema>;

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function run(signal?: AbortSignal) {
  const events: Event[] = [];
  await streamSse({
    path: '/api/test',
    body: { language: 'en' },
    schema: eventSchema,
    isTerminal: (e) => e.type === 'done',
    onEvent: (e) => events.push(e),
    signal,
  });
  return events;
}

async function errorFrom(promise: Promise<unknown>): Promise<ApiClientError> {
  const err = await promise.then(() => undefined, (e: unknown) => e);
  expect(err).toBeInstanceOf(ApiClientError);
  return err as ApiClientError;
}

describe('streamSse', () => {
  it('POSTs JSON with cookies and asks for an event stream', async () => {
    fetchMock.mockResolvedValue(sseResponse([{ type: 'done' }]));

    await run();

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/test`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ language: 'en' }),
        headers: expect.objectContaining({ accept: 'text/event-stream', 'content-type': 'application/json' }),
      }),
    );
  });

  it('delivers events as they arrive, even when split across network chunks', async () => {
    const sse = controlledSse();
    fetchMock.mockResolvedValue(sse.response);
    const events: Event[] = [];
    const done = streamSse({
      path: '/api/test',
      body: {},
      schema: eventSchema,
      isTerminal: (e) => e.type === 'done',
      onEvent: (e) => events.push(e),
    });

    sse.raw('data: {"type":"token","te');
    sse.raw('xt":"Hel"}\n\ndata: {"type":"token","text":"lo"}\n\n');
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events).toEqual([
      { type: 'token', text: 'Hel' },
      { type: 'token', text: 'lo' },
    ]);

    sse.send({ type: 'done' });
    sse.close();
    await done;
    expect(events).toHaveLength(3);
  });

  it('rejects an event with the wrong shape instead of passing it on', async () => {
    fetchMock.mockResolvedValue(sseResponse([{ type: 'token', text: 42 }, { type: 'done' }]));

    const err = await errorFrom(run());

    expect(err.code).toBe('invalid_response');
  });

  it('rejects an event that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('data: <html>oops</html>\n\n', { status: 200 }));

    expect((await errorFrom(run())).code).toBe('invalid_response');
  });

  it('treats a stream that ends before the final event as interrupted', async () => {
    fetchMock.mockResolvedValue(sseResponse([{ type: 'token', text: 'Half' }]));

    const err = await errorFrom(run());

    expect(err.code).toBe('stream_interrupted');
    expect(err.message).toMatch(/interrupted|try again/i);
  });

  it('uses the server error for a JSON error response (e.g. 400 or 429)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: 'invalid_request', message: 'Bad language.' } }, 400));

    const err = await errorFrom(run());

    expect(err).toMatchObject({ code: 'invalid_request', message: 'Bad language.' });
  });

  it('gives a friendly message when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect((await errorFrom(run())).code).toBe('network_error');
  });

  it('gives a friendly message when the connection drops mid-stream', async () => {
    const sse = controlledSse();
    fetchMock.mockResolvedValue(sse.response);
    const promise = run();

    sse.send({ type: 'token', text: 'Hi' });
    sse.fail(new TypeError('network error'));

    expect((await errorFrom(promise)).code).toBe('stream_interrupted');
  });

  it('lets a cancelled stream stay cancelled', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    fetchMock.mockRejectedValue(abort);

    await expect(run(new AbortController().signal)).rejects.toBe(abort);
  });
});
