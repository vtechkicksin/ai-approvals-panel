import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApprovalsResponse, RankedApproval } from '@approvals/schemas';
import { initialPanelData, usePanelStore } from '../src/state/panelStore';

export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

export function resetPanelStore() {
  usePanelStore.setState(initialPanelData);
}

const base = {
  submittedBy: 'Sam HelpAdmin',
  submittedAt: '2026-09-18T09:15:00.000Z',
  status: 'pending_review',
  prioritySource: 'policy',
} as const;

export const rankedApprovals: RankedApproval[] = [
  {
    ...base,
    id: 'apr-004',
    rank: 1,
    title: '360° Spatial Zone Layout & Camera Map',
    type: 'image',
    submittedBy: 'Elena HelpAdmin',
    location: ['Site Recordings', 'Site Recordings'],
    category: 'mapping',
    priority: 'urgent',
    effectivePriority: 'urgent',
    prioritySource: 'item_override',
    priorityReason: 'Marked urgent by the submitter, which overrides the policy.',
  },
  {
    ...base,
    id: 'apr-003',
    rank: 2,
    title: 'Safety Equipment & Sensor Specs',
    type: 'pdf',
    location: ['Site Recordings', 'Site Recordings'],
    category: 'safety',
    effectivePriority: 'high',
    priorityReason: 'Safety equipment and sensor specs protect people on site.',
  },
  {
    ...base,
    id: 'apr-001',
    rank: 3,
    title: 'Site Patrol Onboarding & Checklists',
    type: 'folder',
    location: ['My Site Patrol', 'My Site Patrol Card'],
    category: 'onboarding',
    effectivePriority: 'medium',
    priorityReason: 'New patrol staff cannot start until their checklists are approved.',
  },
  {
    ...base,
    id: 'apr-002',
    rank: 4,
    title: 'Level 2 Drone Patrol Video Demo',
    type: 'video',
    submittedBy: 'Alex HelpAdmin',
    location: ['Drawing-Videos', 'Drawing-Videos Card'],
    category: 'training',
    effectivePriority: 'medium',
    priorityReason: 'Training videos guide patrols but do not block daily work.',
  },
];

export const approvalsResponse: ApprovalsResponse = { items: rankedApprovals, total: rankedApprovals.length };

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** A fetch that never answers: keeps components in their loading state. */
export const pendingFetch = () => new Promise<Response>(() => {});
