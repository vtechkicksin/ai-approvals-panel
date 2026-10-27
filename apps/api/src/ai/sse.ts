import type { Request, Response } from 'express';
import { textStreamEventSchema, type Language, type NoticeCode, type TextStreamEvent } from '@approvals/schemas';
import type { AiFailureReason } from './errors';
import type { GuardedEvent } from './guardedStream';
import { message } from './messages';

export interface TextAnswerOptions {
  req: Request;
  res: Response;
  language: Language;
  /** Runs the guarded AI stream; `signal` is aborted if the client disconnects. */
  run: (signal: AbortSignal) => AsyncIterable<GuardedEvent>;
  /** The backup answer when the AI fails before saying anything. */
  fallback: () => string | Promise<string>;
}

function noticeFor(reason: AiFailureReason | undefined): NoticeCode {
  return reason === 'first_token_timeout' ? 'ai_slow' : 'ai_unavailable';
}

/** Opens an SSE response. Every event is checked against the shared contract before it is written. */
export function openSse(res: Response) {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop proxies from buffering the stream
  });
  res.flushHeaders();

  return (event: TextStreamEvent) => {
    const checked = textStreamEventSchema.parse(event);
    if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(checked)}\n\n`);
  };
}

/**
 * Streams an AI text answer as SSE: tokens while the AI talks, then one of
 * done:ai, a cut-short notice (done:partial), or a notice + backup answer
 * (done:fallback). Status is always 200 once streaming starts; a failure
 * anywhere becomes a friendly `error` event, never a raw 500.
 */
export async function streamTextAnswer({ res, language, run, fallback }: TextAnswerOptions): Promise<void> {
  const client = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) client.abort();
  };
  res.on('close', onClose);
  const send = openSse(res);

  try {
    let end: Extract<GuardedEvent, { type: 'end' }> | undefined;
    for await (const event of run(client.signal)) {
      if (event.type === 'end') end = event;
      else if (event.chunk.text) send({ type: 'token', text: event.chunk.text });
    }
    if (client.signal.aborted) return; // nobody is listening any more

    if (end?.outcome === 'complete') {
      send({ type: 'done', source: 'ai' });
    } else if (end?.outcome === 'cut_short') {
      send({ type: 'notice', code: 'cut_short', message: message(language, 'cut_short') });
      send({ type: 'done', source: 'partial' });
    } else {
      const code = noticeFor(end?.reason);
      send({ type: 'notice', code, message: message(language, code) });
      send({ type: 'fallback', text: await fallback() });
      send({ type: 'done', source: 'fallback' });
    }
  } catch (err) {
    console.error(err);
    send({ type: 'error', code: 'answer_failed', message: message(language, 'answer_failed') });
  } finally {
    res.off('close', onClose);
    res.end();
  }
}
