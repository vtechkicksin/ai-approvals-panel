import { expect, goodSummary, openAction, test } from './fixtures';

const cards = (panel: import('@playwright/test').Locator) =>
  panel.getByRole('list', { name: 'Approvals in priority order' }).getByRole('listitem');

test.describe('Present me Summary', () => {
  test('streams a validated AI summary into rule-ranked cards', async ({ panel, gemini }) => {
    await gemini.reply({ kind: 'json', value: goodSummary, chunk: 25 });

    await openAction(panel, 'Present me Summary');

    await expect(cards(panel)).toHaveCount(4);
    await expect(cards(panel).nth(0)).toContainText('360° Spatial Zone Layout & Camera Map');
    await expect(panel.getByText(goodSummary.headline)).toBeVisible();
    await expect(cards(panel).nth(1)).toContainText('Safety specs protect people on site.');
    await expect(panel.getByText('Written by AI')).toBeVisible();

    const [call] = await gemini.calls();
    expect(JSON.stringify(call!.body)).toContain('application/json'); // JSON mode
  });

  test('falls back to the rule-based summary when Gemini is down', async ({ panel, gemini }) => {
    await gemini.reply({ kind: 'error', status: 503 }, { kind: 'error', status: 503 });

    await openAction(panel, 'Present me Summary');

    await expect(panel.getByText(/AI assistant is unavailable right now/)).toBeVisible();
    await expect(panel.getByText(/4 approvals waiting \(1 urgent, 1 high, 2 medium\)/)).toBeVisible();
    await expect(panel.getByText('Rule-based summary')).toBeVisible();
    await expect(cards(panel)).toHaveCount(4);
  });

  test('never shows a broken AI reply; the rule-based summary replaces it', async ({ panel, gemini }) => {
    await gemini.reply({ kind: 'json', value: null, raw: '{"headline":"Injected headline","items":[{"id":"apr-999","reas' });

    await openAction(panel, 'Present me Summary');

    await expect(panel.getByText('Rule-based summary')).toBeVisible();
    await expect(panel.getByText(/4 approvals waiting/)).toBeVisible();
    await expect(panel.getByText('Injected headline')).toBeHidden();
  });

  test('uses the rule-based summary when the AI says nothing in time', async ({ panel, gemini }) => {
    await gemini.reply({ kind: 'silent' });

    await openAction(panel, 'Present me Summary');

    await expect(panel.getByText(/assistant is slow right now/)).toBeVisible();
    await expect(panel.getByText('Rule-based summary')).toBeVisible();
  });
});
