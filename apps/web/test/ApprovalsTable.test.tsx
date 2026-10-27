import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApprovalsTable } from '../src/components/ApprovalsTable';
import { approvalsResponse, jsonResponse, pendingFetch, renderWithProviders } from './helpers';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const bodyRows = () => screen.getAllByRole('row').slice(1); // skip the header row

describe('ApprovalsTable', () => {
  it('shows a loading state while the queue is on its way', () => {
    fetchMock.mockImplementation(pendingFetch);

    renderWithProviders(<ApprovalsTable />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading approvals/i);
  });

  it('lists the queue in ranked order with every column', async () => {
    fetchMock.mockResolvedValue(jsonResponse(approvalsResponse));

    renderWithProviders(<ApprovalsTable />);

    expect(await screen.findByText('4 items')).toBeInTheDocument();
    expect(bodyRows().map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      expect.stringContaining('360° Spatial Zone Layout & Camera Map'),
      expect.stringContaining('Safety Equipment & Sensor Specs'),
      expect.stringContaining('Site Patrol Onboarding & Checklists'),
      expect.stringContaining('Level 2 Drone Patrol Video Demo'),
    ]);

    const first = within(bodyRows()[0]!);
    expect(first.getByText('Site Recordings › Site Recordings')).toBeInTheDocument();
    expect(first.getByText('Image')).toBeInTheDocument();
    expect(first.getByText('Elena HelpAdmin')).toBeInTheDocument();
    expect(first.getByText('Sep 18')).toBeInTheDocument();
    expect(first.getByText('Pending Review')).toBeInTheDocument();
    expect(first.getByText('Urgent')).toBeInTheDocument();
  });

  it('explains each priority in a tooltip', async () => {
    fetchMock.mockResolvedValue(jsonResponse(approvalsResponse));

    renderWithProviders(<ApprovalsTable />);

    expect(await screen.findByText('High')).toHaveAttribute(
      'title',
      'Safety equipment and sensor specs protect people on site.',
    );
  });

  it('shows a calm empty state when nothing is waiting', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], total: 0 }));

    renderWithProviders(<ApprovalsTable />);

    expect(await screen.findByText(/no approvals waiting/i)).toBeInTheDocument();
    expect(screen.getByText('0 items')).toBeInTheDocument();
  });

  it('shows a friendly error with a Retry button that recovers', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(jsonResponse(approvalsResponse));

    renderWithProviders(<ApprovalsTable />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn.t load approvals/i);
    await userEvent.click(within(alert).getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('never renders a response with the wrong shape', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [{ title: 'Injected row' }], total: 1 }));

    renderWithProviders(<ApprovalsTable />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Injected row')).not.toBeInTheDocument();
  });
});
