import { expect, RANKED_IDS, test } from './fixtures';

test.describe('Dashboard', () => {
  test('lists the queue in policy order and greets instantly, without the AI', async ({ page, panel, gemini }) => {
    const rows = page.getByRole('table', { name: /pending approval requests/i }).getByRole('row');
    await expect(rows).toHaveCount(5); // header + 4
    await expect(rows.nth(1)).toContainText('360° Spatial Zone Layout & Camera Map');
    await expect(rows.nth(1)).toContainText('Urgent');
    await expect(rows.nth(2)).toContainText('Safety Equipment & Sensor Specs');

    await expect(panel.getByRole('status', { name: 'Greeting' })).toContainText(
      /4 approvals are waiting \(1 urgent, 1 high, 2 medium\)\. Start with “360° Spatial Zone Layout & Camera Map”\./,
    );
    await expect(panel.getByText('4 folders / items')).toBeVisible();
    expect(await gemini.calls()).toHaveLength(0);
    expect(RANKED_IDS).toHaveLength(4);
  });

  test('closes and reopens the assistant', async ({ page, panel }) => {
    await panel.getByRole('button', { name: 'Close assistant' }).click();
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: 'Open assistant' }).click();
    await expect(page.getByRole('region', { name: 'Approvals assistant' })).toBeVisible();
  });
});
