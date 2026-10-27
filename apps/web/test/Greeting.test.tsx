import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantPanel } from '../src/components/assistant/AssistantPanel';
import { initialGreetingData, useGreetingStore } from '../src/state/greetingStore';
import { usePanelStore } from '../src/state/panelStore';
import { approvalsResponse, controlledSse, jsonResponse, renderWithProviders, resetPanelStore, sseResponse } from './helpers';

const TEMPLATE =
  'Good morning! 4 approvals are waiting (1 urgent, 1 high, 2 medium). Start with “360° Spatial Zone Layout & Camera Map”.';

const fetchMock = vi.fn<typeof fetch>();
const greetingCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/ai/greeting'));

/** Approvals requests get the queue; greeting requests get the next scripted reply. */
function route(replies: (Response | (() => Promise<Response>))[] = [], approvals: unknown = approvalsResponse) {
  fetchMock.mockImplementation(async (url) => {
    if (String(url).includes('/api/approvals')) return jsonResponse(approvals);
    const next = replies.shift();
    if (!next) throw new Error('no reply scripted');
    return typeof next === 'function' ? next() : next;
  });
}

const greeting = () => screen.getByRole('status', { name: /greeting/i });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 27, 9, 0)); // 9am local: "Good morning"
  resetPanelStore();
  useGreetingStore.setState(initialGreetingData);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  useGreetingStore.getState().cancel();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Greeting', () => {
  it('greets instantly with the live numbers and the time of day, without any AI call', async () => {
    route();
    renderWithProviders(<AssistantPanel />);

    await waitFor(() => expect(greeting()).toHaveTextContent(TEMPLATE));
    expect(greetingCalls()).toHaveLength(0);
  });

  it('says hello while the queue is still loading', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    renderWithProviders(<AssistantPanel />);

    expect(greeting()).toHaveTextContent(/^Good morning!$/);
  });

  it('says you are all caught up when nothing is waiting', async () => {
    route([], { items: [], total: 0 });
    renderWithProviders(<AssistantPanel />);

    await waitFor(() => expect(greeting()).toHaveTextContent("Good morning! No approvals are waiting. You're all caught up."));
  });

  it('greets in Hindi when the operator chose Hindi', async () => {
    usePanelStore.setState({ language: 'hi' });
    route();
    renderWithProviders(<AssistantPanel />);

    await waitFor(() => expect(greeting()).toHaveTextContent(/^सुप्रभात!/));
  });

  it('Replay Greeting (AI off) shows the template again, reads it aloud, and makes no AI call', async () => {
    const speak = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', { value: { speak, cancel: vi.fn() }, configurable: true });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        lang = '';
        constructor(readonly text: string) {}
      },
    );
    route();
    renderWithProviders(<AssistantPanel />);
    await waitFor(() => expect(greeting()).toHaveTextContent(TEMPLATE));

    await userEvent.click(screen.getByRole('button', { name: /replay greeting/i }));

    expect(greetingCalls()).toHaveLength(0);
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: TEMPLATE, lang: 'en-IN' }));
    // @ts-expect-error test cleanup of a browser API
    delete window.speechSynthesis;
  });

  it('with AI wording on, shows the template at once, then streams the AI wording over it', async () => {
    const sse = controlledSse();
    route([sse.response]);
    renderWithProviders(<AssistantPanel />);
    await waitFor(() => expect(greeting()).toHaveTextContent(TEMPLATE));

    await userEvent.click(screen.getByRole('checkbox', { name: /let ai word it/i }));
    await userEvent.click(screen.getByRole('button', { name: /replay greeting/i }));
    expect(greeting()).toHaveTextContent(TEMPLATE);
    await waitFor(() => expect(greetingCalls()).toHaveLength(1));
    expect(JSON.parse(greetingCalls()[0]![1]!.body as string)).toEqual({ language: 'en', partOfDay: 'morning' });

    act(() => sse.send({ type: 'token', text: 'Morning! 4 approvals ' }));
    await waitFor(() => expect(greeting()).toHaveTextContent('Morning! 4 approvals'));
    act(() => {
      sse.send({ type: 'token', text: 'need you today.' });
      sse.send({ type: 'done', source: 'ai' });
      sse.close();
    });

    await waitFor(() => expect(greeting()).toHaveTextContent('Morning! 4 approvals need you today.'));
    expect(screen.getByText(/worded by ai/i)).toBeInTheDocument();
  });

  it('keeps the template, with a quiet note, when the AI wording is not used', async () => {
    route([
      sseResponse([
        { type: 'notice', code: 'ai_unavailable', message: 'The AI assistant is unavailable right now.' },
        { type: 'fallback', text: TEMPLATE },
        { type: 'done', source: 'fallback' },
      ]),
    ]);
    renderWithProviders(<AssistantPanel />);
    await waitFor(() => expect(greeting()).toHaveTextContent(TEMPLATE));

    await userEvent.click(screen.getByRole('checkbox', { name: /let ai word it/i }));
    await userEvent.click(screen.getByRole('button', { name: /replay greeting/i }));

    expect(await screen.findByText(/showing the standard greeting/i)).toBeInTheDocument();
    expect(greeting()).toHaveTextContent(TEMPLATE);
  });

  it('keeps the template when the request fails', async () => {
    route([() => Promise.reject(new TypeError('Failed to fetch'))]);
    renderWithProviders(<AssistantPanel />);
    await waitFor(() => expect(greeting()).toHaveTextContent(TEMPLATE));

    await userEvent.click(screen.getByRole('checkbox', { name: /let ai word it/i }));
    await userEvent.click(screen.getByRole('button', { name: /replay greeting/i }));

    expect(await screen.findByText(/showing the standard greeting/i)).toBeInTheDocument();
    expect(greeting()).toHaveTextContent(TEMPLATE);
  });

  it('Replay Greeting from inside an action goes back to the cards and greets', async () => {
    route();
    renderWithProviders(<AssistantPanel />);
    const panel = screen.getByRole('region', { name: /approvals assistant/i });
    await userEvent.click(within(panel).getByRole('button', { name: 'Teach me' }));

    await userEvent.click(within(panel).getByRole('button', { name: /replay greeting/i }));

    expect(usePanelStore.getState().activeAction).toBeNull();
    await waitFor(() => expect(greeting()).toHaveTextContent(TEMPLATE));
  });
});
