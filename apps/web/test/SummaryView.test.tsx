import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SummaryView } from '../src/components/assistant/SummaryView';
import { initialSummaryData, useSummaryStore } from '../src/state/summaryStore';
import { usePanelStore } from '../src/state/panelStore';
import {
  controlledSse,
  finalSummary,
  jsonResponse,
  pendingFetch,
  renderWithProviders,
  resetPanelStore,
  skeletonEvent,
  sseResponse,
} from './helpers';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  resetPanelStore();
  useSummaryStore.setState(initialSummaryData);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  useSummaryStore.getState().cancel();
  vi.unstubAllGlobals();
});

const cards = () => within(screen.getByRole('list', { name: /approvals in priority order/i })).getAllByRole('listitem');

describe('SummaryView', () => {
  it('shows a loading state the moment it opens', () => {
    fetchMock.mockImplementation(pendingFetch);

    renderWithProviders(<SummaryView />);

    expect(screen.getByRole('status')).toHaveTextContent(/reviewing the approvals queue/i);
  });

  it('sends no request if it closes straight away (as React StrictMode does on mount in development)', async () => {
    fetchMock.mockImplementation(pendingFetch);

    const { unmount } = renderWithProviders(<SummaryView />);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Otherwise every open would send two Gemini requests in development (one cancelled at once).
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requests the summary in the operator\'s language', async () => {
    usePanelStore.setState({ language: 'hi' });
    fetchMock.mockImplementation(pendingFetch);

    renderWithProviders(<SummaryView />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![1]!.body).toBe(JSON.stringify({ language: 'hi' }));
  });

  it('renders ranked cards first, then streams text in token by token', async () => {
    const sse = controlledSse();
    fetchMock.mockResolvedValue(sse.response);
    renderWithProviders(<SummaryView />);

    act(() => sse.send(skeletonEvent));
    await waitFor(() => expect(cards()).toHaveLength(4));
    expect(within(cards()[0]!).getByText('360° Spatial Zone Layout & Camera Map')).toBeInTheDocument();
    expect(within(cards()[0]!).getByText('Urgent')).toBeInTheDocument();

    act(() => sse.send({ type: 'delta', field: 'headline', text: 'Four approvals ' }));
    expect(await screen.findByText('Four approvals')).toBeInTheDocument();
    act(() => sse.send({ type: 'delta', field: 'headline', text: 'are waiting.' }));
    expect(await screen.findByText('Four approvals are waiting.')).toBeInTheDocument();

    act(() => sse.send({ type: 'delta', field: 'reason', itemId: 'apr-004', text: 'Review it first.' }));
    expect(await within(cards()[0]!).findByText('Review it first.')).toBeInTheDocument();
  });

  it('marks streamed text as unverified until the final summary arrives', async () => {
    const sse = controlledSse();
    fetchMock.mockResolvedValue(sse.response);
    renderWithProviders(<SummaryView />);

    act(() => {
      sse.send(skeletonEvent);
      sse.send({ type: 'delta', field: 'reason', itemId: 'apr-004', text: 'Streaming reason' });
    });
    const first = await waitFor(() => cards()[0]!);
    expect(within(first).getByText(/verifying/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/summary/i)).toHaveAttribute('aria-busy', 'true');

    act(() => {
      sse.send({ type: 'complete', source: 'ai', summary: finalSummary });
      sse.close();
    });

    expect(await within(cards()[0]!).findByText('AI reason for apr-004')).toBeInTheDocument();
    expect(within(cards()[0]!).queryByText(/verifying/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Streaming reason')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/summary/i)).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText(/written by ai/i)).toBeInTheDocument();
  });

  it('explains when the answer is rule-based because the AI was unavailable', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        skeletonEvent,
        { type: 'notice', code: 'ai_unavailable', message: 'The AI assistant is unavailable right now.' },
        { type: 'complete', source: 'fallback', summary: finalSummary },
      ]),
    );

    renderWithProviders(<SummaryView />);

    expect(await screen.findByText('The AI assistant is unavailable right now.')).toBeInTheDocument();
    expect(screen.getByText(/rule-based summary/i)).toBeInTheDocument();
    expect(screen.getByText(finalSummary.headline)).toBeInTheDocument();
  });

  it('shows a friendly error with Retry when the request fails, and recovers', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(sseResponse([skeletonEvent, { type: 'complete', source: 'ai', summary: finalSummary }]));

    renderWithProviders(<SummaryView />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/can.t reach the server/i);
    await userEvent.click(within(alert).getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(finalSummary.headline)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the server\'s message for a rejected request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: 'rate_limited', message: 'Please wait a moment.' } }, 429));

    renderWithProviders(<SummaryView />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Please wait a moment.');
  });

  it('never renders a malformed event; shows an error instead', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([skeletonEvent, { type: 'delta', field: 'reason', text: 'Injected without an item id' }]),
    );

    renderWithProviders(<SummaryView />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Injected without an item id')).not.toBeInTheDocument();
  });

  it('shows an error if the connection drops before the summary is complete', async () => {
    fetchMock.mockResolvedValue(sseResponse([skeletonEvent, { type: 'delta', field: 'headline', text: 'Half' }]));

    renderWithProviders(<SummaryView />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/interrupted/i);
  });

  it('can generate the summary again', async () => {
    fetchMock.mockImplementation(async () =>
      sseResponse([skeletonEvent, { type: 'complete', source: 'ai', summary: finalSummary }]),
    );
    renderWithProviders(<SummaryView />);
    await screen.findByText(finalSummary.headline);

    await userEvent.click(screen.getByRole('button', { name: /regenerate/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('stops the request when the view closes', async () => {
    fetchMock.mockImplementation(pendingFetch);
    const { unmount } = renderWithProviders(<SummaryView />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    unmount();

    expect((fetchMock.mock.calls[0]![1]!.signal as AbortSignal).aborted).toBe(true);
  });

  describe('read aloud', () => {
    afterEach(() => {
      // @ts-expect-error test cleanup of a browser API
      delete window.speechSynthesis;
    });

    it('reads the spoken script aloud in the chosen language when the browser can speak', async () => {
      const speak = vi.fn();
      Object.defineProperty(window, 'speechSynthesis', {
        value: { speak, cancel: vi.fn(), speaking: false },
        configurable: true,
      });
      vi.stubGlobal(
        'SpeechSynthesisUtterance',
        class {
          lang = '';
          constructor(readonly text: string) {}
        },
      );
      fetchMock.mockResolvedValue(sseResponse([skeletonEvent, { type: 'complete', source: 'ai', summary: finalSummary }]));

      renderWithProviders(<SummaryView />);
      await userEvent.click(await screen.findByRole('button', { name: /read aloud/i }));

      expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: finalSummary.spokenScript, lang: 'en-IN' }));
    });

    it('hides the button when the browser cannot speak', async () => {
      fetchMock.mockResolvedValue(sseResponse([skeletonEvent, { type: 'complete', source: 'ai', summary: finalSummary }]));

      renderWithProviders(<SummaryView />);
      await screen.findByText(finalSummary.headline);

      expect(screen.queryByRole('button', { name: /read aloud/i })).not.toBeInTheDocument();
    });
  });
});
