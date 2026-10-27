import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpView } from '../src/components/assistant/HelpView';
import { initialHelpData, useHelpStore } from '../src/state/helpStore';
import { usePanelStore } from '../src/state/panelStore';
import { controlledSse, jsonResponse, pendingFetch, renderWithProviders, resetPanelStore, sseResponse } from './helpers';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  resetPanelStore();
  useHelpStore.setState(initialHelpData);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  useHelpStore.getState().cancel();
  vi.unstubAllGlobals();
});

const citations = {
  type: 'citations',
  items: [
    { id: 'policy-4', heading: '4. When to reject', excerpt: 'Reject an item if the file is missing…' },
    { id: 'policy-3', heading: '3. How to review an item', excerpt: 'Open the item and check…' },
  ],
};
const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call]![1]!.body as string) as { language: string; question: string };

async function ask(question: string) {
  await userEvent.type(screen.getByRole('textbox', { name: /question/i }), question);
  await userEvent.click(screen.getByRole('button', { name: /^ask$/i }));
}

describe('HelpView', () => {
  it('offers example questions and asks one when clicked', async () => {
    fetchMock.mockResolvedValue(sseResponse([citations, { type: 'token', text: 'Reject it.' }, { type: 'done', source: 'ai' }]));
    renderWithProviders(<HelpView />);

    await userEvent.click(screen.getByRole('button', { name: /when should i reject an item/i }));

    expect(await screen.findByText('Reject it.')).toBeInTheDocument();
    expect(sentBody()).toEqual({ language: 'en', question: 'When should I reject an item?' });
  });

  it('shows the policy sources first, then streams the answer in', async () => {
    const sse = controlledSse();
    fetchMock.mockResolvedValue(sse.response);
    renderWithProviders(<HelpView />);

    await ask('When should I reject?');
    act(() => sse.send(citations));
    const sources = await screen.findByRole('list', { name: /sources from the policy/i });
    expect(within(sources).getByText('4. When to reject')).toBeInTheDocument();
    expect(within(sources).getByText('3. How to review an item')).toBeInTheDocument();

    act(() => sse.send({ type: 'token', text: 'Reject it if ' }));
    expect(await screen.findByText('Reject it if')).toBeInTheDocument();
    act(() => sse.send({ type: 'token', text: 'the file is missing.' }));
    expect(await screen.findByText('Reject it if the file is missing.')).toBeInTheDocument();

    act(() => {
      sse.send({ type: 'done', source: 'ai' });
      sse.close();
    });
    await waitFor(() => expect(screen.getByLabelText('Answer')).toHaveAttribute('aria-busy', 'false'));
    await userEvent.type(screen.getByRole('textbox', { name: /question/i }), 'Next question');
    expect(screen.getByRole('button', { name: /^ask$/i })).toBeEnabled();
  });

  it('says when the policy does not cover the question, with a shortcut to Talk to me', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        { type: 'fallback', text: "That's not covered by the approval policy." },
        { type: 'done', source: 'rules' },
      ]),
    );
    renderWithProviders(<HelpView />);

    await ask('Weather today?');

    expect(await screen.findByText("That's not covered by the approval policy.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Talk to me' }));
    expect(usePanelStore.getState().activeAction).toBe('talk');
  });

  it('shows the matching policy text when the AI is unavailable', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        citations,
        { type: 'notice', code: 'ai_unavailable', message: 'The AI assistant is unavailable right now.' },
        { type: 'fallback', text: 'Here are the policy sections that match your question:\n\n4. When to reject\nReject an item if…' },
        { type: 'done', source: 'fallback' },
      ]),
    );
    renderWithProviders(<HelpView />);

    await ask('When should I reject?');

    expect(await screen.findByText('The AI assistant is unavailable right now.')).toBeInTheDocument();
    expect(screen.getByText(/Here are the policy sections that match your question/)).toBeInTheDocument();
  });

  it('shows a friendly error with Try again, which asks the same question', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(sseResponse([citations, { type: 'token', text: 'Answer.' }, { type: 'done', source: 'ai' }]));
    renderWithProviders(<HelpView />);

    await ask('When should I reject?');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/can.t reach the server/i);
    await userEvent.click(within(alert).getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Answer.')).toBeInTheDocument();
    expect(sentBody(1).question).toBe('When should I reject?');
  });

  it('never shows a malformed event', async () => {
    fetchMock.mockResolvedValue(sseResponse([{ type: 'citations', items: [] }, { type: 'done', source: 'ai' }]));
    renderWithProviders(<HelpView />);

    await ask('When should I reject?');

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not read/i);
  });

  it('asks in the operator\'s language', async () => {
    usePanelStore.setState({ language: 'hi' });
    fetchMock.mockImplementation(pendingFetch);
    renderWithProviders(<HelpView />);

    await ask('कब अस्वीकार करें?');

    await waitFor(() => expect(sentBody().language).toBe('hi'));
  });

  it('stops the request when the view closes', async () => {
    fetchMock.mockImplementation(pendingFetch);
    const { unmount } = renderWithProviders(<HelpView />);
    await ask('When should I reject?');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    unmount();

    expect((fetchMock.mock.calls[0]![1]!.signal as AbortSignal).aborted).toBe(true);
  });

  it('does not ask an empty question', async () => {
    renderWithProviders(<HelpView />);

    await userEvent.type(screen.getByRole('textbox', { name: /question/i }), '   ');

    expect(screen.getByRole('button', { name: /^ask$/i })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the please-wait message when the AI is rate limited', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: 'rate_limited', message: 'Please wait about 30 seconds and try again.' } }, 429));
    renderWithProviders(<HelpView />);

    await ask('When should I reject?');

    expect(await screen.findByRole('alert')).toHaveTextContent('Please wait about 30 seconds and try again.');
  });
});
