import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApprovalsResponse, RankedApproval, SummaryCard, SummaryStreamEvent } from '@approvals/schemas';
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

/** A streamed SSE response the test controls event by event. */
export function controlledSse() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    send: (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
    raw: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
    fail: (err: Error) => controller.error(err),
  };
}

/** A finished SSE response with these events. */
export function sseResponse(events: unknown[]): Response {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}


export const summaryCards: SummaryCard[] = rankedApprovals.map((a) => ({
  id: a.id,
  rank: a.rank,
  title: a.title,
  type: a.type,
  effectivePriority: a.effectivePriority,
  priorityReason: a.priorityReason,
}));

export const skeletonEvent: SummaryStreamEvent = { type: 'skeleton', items: summaryCards, total: summaryCards.length };

export const finalSummary = {
  headline: 'Four approvals are waiting; start with the urgent camera map.',
  items: summaryCards.map((c) => ({ id: c.id, reason: `AI reason for ${c.id}` })),
  spokenScript: 'You have four approvals waiting.',
};
