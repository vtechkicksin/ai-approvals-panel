import { screen } from '@testing-library/react';
import { App } from '../src/App';
import { approvalsResponse, jsonResponse, renderWithProviders, resetPanelStore } from './helpers';

beforeEach(() => {
  resetPanelStore();
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(approvalsResponse)));
});
afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('shows the page heading, the approvals table and the assistant panel', async () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { name: /approvals & review/i })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: /pending approval requests/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /approvals assistant/i })).toBeInTheDocument();
  });
});
