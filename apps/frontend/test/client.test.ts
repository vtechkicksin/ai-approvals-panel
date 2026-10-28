import { API_URL, ApiClientError, fetchApprovals } from '../src/api/client';
import { approvalsResponse, jsonResponse } from './helpers';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function errorFrom(promise: Promise<unknown>): Promise<ApiClientError> {
  const err = await promise.then(() => undefined, (e: unknown) => e);
  expect(err).toBeInstanceOf(ApiClientError);
  return err as ApiClientError;
}

describe('fetchApprovals', () => {
  it('returns the validated queue and sends cookies', async () => {
    fetchMock.mockResolvedValue(jsonResponse(approvalsResponse));

    await expect(fetchApprovals()).resolves.toEqual(approvalsResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/approvals`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('rejects a 200 response with the wrong shape instead of trusting it', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [{ title: 'no id' }], total: 1 }));

    const err = await errorFrom(fetchApprovals());

    expect(err.code).toBe('invalid_response');
    expect(err.message).not.toMatch(/zod|expected|invalid_type/i); // friendly, not a schema dump
  });

  it('uses the server\'s error code and message for a JSON error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } }, 500),
    );

    const err = await errorFrom(fetchApprovals());

    expect(err.code).toBe('internal_error');
    expect(err.message).toBe('Something went wrong. Please try again.');
  });

  it('gives a friendly message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));

    const err = await errorFrom(fetchApprovals());

    expect(err.code).toBe('http_error');
    expect(err.message).not.toMatch(/html|502/i);
  });

  it('gives a friendly message when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const err = await errorFrom(fetchApprovals());

    expect(err.code).toBe('network_error');
    expect(err.message).toMatch(/connection|reach/i);
  });

  it('lets a cancelled request stay cancelled', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    fetchMock.mockRejectedValue(abort);

    await expect(fetchApprovals()).rejects.toBe(abort);
  });
});
