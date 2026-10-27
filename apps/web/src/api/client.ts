import type { z } from 'zod';
import { apiErrorSchema, approvalsResponseSchema, type ApprovalsResponse, type TeachGuide } from '@approvals/schemas';

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

export function isAbort(err: unknown): boolean {
  // DOMException is not an Error subclass in every runtime, so check the name.
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

/** Turns a non-2xx response into a friendly error, using the server's message when it sent one. */
export async function errorFromResponse(res: Response): Promise<ApiClientError> {
  const body: unknown = await res.json().catch(() => undefined);
  const apiError = apiErrorSchema.safeParse(body);
  if (apiError.success) return new ApiClientError(apiError.data.error.message, apiError.data.error.code);
  return new ApiClientError('The server had a problem. Please try again.', 'http_error');
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

  if (!res.ok) throw await errorFromResponse(res);
  const body: unknown = await res.json().catch(() => undefined);

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiClientError('The server sent data we could not read. Please try again.', 'invalid_response');
  }
  return parsed.data;
}

export function fetchApprovals(signal?: AbortSignal): Promise<ApprovalsResponse> {
  return requestJson('/api/approvals', approvalsResponseSchema, { signal });
}

export function fetchTeachGuide(_signal?: AbortSignal): Promise<TeachGuide> {
  throw new Error('Not implemented');
}
