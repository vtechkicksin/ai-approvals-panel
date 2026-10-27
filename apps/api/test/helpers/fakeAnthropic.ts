/**
 * A fake `fetch` that speaks Anthropic's Messages streaming (SSE) format.
 *
 * Passed to ChatAnthropic via `clientOptions.fetch`, so tests exercise the real
 * LangChain + Anthropic SDK parsing code with no network and no API key.
 * Scripts can add delays or hang forever to simulate slow or stalled replies.
 */

export type SseStep =
  | { kind: 'event'; data: Record<string, unknown> }
  | { kind: 'delay'; ms: number }
  | { kind: 'hang' };

export type FakeReply =
  | { kind: 'stream'; steps: SseStep[] }
  | { kind: 'error'; status: number; body?: Record<string, unknown> };

export interface FakeAnthropic {
  fetch: typeof fetch;
  /** Every request the fake received, in order. */
  calls: { url: string; body: unknown; signal: AbortSignal | null | undefined }[];
}

const encoder = new TextEncoder();

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

/** Replies are used in order, one per request; the last one repeats. */
export function createFakeAnthropic(...replies: FakeReply[]): FakeAnthropic {
  const calls: FakeAnthropic['calls'] = [];

  const fakeFetch = async (input: unknown, init?: RequestInit): Promise<Response> => {
    const signal = init?.signal;
    calls.push({
      url: String(input),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
      signal,
    });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (!reply) throw new Error('createFakeAnthropic: no reply scripted');

    if (reply.kind === 'error') {
      return new Response(
        JSON.stringify(reply.body ?? { type: 'error', error: { type: 'api_error', message: 'fake error' } }),
        { status: reply.status, headers: { 'content-type': 'application/json' } },
      );
    }

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const step of reply.steps) {
            if (step.kind === 'delay') await sleep(step.ms, signal);
            else if (step.kind === 'hang') await sleep(2 ** 31 - 1, signal);
            else {
              const type = String(step.data.type);
              controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(step.data)}\n\n`));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };

  return { fetch: fakeFetch as typeof fetch, calls };
}

// ---- Builders for the common SSE events ----

export const ev = (data: Record<string, unknown>): SseStep => ({ kind: 'event', data });
export const delay = (ms: number): SseStep => ({ kind: 'delay', ms });
export const hang = (): SseStep => ({ kind: 'hang' });

export function messageStart(inputTokens = 12): SseStep {
  return ev({
    type: 'message_start',
    message: {
      id: 'msg_fake',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-5-5',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: inputTokens, output_tokens: 1 },
    },
  });
}

export function messageEnd(outputTokens = 5, stopReason = 'end_turn'): SseStep[] {
  return [
    ev({ type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: outputTokens } }),
    ev({ type: 'message_stop' }),
  ];
}

/** A full text reply, one SSE delta per piece. */
export function textReply(pieces: string[], opts: { gapMs?: number } = {}): SseStep[] {
  const steps: SseStep[] = [messageStart(), ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })];
  pieces.forEach((text, i) => {
    if (i > 0 && opts.gapMs) steps.push(delay(opts.gapMs));
    steps.push(ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }));
  });
  steps.push(ev({ type: 'content_block_stop', index: 0 }), ...messageEnd(pieces.length, 'end_turn'));
  return steps;
}

/** A full tool-use reply whose JSON arguments arrive in pieces. */
export function toolUseReply(name: string, jsonPieces: string[]): SseStep[] {
  return [
    messageStart(),
    ev({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_fake', name, input: {} } }),
    ...jsonPieces.map((partial_json) => ev({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json } })),
    ev({ type: 'content_block_stop', index: 0 }),
    ...messageEnd(jsonPieces.length, 'tool_use'),
  ];
}
