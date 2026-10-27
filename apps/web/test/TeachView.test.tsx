import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeachView } from '../src/components/assistant/TeachView';
import { usePanelStore } from '../src/state/panelStore';
import { initialTeachData, useTeachChatStore, useTeachStore } from '../src/state/teachStore';
import { initialTalkData } from '../src/state/talkStore';
import { controlledSse, jsonResponse, renderWithProviders, resetPanelStore, sseResponse } from './helpers';

const guide = {
  sourceSectionId: 'policy-3',
  steps: [
    { number: 1, text: 'Open the item and check the title and location are correct.' },
    { number: 2, text: 'Open the file itself: watch the video, read the PDF, or view the image.' },
    { number: 3, text: 'Compare the content with the policy and with current site rules.' },
    { number: 4, text: 'Approve it, or reject it with a clear reason.' },
    { number: 5, text: 'Add a short note so the submitter knows what happens next.' },
  ],
};

const fetchMock = vi.fn<typeof fetch>();
const teachCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/ai/teach'));
const teachBody = (i: number) =>
  JSON.parse(teachCalls()[i]![1]!.body as string) as { language: string; step: number; messages: unknown[] };

/** Guide requests get the guide; teach requests get the next scripted reply. */
function route(...replies: (Response | (() => Response | Promise<Response>))[]) {
  fetchMock.mockImplementation(async (url) => {
    if (String(url).includes('/api/teach/guide')) return jsonResponse(guide);
    const next = replies.shift();
    if (!next) throw new Error('no reply scripted');
    return typeof next === 'function' ? next() : next;
  });
}

const reply = (...tokens: string[]) =>
  sseResponse([...tokens.map((text) => ({ type: 'token', text })), { type: 'done', source: 'ai' }]);

beforeEach(() => {
  resetPanelStore();
  useTeachStore.setState(initialTeachData);
  useTeachChatStore.setState(initialTalkData);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  useTeachChatStore.getState().cancel();
  vi.unstubAllGlobals();
});

async function askFollowUp(text: string) {
  await userEvent.type(screen.getByRole('textbox', { name: /ask about this step/i }), text);
  await userEvent.keyboard('{Enter}');
}

describe('TeachView', () => {
  it('shows the first step of the guide from the policy', async () => {
    route();
    renderWithProviders(<TeachView />);

    expect(await screen.findByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByText(guide.steps[0]!.text)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('moves through the steps and finishes', async () => {
    route();
    renderWithProviders(<TeachView />);
    await screen.findByText('Step 1 of 5');

    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();

    for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /finish/i }));

    expect(screen.getByText(/ready to review approvals/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /start again/i }));
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('answers a follow-up about the current step, streamed in', async () => {
    const sse = controlledSse();
    route(sse.response);
    renderWithProviders(<TeachView />);
    await screen.findByText('Step 1 of 5');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    await askFollowUp('Why open the file?');
    act(() => sse.send({ type: 'token', text: 'To check the content ' }));
    expect(await screen.findByText('To check the content')).toBeInTheDocument();
    act(() => {
      sse.send({ type: 'token', text: 'matches the title.' });
      sse.send({ type: 'done', source: 'ai' });
      sse.close();
    });
    expect(await screen.findByText('To check the content matches the title.')).toBeInTheDocument();

    expect(teachBody(0)).toEqual({
      language: 'en',
      step: 2,
      messages: [{ role: 'user', content: 'Why open the file?' }],
    });
  });

  it('offers quick follow-ups such as "explain it more simply"', async () => {
    route(reply('Think of it like…'));
    renderWithProviders(<TeachView />);
    await screen.findByText('Step 1 of 5');

    await userEvent.click(screen.getByRole('button', { name: /explain this step more simply/i }));

    expect(await screen.findByText('Think of it like…')).toBeInTheDocument();
  });

  it('keeps a separate thread per step, and sends only that step\'s thread', async () => {
    route(reply('Answer one.'), reply('Answer two.'), reply('Answer three.'));
    renderWithProviders(<TeachView />);
    await screen.findByText('Step 1 of 5');

    await askFollowUp('Question on step 1');
    await screen.findByText('Answer one.');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.queryByText('Answer one.')).not.toBeInTheDocument();

    await askFollowUp('Question on step 2');
    await screen.findByText('Answer two.');
    expect(teachBody(1).messages).toEqual([{ role: 'user', content: 'Question on step 2' }]);

    await userEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText('Answer one.')).toBeInTheDocument();
    await askFollowUp('Follow-up on step 1');
    await screen.findByText('Answer three.');
    expect(teachBody(2)).toMatchObject({
      step: 1,
      messages: [
        { role: 'user', content: 'Question on step 1' },
        { role: 'assistant', content: 'Answer one.' },
        { role: 'user', content: 'Follow-up on step 1' },
      ],
    });
  });

  it('shows the fixed guide backup when the AI is unavailable', async () => {
    route(
      sseResponse([
        { type: 'notice', code: 'ai_unavailable', message: 'The AI assistant is unavailable right now.' },
        { type: 'fallback', text: "I can't answer follow-up questions right now. Step 1: Open the item…" },
        { type: 'done', source: 'fallback' },
      ]),
    );
    renderWithProviders(<TeachView />);
    await screen.findByText('Step 1 of 5');

    await askFollowUp('Why?');

    expect(await screen.findByText(/can.t answer follow-up questions right now/i)).toBeInTheDocument();
    expect(screen.getByText('The AI assistant is unavailable right now.')).toBeInTheDocument();
  });

  it('shows a friendly error with Try again for a failed follow-up', async () => {
    route(() => Promise.reject(new TypeError('Failed to fetch')), reply('Here you go.'));
    renderWithProviders(<TeachView />);
    await screen.findByText('Step 1 of 5');

    await askFollowUp('Why?');
    expect(await screen.findByText(/can.t reach the server/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Here you go.')).toBeInTheDocument();
  });

  it('shows an error with Retry if the guide cannot load', async () => {
    let first = true;
    fetchMock.mockImplementation(async () => {
      if (first) {
        first = false;
        throw new TypeError('Failed to fetch');
      }
      return jsonResponse(guide);
    });
    renderWithProviders(<TeachView />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn.t load the guide/i);
    await userEvent.click(within(alert).getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('asks in the operator\'s language', async () => {
    usePanelStore.setState({ language: 'hi' });
    route(reply('ठीक है।'));
    renderWithProviders(<TeachView />);
    await screen.findByText('Step 1 of 5');

    await askFollowUp('क्यों?');

    await waitFor(() => expect(teachBody(0).language).toBe('hi'));
  });
});
