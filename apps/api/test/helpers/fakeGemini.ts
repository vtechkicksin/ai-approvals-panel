/**
 * A fake Gemini API. It replaces global `fetch` for Gemini URLs only, and
 * speaks the `streamGenerateContent?alt=sse` format, so tests run the real
 * LangChain + Google SDK code with no network and no API key.
 * Scripts can add delays or hang forever to simulate slow or stalled replies.
 */

export type SseStep =
  | { kind: 'event'; data: Record<string, unknown> }
  | { kind: 'delay'; ms: number }
  | { kind: 'hang' };

export type FakeReply =
  | { kind: 'stream'; steps: SseStep[] }
  | { kind: 'error'; status: number; delayMs?: number }
  /** The connection fails, as when the network is down. */
  | { kind: 'network'; delayMs?: number };

export interface FakeCall {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
  signal: AbortSignal | null | undefined;
}

export interface FakeGemini {
  /** Every request the fake received, in order. */
  calls: FakeCall[];
  restore: () => void;
}

const GEMINI_HOST = 'generativelanguage.googleapis.com';
const encoder = new TextEncoder();

const STATUS_NAMES: Record<number, string> = {
  400: 'INVALID_ARGUMENT',
  401: 'UNAUTHENTICATED',
  403: 'PERMISSION_DENIED',
  429: 'RESOURCE_EXHAUSTED',
  500: 'INTERNAL',
  503: 'UNAVAILABLE',
};

function abortError(): Error {
  const err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

/**
 * Installs the fake. Replies are used in order, one per request; the last one
 * repeats. Call `restore()` (or rely on jest `restoreMocks`) afterwards.
 */
export function installFakeGemini(...replies: FakeReply[]): FakeGemini {
  const calls: FakeCall[] = [];
  const realFetch = globalThis.fetch;

  const fakeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes(GEMINI_HOST)) return realFetch(input, init);

    const signal = init?.signal;
    calls.push({
      url,
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {},
      signal,
    });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (!reply) throw new Error('installFakeGemini: no reply scripted');

    if (reply.kind === 'network') {
      if (reply.delayMs) await sleep(reply.delayMs, signal);
      throw new TypeError('fetch failed');
    }

    if (reply.kind === 'error') {
      if (reply.delayMs) await sleep(reply.delayMs, signal);
      const error = { code: reply.status, message: 'fake error', status: STATUS_NAMES[reply.status] ?? 'UNKNOWN' };
      return new Response(JSON.stringify({ error }), {
        status: reply.status,
        headers: { 'content-type': 'application/json' },
      });
    }

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const step of reply.steps) {
            if (step.kind === 'delay') await sleep(step.ms, signal);
            else if (step.kind === 'hang') await sleep(2 ** 31 - 1, signal);
            else controller.enqueue(encoder.encode(`data: ${JSON.stringify(step.data)}\n\n`));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };

  globalThis.fetch = fakeFetch as typeof fetch;
  return { calls, restore: () => void (globalThis.fetch = realFetch) };
}

// ---- Builders for Gemini stream chunks ----

export const delay = (ms: number): SseStep => ({ kind: 'delay', ms });
export const hang = (): SseStep => ({ kind: 'hang' });
const ev = (data: Record<string, unknown>): SseStep => ({ kind: 'event', data });

const candidate = (parts: Record<string, unknown>[], finishReason?: string) => ({
  content: { parts, role: 'model' },
  index: 0,
  ...(finishReason && { finishReason }),
});

function usage(promptTokens: number, outputTokens: number) {
  return { promptTokenCount: promptTokens, candidatesTokenCount: outputTokens, totalTokenCount: promptTokens + outputTokens };
}

/** A chunk with no visible text (Gemini can send these before the first word). */
export function emptyChunk(): SseStep {
  return ev({ candidates: [candidate([{ text: '' }])], usageMetadata: usage(12, 0) });
}

/** A full text reply, one SSE chunk per piece; usage arrives on the last chunk. */
export function textReply(pieces: string[], opts: { gapMs?: number } = {}): SseStep[] {
  const steps: SseStep[] = [];
  pieces.forEach((text, i) => {
    if (i > 0 && opts.gapMs) steps.push(delay(opts.gapMs));
    const last = i === pieces.length - 1;
    steps.push(
      ev({
        candidates: [candidate([{ text }], last ? 'STOP' : undefined)],
        ...(last && { usageMetadata: usage(12, pieces.length) }),
      }),
    );
  });
  return steps;
}

/** The first `count` pieces of a text reply, without the ending (for stall tests). */
export function textPieces(pieces: string[]): SseStep[] {
  return pieces.map((text) => ev({ candidates: [candidate([{ text }])] }));
}

/** A function-call reply. Gemini sends the arguments whole, not in pieces. */
export function functionCallReply(name: string, args: Record<string, unknown>): SseStep[] {
  return [ev({ candidates: [candidate([{ functionCall: { name, args } }], 'STOP')], usageMetadata: usage(12, 5) })];
}
