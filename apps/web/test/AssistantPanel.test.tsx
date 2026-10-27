import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantPanel } from '../src/components/assistant/AssistantPanel';
import { approvalsResponse, jsonResponse, renderWithProviders, resetPanelStore } from './helpers';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  resetPanelStore();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(approvalsResponse));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const panel = () => screen.getByRole('region', { name: /approvals assistant/i });

describe('AssistantPanel', () => {
  it('matches the reference layout: header, greeting bar, four actions, footer', async () => {
    renderWithProviders(<AssistantPanel />);

    const p = within(panel());
    expect(p.getByRole('heading', { name: 'Approvals' })).toBeInTheDocument();
    expect(p.getByRole('button', { name: /about this assistant/i })).toBeInTheDocument();
    expect(p.getByRole('button', { name: /expand/i })).toBeInTheDocument();
    expect(p.getByRole('button', { name: /close assistant/i })).toBeInTheDocument();
    expect(p.getByRole('button', { name: /replay greeting/i })).toBeInTheDocument();
    for (const name of ['Present me Summary', 'Talk to me', 'Help me', 'Teach me']) {
      expect(p.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(await p.findByText('4 folders / items')).toBeInTheDocument();
  });

  it('closes, and opens again from the floating button', async () => {
    renderWithProviders(<AssistantPanel />);

    await userEvent.click(screen.getByRole('button', { name: /close assistant/i }));
    expect(screen.queryByRole('region', { name: /approvals assistant/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /open assistant/i }));
    expect(panel()).toBeInTheDocument();
  });

  it('closes with the Escape key', async () => {
    renderWithProviders(<AssistantPanel />);

    await userEvent.click(within(panel()).getByRole('button', { name: 'Help me' }));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('region', { name: /approvals assistant/i })).not.toBeInTheDocument();
  });

  it('expands and collapses', async () => {
    renderWithProviders(<AssistantPanel />);
    const expand = within(panel()).getByRole('button', { name: /expand/i });

    await userEvent.click(expand);
    expect(expand).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(expand);
    expect(expand).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens an action view and goes back to the cards', async () => {
    renderWithProviders(<AssistantPanel />);

    await userEvent.click(within(panel()).getByRole('button', { name: 'Talk to me' }));
    expect(within(panel()).getByRole('heading', { name: 'Talk to me' })).toBeInTheDocument();
    await userEvent.click(within(panel()).getByRole('button', { name: /back/i }));

    await userEvent.click(within(panel()).getByRole('button', { name: 'Present me Summary' }));
    expect(within(panel()).getByRole('heading', { name: 'Present me Summary' })).toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: 'Talk to me' })).not.toBeInTheDocument();

    await userEvent.click(within(panel()).getByRole('button', { name: /back/i }));
    expect(within(panel()).getByRole('button', { name: 'Talk to me' })).toBeInTheDocument();
  });

  it('switches the operator language between English and Hindi', async () => {
    renderWithProviders(<AssistantPanel />);
    const group = within(within(panel()).getByRole('group', { name: /language/i }));

    expect(group.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(group.getByRole('button', { name: 'हिं' }));

    expect(group.getByRole('button', { name: 'हिं' })).toHaveAttribute('aria-pressed', 'true');
    expect(group.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps working when the queue count cannot load', async () => {
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    renderWithProviders(<AssistantPanel />);

    expect(await within(panel()).findByText('– folders / items')).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Help me' })).toBeEnabled();
  });

  it('opening Present me Summary starts the AI summary', async () => {
    renderWithProviders(<AssistantPanel />);

    await userEvent.click(within(panel()).getByRole('button', { name: 'Present me Summary' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/ai/summary'), expect.anything()),
    );
  });
});
