import type { ApprovalsResponse } from '@approvals/schemas';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiClientError extends Error {
  override name = 'ApiClientError';
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function fetchApprovals(_signal?: AbortSignal): Promise<ApprovalsResponse> {
  throw new Error('Not implemented');
}
