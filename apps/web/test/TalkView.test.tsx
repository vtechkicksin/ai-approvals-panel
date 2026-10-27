import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TalkView } from '../src/components/assistant/TalkView';
import { usePanelStore } from '../src/state/panelStore';
import { initialTalkData, useTalkStore } from '../src/state/talkStore';
import { controlledSse, pendingFetch, renderWithProviders, resetPanelStore, sseResponse } from './helpers';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  resetPanelStore();
  useTalkStore.setState(initialTalkData);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  useTalkStore.getState().cancel();
  vi.unstubAllGlobals();
});

const reply = (...tokens: string[]) =>
  sseResponse([...tokens.map((text) => ({ type: 'token', text })), { type: 'done', source: 'ai' }]);
const input = () => screen.getByRole('textbox', { name: /message/i });
const log = () => screen.getByRole('log', { name: /conversation/i });
const sentBody = (call: number) => JSON.parse(fetchMock.mock.calls[call]![1]!.body as string) as {
  language: string;
  messages: { role: string; content: string }[];
};

async function say(text: string) {
  await userEvent.type(input(), text);
  await userEvent.keyboard('{Enter}');
}

describe('TalkView', () => {
  it('suggests questions to start with, and sends one when clicked', async () => {
    fetchMock.mockResolvedValue(reply('Start with the camera map.'));
    renderWithProviders(<TalkView />);

    await userEvent.click(screen.getByRole('button', { name: /which of these needs my attention first/i }));

    expect(await within(log()).findByText('Start with the camera map.')).toBeInTheDocument();
    expect(sentBody(0).messages).toEqual([{ role: 'user', content: 'Which of these needs my attention first and why?' }]);
  });

  it('streams the reply in token by token, and locks the input meanwhile', async () => {
    const sse = controlledSse();
    fetchMock.mockResolvedValue(sse.response);
    renderWithProviders(<TalkView />);

    await say('What first?');
    expect(within(log()).getByText('What first?')).toBeInTheDocument();
    expect(input()).toHaveValue('');
    await waitFor(() => expect(screen.getByRole('button', { name: /send/i })).toBeDisabled());

    act(() => sse.send({ type: 'token', text: 'Start with ' }));
    expect(await within(log()).findByText('Start with')).toBeInTheDocument();
    act(() => sse.send({ type: 'token', text: 'the camera map.' }));
    expect(await within(log()).findByText('Start with the camera map.')).toBeInTheDocument();

    act(() => {
      sse.send({ type: 'done', source: 'ai' });
      sse.close();
    });
    await userEvent.type(input(), 'x');
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  it('sends the earlier conversation with each new message', async () => {
    fetchMock.mockResolvedValueOnce(reply('The camera map.')).mockResolvedValueOnce(reply('It is urgent.'));
    renderWithProviders(<TalkView />);

    await say('Which first?');
    await within(log()).findByText('The camera map.');
    await say('Why?');
    await within(log()).findByText('It is urgent.');

    expect(sentBody(1).messages).toEqual([
      { role: 'user', content: 'Which first?' },
      { role: 'assistant', content: 'The camera map.' },
      { role: 'user', content: 'Why?' },
    ]);
  });

  it('uses the operator\'s language', async () => {
    usePanelStore.setState({ language: 'hi' });
    fetchMock.mockResolvedValue(reply('ठीक है।'));
    renderWithProviders(<TalkView />);

    await say('नमस्ते');

    await waitFor(() => expect(sentBody(0).language).toBe('hi'));
  });

  it('shows the backup answer with shortcuts to the other actions', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        { type: 'notice', code: 'ai_unavailable', message: 'The AI assistant is unavailable right now.' },
        { type: 'fallback', text: "I can't chat right now." },
        { type: 'done', source: 'fallback' },
      ]),
    );
    renderWithProviders(<TalkView />);

    await say('Hello');

    expect(await within(log()).findByText("I can't chat right now.")).toBeInTheDocument();
    expect(within(log()).getByText('The AI assistant is unavailable right now.')).toBeInTheDocument();
    await userEvent.click(within(log()).getByRole('button', { name: 'Help me' }));
    expect(usePanelStore.getState().activeAction).toBe('help');
  });

  it('does not send failed exchanges back as history', async () => {
    fetchMock
      .mockResolvedValueOnce(
        sseResponse([
          { type: 'notice', code: 'ai_unavailable', message: 'Unavailable.' },
          { type: 'fallback', text: 'Backup.' },
          { type: 'done', source: 'fallback' },
        ]),
      )
      .mockResolvedValueOnce(reply('Back online.'));
    renderWithProviders(<TalkView />);

    await say('First');
    await within(log()).findByText('Backup.');
    await say('Second');
    await within(log()).findByText('Back online.');

    expect(sentBody(1).messages).toEqual([
      { role: 'user', content: 'First' },
      { role: 'user', content: 'Second' },
    ]);
  });

  it('keeps a reply that was cut short, with a note', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        { type: 'token', text: 'Start with the' },
        { type: 'notice', code: 'cut_short', message: 'The reply was cut short.' },
        { type: 'done', source: 'partial' },
      ]),
    );
    renderWithProviders(<TalkView />);

    await say('Hi');

    expect(await within(log()).findByText('Start with the')).toBeInTheDocument();
    expect(within(log()).getByText('The reply was cut short.')).toBeInTheDocument();
  });

  it('shows a friendly error with Try again, which resends the same message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(reply('Here you go.'));
    renderWithProviders(<TalkView />);

    await say('Which first?');
    const error = await within(log()).findByText(/can.t reach the server/i);
    expect(within(log()).getByText('Which first?')).toBeInTheDocument(); // the message is kept

    await userEvent.click(within(log()).getByRole('button', { name: /try again/i }));

    expect(await within(log()).findByText('Here you go.')).toBeInTheDocument();
    expect(error).not.toBeInTheDocument();
    expect(sentBody(1).messages).toEqual([{ role: 'user', content: 'Which first?' }]);
  });

  it('never shows text from a malformed event', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([{ type: 'token', text: 'Good ' }, { type: 'token', text: 42 }, { type: 'done', source: 'ai' }]),
    );
    renderWithProviders(<TalkView />);

    await say('Hi');

    expect(await within(log()).findByText(/could not read/i)).toBeInTheDocument();
    expect(within(log()).queryByText('42')).not.toBeInTheDocument();
  });

  it('keeps the conversation when the view is closed and opened again', async () => {
    fetchMock.mockResolvedValue(reply('The camera map.'));
    const { unmount } = renderWithProviders(<TalkView />);
    await say('Which first?');
    await within(log()).findByText('The camera map.');

    unmount();
    renderWithProviders(<TalkView />);

    expect(within(log()).getByText('Which first?')).toBeInTheDocument();
    expect(within(log()).getByText('The camera map.')).toBeInTheDocument();
  });

  it('stops the reply when the view closes mid-answer', async () => {
    fetchMock.mockImplementation(pendingFetch);
    const { unmount } = renderWithProviders(<TalkView />);
    await say('Which first?');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    unmount();

    expect((fetchMock.mock.calls[0]![1]!.signal as AbortSignal).aborted).toBe(true);
    expect(useTalkStore.getState().isSending).toBe(false);
  });

  it('does not send an empty message', async () => {
    renderWithProviders(<TalkView />);

    await userEvent.type(input(), '   {Enter}');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('can clear the conversation', async () => {
    fetchMock.mockResolvedValue(reply('The camera map.'));
    renderWithProviders(<TalkView />);
    await say('Which first?');
    await within(log()).findByText('The camera map.');

    await userEvent.click(screen.getByRole('button', { name: /clear conversation/i }));

    expect(within(log()).queryByText('Which first?')).not.toBeInTheDocument();
  });
});
