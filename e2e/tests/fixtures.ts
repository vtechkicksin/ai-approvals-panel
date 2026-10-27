import { test as base, expect, type Locator, type Page } from '@playwright/test';

const FAKE = 'http://localhost:4900/__fake';

export type FakeReply =
  | { kind: 'text'; pieces: string[]; gapMs?: number }
  | { kind: 'json'; value: unknown; raw?: string; chunk?: number }
  | { kind: 'error'; status: number }
  | { kind: 'silent' }
  | { kind: 'stall'; pieces: string[] };

interface FakeGemini {
  /** Queue the replies for the next AI calls, in order. */
  reply: (...replies: FakeReply[]) => Promise<void>;
  /** The requests the fake received so far. */
  calls: () => Promise<{ path: string; body: { contents?: unknown[]; systemInstruction?: unknown } }[]>;
}

/** The seed queue's ids, in ranked order. */
export const RANKED_IDS = ['apr-004', 'apr-003', 'apr-001', 'apr-002'];

export const goodSummary = {
  headline: 'Four approvals are waiting; start with the urgent camera map.',
  items: [
    { id: 'apr-004', reason: 'Marked urgent, so review it first.' },
    { id: 'apr-003', reason: 'Safety specs protect people on site.' },
    { id: 'apr-001', reason: 'New patrol staff are waiting on these.' },
    { id: 'apr-002', reason: 'A training video that can wait.' },
  ],
  spokenScript: 'You have four approvals waiting. Start with the urgent camera map.',
};

export const test = base.extend<{ gemini: FakeGemini; panel: Locator }>({
  gemini: async ({ request }, use) => {
    await request.post(`${FAKE}/reset`);
    await use({
      reply: async (...replies) => {
        await request.post(`${FAKE}/replies`, { data: { replies } });
      },
      calls: async () => ((await (await request.get(`${FAKE}/calls`)).json()) as { calls: never[] }).calls,
    });
  },
  panel: async ({ page }, use) => {
    await page.goto('/');
    const panel = page.getByRole('region', { name: 'Approvals assistant' });
    await expect(panel).toBeVisible();
    await use(panel);
  },
});

export async function openAction(panel: Locator, name: string) {
  await panel.getByRole('button', { name, exact: true }).click();
  await expect(panel.getByRole('heading', { name, exact: true })).toBeVisible();
}

/** The buttons are named by their visible text: "EN" and "हिं". */
export async function setLanguage(page: Page, language: 'en' | 'hi') {
  await page
    .getByRole('group', { name: 'Language' })
    .getByRole('button', { name: language === 'hi' ? 'हिं' : 'EN', exact: true })
    .click();
}

export { expect };
