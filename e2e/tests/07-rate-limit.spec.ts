import { expect, openAction, test } from './fixtures';

test.describe('Rate limit', () => {
  test('asks the operator to wait after too many AI requests in a minute', async ({ panel, gemini }) => {
    await openAction(panel, 'Help me');
    const box = panel.getByRole('textbox', { name: 'Question' });

    // The suite allows 6 AI requests per session per minute. Off-policy questions are answered
    // by rules (no Gemini call), but they still count towards the limit.
    for (let i = 1; i <= 6; i++) {
      await box.fill(`What is the weather on day ${i}?`);
      await panel.getByRole('button', { name: 'Ask', exact: true }).click();
      await expect(panel.getByText(/not covered by the approval policy/i)).toBeVisible();
    }

    await box.fill('What is the weather on day 7?');
    await panel.getByRole('button', { name: 'Ask', exact: true }).click();

    await expect(panel.getByRole('alert')).toContainText(/please wait about \d+ seconds/i);
    expect(await gemini.calls()).toHaveLength(0);
  });
});
