import type { z } from 'zod';

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

/**
 * POSTs JSON and reads the Server-Sent Events reply. Resolves after the
 * terminal event; throws a friendly ApiClientError for HTTP errors, network
 * failures, invalid events or a stream that ends early. Aborts are rethrown.
 */
export async function streamSse<T>(_options: StreamSseOptions<T>): Promise<void> {
  throw new Error('Not implemented');
}
