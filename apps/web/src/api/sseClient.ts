import type { z } from 'zod';
import { API_URL, ApiClientError, errorFromResponse, isAbort } from './client';

export interface StreamSseOptions<T> {
  path: string;
  body: unknown;
  /** Every event is validated with this schema before `onEvent` sees it. */
  schema: z.ZodType<T>;
  /** The event that ends a healthy stream (e.g. `complete` or `error`). */
  isTerminal: (event: T) => boolean;
  onEvent: (event: T) => void;
  signal?: AbortSignal;
}

const FRAME_END = /\r?\n\r?\n/;

const interrupted = () => new ApiClientError('The connection was interrupted. Please try again.', 'stream_interrupted');
const unreadable = () =>
  new ApiClientError('The server sent data we could not read. Please try again.', 'invalid_response');

/** Parses one SSE frame into a validated event, or null for a frame with no data (e.g. a comment). */
function parseFrame<T>(frame: string, schema: z.ZodType<T>): T | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data) return null;

  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    throw unreadable();
  }
  const event = schema.safeParse(json);
  if (!event.success) throw unreadable();
  return event.data;
}

/**
 * POSTs JSON and reads the Server-Sent Events reply. Resolves after the
 * terminal event; throws a friendly ApiClientError for HTTP errors, network
 * failures, invalid events or a stream that ends early. Aborts are rethrown.
 */
export async function streamSse<T>({ path, body, schema, isTerminal, onEvent, signal }: StreamSseOptions<T>): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiClientError("Can't reach the server. Check your connection and try again.", 'network_error');
  }
  if (!res.ok) throw await errorFromResponse(res);
  if (!res.body) throw unreadable();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let match: RegExpExecArray | null;
      while ((match = FRAME_END.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const event = parseFrame(frame, schema);
        if (!event) continue;
        onEvent(event);
        if (isTerminal(event)) {
          void reader.cancel().catch(() => {});
          return;
        }
      }
    }
  } catch (err) {
    if (err instanceof ApiClientError) {
      void reader.cancel().catch(() => {});
      throw err;
    }
    if (isAbort(err) || signal?.aborted) throw err;
    throw interrupted();
  }
  throw interrupted();
}
