import type { z } from 'zod';
import { apiErrorSchema, approvalsResponseSchema, type ApprovalsResponse } from '@approvals/schemas';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/** The only error type the UI sees from the API: always safe to show. */
export class ApiClientError extends Error {
  override name = 'ApiClientError';
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

function isAbort(err: unknown): boolean {
  // DOMException is not an Error subclass in every runtime, so check the name.
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

/**
 * Fetches JSON and validates it against a shared schema. The UI never
 * receives unvalidated data or a raw technical error message.
 */
async function requestJson<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { accept: 'application/json', ...init.headers },
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiClientError("Can't reach the server. Check your connection and try again.", 'network_error');
  }

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const apiError = apiErrorSchema.safeParse(body);
    if (apiError.success) throw new ApiClientError(apiError.data.error.message, apiError.data.error.code);
    throw new ApiClientError('The server had a problem. Please try again.', 'http_error');
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiClientError('The server sent data we could not read. Please try again.', 'invalid_response');
  }
  return parsed.data;
}

export function fetchApprovals(signal?: AbortSignal): Promise<ApprovalsResponse> {
  return requestJson('/api/approvals', approvalsResponseSchema, { signal });
}
